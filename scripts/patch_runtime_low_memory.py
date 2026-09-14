from pathlib import Path
import re

worker_path = Path("services/docling/worker.py")
worker = worker_path.read_text()
pattern = re.compile(r"def malware_scan\(path: Path, content_type: str\) -> dict\[str, Any\]:.*?\n\ndef persist_public\(", re.S)
replacement = '''def malware_scan(path: Path, content_type: str) -> dict[str, Any]:
    scanner_url = os.environ.get("MALWARE_SCANNER_URL")
    if scanner_url:
        headers: dict[str, str] = {}
        if token := os.environ.get("MALWARE_SCANNER_TOKEN"):
            headers["authorization"] = f"Bearer {token}"
        try:
            with path.open("rb") as source:
                response = httpx.post(
                    scanner_url,
                    files={"file": (path.name, source, content_type)},
                    headers=headers,
                    timeout=120,
                )
            if response.status_code < 500 and response.status_code != 429:
                if response.status_code >= 400:
                    raise PipelineError("scanner_rejected", "Content-safety scanner rejected the source", False)
                result = response.json()
                if result.get("clean") is not True:
                    signature = str(result.get("signature") or "policy_rejected")
                    raise PipelineError("content_safety_rejected", f"Source failed content-safety validation ({signature})", False)
                return {
                    "scanner": result.get("scanner", "configured-service"),
                    "signature": result.get("signature"),
                    "fallback": False,
                    "signature_antivirus": result.get("scanner") in {"clamav", "clamd"},
                }
            LOGGER.warning("remote content-safety scanner unavailable; falling back locally", extra={"status": response.status_code})
        except PipelineError:
            raise
        except (httpx.HTTPError, ValueError) as error:
            LOGGER.warning("remote content-safety scanner request failed; falling back locally", extra={"error": type(error).__name__})
    else:
        LOGGER.warning("remote content-safety scanner is not configured; falling back locally")
    return local_malware_scan(path)


def convert(path: Path, file_name: str, content_type: str, source_hash: str) -> tuple[dict[str, Any], bytes]:
    full_docling = os.environ.get("DOCLING_FULL_PARSE", "").strip().lower() in {"1", "true", "yes"}
    if full_docling:
        try:
            from docling.document_converter import DocumentConverter

            result = DocumentConverter().convert(path)
            document = result.document.export_to_dict()
            payload = {
                "schema": "legal-eye.docling-conversion.v1",
                "engine": {"name": "docling", "version": "2.124.0"},
                "source": {"file_name": file_name, "content_type": content_type, "sha256": source_hash},
                "status": str(result.status),
                "document": document,
                "provenance": {
                    "confidence": getattr(result, "confidence", {}),
                    "timings": getattr(result, "timings", {}),
                    "canonical_format": "docling-json",
                    "fallback": False,
                },
            }
            encoded_payload = json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8")
            return payload, encoded_payload
        except Exception as error:
            LOGGER.warning(
                "Full Docling conversion failed; using lightweight extractor",
                extra={"file_name": file_name, "error": type(error).__name__},
            )
    return lightweight_convert(path, file_name, content_type, source_hash)


def persist_public('''
worker, count = pattern.subn(replacement, worker, count=1)
assert count == 1, "worker processing block not found"
worker_path.write_text(worker)

pyproject_path = Path("services/docling/pyproject.toml")
pyproject = pyproject_path.read_text()
pyproject = pyproject.replace('  "docling==2.124.0",\n', '')
pyproject_path.write_text(pyproject)

app_path = Path("services/docling/app.py")
app_path.write_text('''"""Low-memory structure-preserving document conversion for Legal Eye."""

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
''')

fallback_ts = Path("app/api/legal-ai/public-source-fallback.ts")
text = fallback_ts.read_text()
text = text.replace("  pageNumber: number;", "  page_number: number;")
text = text.replace("          pageNumber: page.pageNumber,", "          page_number: page.pageNumber,")
fallback_ts.write_text(text)

print("patched low-memory worker, parser service, and official citation page field")
