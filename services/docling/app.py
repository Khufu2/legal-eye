"""Private, structure-preserving document conversion for Legal Eye."""

from __future__ import annotations

import hashlib
import hmac
import os
import tempfile
from pathlib import Path
from time import perf_counter
from typing import Annotated

from docling.document_converter import DocumentConverter
from fastapi import FastAPI, File, Header, HTTPException, Query, UploadFile
from starlette.concurrency import run_in_threadpool

app = FastAPI(title="Legal Eye document parser", version="0.1.0", docs_url=None, redoc_url=None)
converter = DocumentConverter()
MAX_UPLOAD_BYTES = int(os.environ.get("DOCLING_MAX_UPLOAD_BYTES", str(100 * 1024 * 1024)))
ALLOWED_SUFFIXES = {".pdf", ".docx", ".xlsx", ".pptx", ".html", ".htm", ".txt", ".png", ".jpg", ".jpeg", ".tif", ".tiff"}


def authorize(value: str | None) -> None:
    expected = os.environ.get("LEGAL_EYE_PARSER_KEY")
    if not expected or not value or not hmac.compare_digest(value, expected):
        raise HTTPException(status_code=401, detail="Parser authorization failed")


@app.get("/healthz")
def health() -> dict[str, str]:
    return {"status": "ok", "engine": "docling", "engine_version": "2.124.0"}


@app.post("/v1/convert")
async def convert(
    file: Annotated[UploadFile, File()],
    parser_key: Annotated[str | None, Header(alias="X-Legal-Eye-Parser-Key")] = None,
    include_markdown: Annotated[bool, Query()] = False,
) -> dict:
    authorize(parser_key)
    suffix = Path(file.filename or "document.bin").suffix[:16]
    if suffix.lower() not in ALLOWED_SUFFIXES:
        raise HTTPException(status_code=415, detail="Unsupported document format")
    started = perf_counter()
    sha256 = hashlib.sha256()
    byte_count = 0

    with tempfile.NamedTemporaryFile(suffix=suffix) as source:
        while block := await file.read(1024 * 1024):
            byte_count += len(block)
            if byte_count > MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail="Document exceeds the configured size limit")
            sha256.update(block)
            source.write(block)
        source.flush()

        result = await run_in_threadpool(converter.convert, Path(source.name))
        document = result.document
        payload: dict = {
            "schema": "legal-eye.docling-conversion.v1",
            "engine": {"name": "docling", "version": "2.124.0"},
            "source": {
                "file_name": file.filename,
                "content_type": file.content_type,
                "sha256": sha256.hexdigest(),
                "byte_size": byte_count,
            },
            "status": str(result.status),
            "elapsed_ms": round((perf_counter() - started) * 1000),
            "document": document.export_to_dict(),
            "provenance": {
                "timings": getattr(result, "timings", {}),
                "confidence": getattr(result, "confidence", {}),
                "canonical_format": "docling-json",
                "temporary_source_destroyed_after_response": True,
            },
        }
        if include_markdown:
            payload["derived_markdown"] = document.export_to_markdown()
        return payload
