from __future__ import annotations

import unittest

from pipeline import PipelineError, extract_docling_chunks, validate_download, validate_source_url


class SourceValidationTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
