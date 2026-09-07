"""Pure pipeline helpers shared by the Docling API and queue worker."""

from __future__ import annotations

import hashlib
import ipaddress
from dataclasses import dataclass
from typing import Any, Iterable
from urllib.parse import urlparse


@dataclass(slots=True)
class PipelineError(Exception):
    code: str
    message: str
    retryable: bool = True

    def __str__(self) -> str:
        return self.message


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def validate_source_url(value: str, allowed_host: str) -> str:
    """Reject non-HTTPS, credentialed, off-source and private-address URLs."""
    parsed = urlparse(value)
    host = (parsed.hostname or "").rstrip(".").lower()
    expected = allowed_host.rstrip(".").lower()
    if parsed.scheme != "https" or not host or parsed.username or parsed.password:
        raise PipelineError("source_url_rejected", "Source URL must be credential-free HTTPS", False)
    if host != expected and not host.endswith(f".{expected}"):
        raise PipelineError("source_host_rejected", "Source URL is outside the approved source host", False)
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        address = None
    if address and not address.is_global:
        raise PipelineError("private_address_rejected", "Private and reserved source addresses are blocked", False)
    return value


def validate_download(content_type: str, first_bytes: bytes, file_name: str) -> None:
    normalized = content_type.split(";", 1)[0].strip().lower()
    lower_name = file_name.lower()
    if lower_name.endswith(".pdf") or normalized == "application/pdf":
        if not first_bytes.startswith(b"%PDF-"):
            raise PipelineError("invalid_pdf_signature", "Downloaded PDF has an invalid signature", False)
        return
    allowed = {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
        "text/html",
        "application/xhtml+xml",
        "image/png",
        "image/jpeg",
        "image/tiff",
    }
    if normalized not in allowed:
        raise PipelineError("content_type_rejected", f"Unsupported upstream content type: {normalized}", False)


def _node_ref(value: Any) -> str | None:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        ref = value.get("$ref") or value.get("self_ref")
        return str(ref) if ref else None
    return None


def _provenance(node: dict[str, Any]) -> tuple[int | None, list[Any], int | None, int | None, float | None]:
    records = node.get("prov") if isinstance(node.get("prov"), list) else []
    pages: list[int] = []
    boxes: list[Any] = []
    start: int | None = None
    end: int | None = None
    confidences: list[float] = []
    for record in records:
        if not isinstance(record, dict):
            continue
        page = record.get("page_no")
        if isinstance(page, int):
            pages.append(page)
        bbox = record.get("bbox")
        if isinstance(bbox, dict):
            boxes.append({"page": page, **bbox})
        span = record.get("charspan")
        if isinstance(span, (list, tuple)) and len(span) == 2:
            if isinstance(span[0], int):
                start = span[0] if start is None else min(start, span[0])
            if isinstance(span[1], int):
                end = span[1] if end is None else max(end, span[1])
        confidence = record.get("confidence")
        if isinstance(confidence, (int, float)):
            confidences.append(float(confidence))
    node_confidence = node.get("confidence")
    if isinstance(node_confidence, (int, float)):
        confidences.append(float(node_confidence))
    return (
        min(pages) if pages else None,
        boxes,
        start,
        end,
        sum(confidences) / len(confidences) if confidences else None,
    )


def _table_text(node: dict[str, Any]) -> str:
    data = node.get("data")
    if not isinstance(data, dict):
        return ""
    cells = data.get("table_cells")
    if not isinstance(cells, list):
        return ""
    rows: dict[int, list[tuple[int, str]]] = {}
    for cell in cells:
        if not isinstance(cell, dict):
            continue
        text = str(cell.get("text") or "").strip()
        if not text:
            continue
        row = cell.get("start_row_offset_idx")
        column = cell.get("start_col_offset_idx")
        rows.setdefault(row if isinstance(row, int) else 0, []).append(
            (column if isinstance(column, int) else 0, text)
        )
    return "\n".join("\t".join(text for _, text in sorted(cells)) for _, cells in sorted(rows.items()))


def extract_docling_chunks(document: dict[str, Any], language_code: str | None = None) -> list[dict[str, Any]]:
    """Derive searchable nodes while retaining Docling references and page geometry."""
    candidates: list[tuple[str, int, dict[str, Any], str]] = []
    for node_type, collection_name in (("text", "texts"), ("table", "tables")):
        collection = document.get(collection_name)
        if not isinstance(collection, list):
            continue
        for index, node in enumerate(collection):
            if not isinstance(node, dict):
                continue
            content = str(node.get("text") or "").strip() if node_type == "text" else _table_text(node)
            if content:
                candidates.append((node_type, index, node, content))

    chunks: list[dict[str, Any]] = []
    seen_refs: set[str] = set()
    for reading_order, (node_type, index, node, content) in enumerate(candidates):
        source_ref = _node_ref(node.get("self_ref")) or f"#/{'texts' if node_type == 'text' else 'tables'}/{index}"
        if source_ref in seen_refs:
            source_ref = f"{source_ref}:{index}"
        seen_refs.add(source_ref)
        page, boxes, start, end, confidence = _provenance(node)
        chunks.append({
            "source_node_ref": source_ref,
            "parent_node_ref": _node_ref(node.get("parent")),
            "node_type": str(node.get("label") or node_type),
            "reading_order": reading_order,
            "page_number": page,
            "bounding_boxes": boxes,
            "start_offset": start,
            "end_offset": end,
            "content": content,
            "language_code": language_code,
            "extraction_confidence": confidence,
            "ocr_provenance": {
                "has_provenance": bool(node.get("prov")),
                "source": "docling",
            },
            "metadata": {"docling_label": node.get("label")},
        })
    return chunks


def batches(items: list[dict[str, Any]], size: int = 100) -> Iterable[list[dict[str, Any]]]:
    for index in range(0, len(items), size):
        yield items[index : index + size]
