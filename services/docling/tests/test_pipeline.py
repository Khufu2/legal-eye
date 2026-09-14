from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from pipeline import PipelineError, extract_docling_chunks, validate_download, validate_source_url
from worker import malware_scan, oag_document_url


class SourceValidationTests(unittest.TestCase):
    def test_resolves_oag_catalog_document_path(self) -> None:
        self.assertEqual(
            oag_document_url({"billDocPath": "bills/official document.pdf"}),
            "https://oagmis.oag.go.tz/storage/bills/official%20document.pdf",
        )

    def test_rejects_oag_catalog_path_traversal(self) -> None:
        self.assertIsNone(oag_document_url({"actDocPath": "../private/document.pdf"}))

    def test_accepts_approved_https_host(self) -> None:
        self.assertEqual(
            validate_source_url("https://oagmis.oag.go.tz/portal/acts/1/download", "oagmis.oag.go.tz"),
            "https://oagmis.oag.go.tz/portal/acts/1/download",
        )

    def test_rejects_cross_host_and_credentials(self) -> None:
        for value in (
            "https://example.com/document.pdf",
            "https://user:password@oagmis.oag.go.tz/document.pdf",
            "http://oagmis.oag.go.tz/document.pdf",
        ):
            with self.subTest(value=value), self.assertRaises(PipelineError):
                validate_source_url(value, "oagmis.oag.go.tz")

    def test_pdf_signature_is_required(self) -> None:
        validate_download("application/pdf", b"%PDF-1.7", "law.pdf")
        with self.assertRaises(PipelineError):
            validate_download("application/pdf", b"<html>", "law.pdf")


class HybridScannerTests(unittest.TestCase):
    def test_remote_scanner_outage_falls_back_to_local_clamav(self) -> None:
        response = Mock(status_code=503)
        with tempfile.NamedTemporaryFile(suffix=".pdf") as source:
            source.write(b"%PDF-1.7\n")
            source.flush()
            with patch.dict(os.environ, {"MALWARE_SCANNER_URL": "http://scanner.invalid/scan"}, clear=False), \
                    patch("worker.httpx.post", return_value=response), \
                    patch("worker.local_malware_scan", return_value={"scanner": "clamav-local", "signature": None, "fallback": True}) as local_scan:
                result = malware_scan(Path(source.name), "application/pdf")

        self.assertEqual(result["scanner"], "clamav-local")
        self.assertTrue(result["fallback"])
        local_scan.assert_called_once()

    def test_remote_scanner_rejection_remains_fail_closed(self) -> None:
        response = Mock(status_code=400)
        response.json.return_value = {"clean": False}
        with tempfile.NamedTemporaryFile(suffix=".pdf") as source:
            source.write(b"%PDF-1.7\n")
            source.flush()
            with patch.dict(os.environ, {"MALWARE_SCANNER_URL": "http://scanner.invalid/scan"}, clear=False), \
                    patch("worker.httpx.post", return_value=response), \
                    patch("worker.local_malware_scan") as local_scan, \
                    self.assertRaises(PipelineError) as raised:
                malware_scan(Path(source.name), "application/pdf")

        self.assertEqual(raised.exception.code, "scanner_rejected")
        self.assertFalse(raised.exception.retryable)
        local_scan.assert_not_called()


class ChunkExtractionTests(unittest.TestCase):
    def test_preserves_text_and_table_provenance(self) -> None:
        document = {
            "texts": [{
                "self_ref": "#/texts/0",
                "parent": {"$ref": "#/body"},
                "label": "section_header",
                "text": "Section 1. Short title",
                "prov": [{
                    "page_no": 1,
                    "bbox": {"l": 10, "t": 20, "r": 200, "b": 40},
                    "charspan": [0, 22],
                    "confidence": 0.98,
                }],
            }],
            "tables": [{
                "self_ref": "#/tables/0",
                "label": "table",
                "prov": [{"page_no": 2, "bbox": {"l": 5, "t": 10, "r": 300, "b": 200}}],
                "data": {"table_cells": [
                    {"start_row_offset_idx": 0, "start_col_offset_idx": 0, "text": "Act"},
                    {"start_row_offset_idx": 0, "start_col_offset_idx": 1, "text": "Year"},
                    {"start_row_offset_idx": 1, "start_col_offset_idx": 0, "text": "Companies"},
                    {"start_row_offset_idx": 1, "start_col_offset_idx": 1, "text": "2002"},
                ]},
            }],
        }

        chunks = extract_docling_chunks(document, "en")

        self.assertEqual(len(chunks), 2)
        self.assertEqual(chunks[0]["source_node_ref"], "#/texts/0")
        self.assertEqual(chunks[0]["parent_node_ref"], "#/body")
        self.assertEqual(chunks[0]["page_number"], 1)
        self.assertEqual(chunks[0]["start_offset"], 0)
        self.assertEqual(chunks[0]["end_offset"], 22)
        self.assertEqual(chunks[0]["extraction_confidence"], 0.98)
        self.assertEqual(chunks[1]["content"], "Act\tYear\nCompanies\t2002")
        self.assertEqual(chunks[1]["page_number"], 2)

    def test_lightweight_extractor_provenance_is_retained(self) -> None:
        document = {
            "texts": [{
                "self_ref": "#/texts/0",
                "label": "paragraph",
                "text": "A lightweight exact passage.",
                "_source": "lightweight",
                "prov": [{"page_no": 3, "confidence": 0.82}],
            }],
            "tables": [],
        }

        [chunk] = extract_docling_chunks(document, "en")

        self.assertEqual(chunk["page_number"], 3)
        self.assertEqual(chunk["ocr_provenance"]["source"], "lightweight")
        self.assertEqual(chunk["metadata"]["extractor"], "lightweight")


if __name__ == "__main__":
    unittest.main()
