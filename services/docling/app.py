"""Low-memory structure-preserving document conversion for Legal Eye."""

from __future__ import annotations

import hashlib
import hmac
import os
import tempfile
from pathlib import Path
from time import perf_counter
from typing import Annotated

from fastapi import FastAPI, File, Header, HTTPException, Query, UploadFile
from starlette.concurrency import run_in_threadpool

from fallback import lightweight_convert, local_malware_scan
from pipeline import PipelineError

app = FastAPI(title="Legal Eye document parser", version="0.2.0", docs_url=None, redoc_url=None)
MAX_UPLOAD_BYTES = int(os.environ.get("DOCLING_MAX_UPLOAD_BYTES", str(100 * 1024 * 1024)))
ALLOWED_SUFFIXES = {".pdf", ".docx", ".xlsx", ".html", ".htm", ".txt"}


def authorize(value: str | None) -> None:
    expected = os.environ.get("LEGAL_EYE_PARSER_KEY")
    if not expected or not value or not hmac.compare_digest(value, expected):
        raise HTTPException(status_code=401, detail="Parser authorization failed")


@app.get("/healthz")
def health() -> dict[str, str]:
    return {"status": "ok", "engine": "legal-eye-lightweight", "engine_version": "1.0.0"}


@app.post("/v1/convert")
async def convert(
    file: Annotated[UploadFile, File()],
    parser_key: Annotated[str | None, Header(alias="X-Legal-Eye-Parser-Key")] = None,
    include_markdown: Annotated[bool, Query()] = False,
) -> dict:
    authorize(parser_key)
    suffix = Path(file.filename or "document.bin").suffix[:16].lower()
    if suffix not in ALLOWED_SUFFIXES:
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
        source_path = Path(source.name)
        try:
            await run_in_threadpool(local_malware_scan, source_path)
            payload, _ = await run_in_threadpool(
                lightweight_convert,
                source_path,
                file.filename or source_path.name,
                file.content_type or "application/octet-stream",
                sha256.hexdigest(),
            )
        except PipelineError as error:
            raise HTTPException(status_code=422, detail=error.message) from error

        payload["source"]["byte_size"] = byte_count
        payload["elapsed_ms"] = round((perf_counter() - started) * 1000)
        if include_markdown:
            texts = payload.get("document", {}).get("texts", [])
            payload["derived_markdown"] = "\n\n".join(str(item.get("text") or "") for item in texts if item.get("text"))
        return payload
