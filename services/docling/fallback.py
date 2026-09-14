"""Fallback extraction and local malware scanning for Legal Eye processing.

Docling remains the preferred parser. This module exists so a Docling or Railway
private-network outage cannot prevent a clean document from becoming searchable.
"""

from __future__ import annotations

import json
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

from pipeline import PipelineError


class _TextHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        text = data.strip()
        if text:
            self.parts.append(text)


def _split_text(value: str, max_chars: int = 2600) -> list[str]:
    paragraphs = [part.strip() for part in value.replace("\r\n", "\n").split("\n\n") if part.strip()]
    if not paragraphs:
        paragraphs = [part.strip() for part in value.split("\n") if part.strip()]
    chunks: list[str] = []
    current = ""
    for paragraph in paragraphs:
        if len(paragraph) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            for start in range(0, len(paragraph), max_chars):
                piece = paragraph[start : start + max_chars].strip()
                if piece:
                    chunks.append(piece)
            continue
        candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                chunks.append(current)
            current = paragraph
    if current:
        chunks.append(current)
    return chunks


def local_malware_scan(path: Path) -> dict[str, Any]:
    try:
        result = subprocess.run(
            ["clamscan", "--no-summary", "--infected", str(path)],
            capture_output=True,
            text=True,
            timeout=180,
        )
    except (OSError, subprocess.SubprocessError) as error:
        raise PipelineError("local_scanner_unavailable", "Local malware scanner is unavailable") from error
    output = (result.stdout or result.stderr or "").strip()
    if result.returncode == 0:
        return {"scanner": "clamav-local", "signature": None, "fallback": True}
    if result.returncode == 1:
        signature = output.rsplit(": ", 1)[-1].removesuffix(" FOUND") if output else "unknown"
        raise PipelineError("malware_detected", f"Source failed malware validation ({signature})", False)
    raise PipelineError("local_scanner_unavailable", "Local malware scanner failed")


def _text_nodes_from_pdf(path: Path) -> list[dict[str, Any]]:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    nodes: list[dict[str, Any]] = []
    order = 0
    for page_index, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        for part in _split_text(text):
            nodes.append({
                "text": part,
                "label": "paragraph",
                "self_ref": f"#/texts/{order}",
                "_source": "lightweight",
                "prov": [{"page_no": page_index, "confidence": 0.82}],
            })
            order += 1
    return nodes


def _text_nodes_from_docx(path: Path) -> list[dict[str, Any]]:
    from docx import Document

    document = Document(str(path))
    raw = "\n\n".join(paragraph.text for paragraph in document.paragraphs if paragraph.text.strip())
    return [
        {
            "text": part,
            "label": "paragraph",
            "self_ref": f"#/texts/{index}",
            "_source": "lightweight",
            "prov": [{"confidence": 0.9}],
        }
        for index, part in enumerate(_split_text(raw))
    ]


def _text_nodes_from_xlsx(path: Path) -> list[dict[str, Any]]:
    from openpyxl import load_workbook

    workbook = load_workbook(path, read_only=True, data_only=True)
    nodes: list[dict[str, Any]] = []
    order = 0
    try:
        for sheet in workbook.worksheets:
            lines: list[str] = []
            for row in sheet.iter_rows(values_only=True):
                values = [str(value).strip() for value in row if value is not None and str(value).strip()]
                if values:
                    lines.append("\t".join(values))
            for part in _split_text("\n".join(lines)):
                nodes.append({
                    "text": part,
                    "label": "table",
                    "self_ref": f"#/texts/{order}",
                    "_source": "lightweight",
                    "prov": [{"confidence": 0.88}],
                    "metadata": {"sheet": sheet.title},
                })
                order += 1
    finally:
        workbook.close()
    return nodes


def _text_nodes_from_plain(path: Path, content_type: str) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8", errors="replace")
    if "html" in content_type:
        parser = _TextHTMLParser()
        parser.feed(text)
        text = "\n\n".join(parser.parts)
    return [
        {
            "text": part,
            "label": "paragraph",
            "self_ref": f"#/texts/{index}",
            "_source": "lightweight",
            "prov": [{"confidence": 0.95}],
        }
        for index, part in enumerate(_split_text(text))
    ]


def lightweight_convert(path: Path, file_name: str, content_type: str, source_hash: str) -> tuple[dict[str, Any], bytes]:
    suffix = Path(file_name).suffix.lower()
    normalized = content_type.split(";", 1)[0].strip().lower()
    try:
        if suffix == ".pdf" or normalized == "application/pdf":
            texts = _text_nodes_from_pdf(path)
        elif suffix == ".docx" or normalized == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            texts = _text_nodes_from_docx(path)
        elif suffix == ".xlsx" or normalized == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
            texts = _text_nodes_from_xlsx(path)
        elif normalized in {"text/plain", "text/html", "application/xhtml+xml"} or suffix in {".txt", ".html", ".htm"}:
            texts = _text_nodes_from_plain(path, normalized)
        else:
            raise PipelineError("lightweight_format_unsupported", f"Lightweight extractor does not support {normalized or suffix}", False)
    except PipelineError:
        raise
    except Exception as error:
        raise PipelineError("lightweight_extract_failed", f"Lightweight extraction failed: {type(error).__name__}") from error

    if not texts:
        raise PipelineError("no_searchable_text", "No searchable text could be extracted from this document", False)

    payload = {
        "schema": "legal-eye.lightweight-conversion.v1",
        "engine": {"name": "lightweight", "version": "1.0.0"},
        "source": {"file_name": file_name, "content_type": content_type, "sha256": source_hash},
        "status": "success",
        "document": {"texts": texts, "tables": []},
        "provenance": {
            "confidence": {"text": 0.82},
            "canonical_format": "lightweight-json",
            "fallback": True,
        },
    }
    encoded = json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8")
    return payload, encoded
