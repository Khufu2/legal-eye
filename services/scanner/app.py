"""Authenticated low-memory content-safety gateway for Legal Eye ingestion workers.

The service intentionally avoids a resident antivirus signature database because
that process exceeds the memory available to this Railway service. It validates
only the document formats Legal Eye accepts and blocks active/embedded payloads,
unsafe archives, malformed containers, and parser-abuse patterns.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import tempfile
import zipfile
from pathlib import Path

from fastapi import FastAPI, File, Header, HTTPException, UploadFile


MAX_BYTES = int(os.environ.get("SCANNER_MAX_UPLOAD_BYTES", str(100 * 1024 * 1024)))
SCANNER_TOKEN = os.environ.get("SCANNER_TOKEN", "")
app = FastAPI(title="Legal Eye Content Safety Scanner", docs_url=None, redoc_url=None)


def authorize(authorization: str | None) -> None:
    if not SCANNER_TOKEN:
        raise HTTPException(status_code=503, detail="Scanner authentication is not configured")
    supplied = authorization.removeprefix("Bearer ") if authorization else ""
    if not hmac.compare_digest(supplied, SCANNER_TOKEN):
        raise HTTPException(status_code=401, detail="Unauthorized")


def _scan_stream_for_tokens(path: Path, tokens: tuple[bytes, ...]) -> bytes | None:
    lowered = tuple(token.lower() for token in tokens)
    carry = b""
    longest = max((len(token) for token in lowered), default=1)
    with path.open("rb") as source:
        while block := source.read(1024 * 1024):
            window = (carry + block).lower()
            for token in lowered:
                if token in window:
                    return token
            carry = window[-(longest - 1):] if longest > 1 else b""
    return None


def _scan_ooxml(path: Path) -> None:
    try:
        with zipfile.ZipFile(path) as archive:
            infos = archive.infolist()
            if not infos or len(infos) > 20_000:
                raise HTTPException(status_code=422, detail="Office document archive structure is invalid")
            total_uncompressed = 0
            blocked_suffixes = (
                "/vbaproject.bin", ".exe", ".dll", ".com", ".scr", ".ps1", ".vbs", ".vbe", ".js", ".jse", ".bat", ".cmd",
            )
            blocked_markers = ("/embeddings/", "/activex/", "/oleobject")
            for info in infos:
                normalized = info.filename.replace("\\", "/").lower()
                parts = [part for part in normalized.split("/") if part]
                if normalized.startswith("/") or ".." in parts:
                    raise HTTPException(status_code=422, detail="Office document contains an unsafe archive path")
                if info.flag_bits & 0x1:
                    raise HTTPException(status_code=422, detail="Encrypted Office documents are not accepted")
                total_uncompressed += max(info.file_size, 0)
                if total_uncompressed > 250 * 1024 * 1024:
                    raise HTTPException(status_code=422, detail="Expanded Office document exceeds safety limits")
                if info.compress_size > 0 and info.file_size > 10 * 1024 * 1024 and info.file_size / info.compress_size > 250:
                    raise HTTPException(status_code=422, detail="Office document compression ratio exceeds safety limits")
                if normalized.endswith(blocked_suffixes) or any(marker in f"/{normalized}" for marker in blocked_markers):
                    raise HTTPException(status_code=422, detail="Office document contains active or embedded executable content")
    except HTTPException:
        raise
    except (OSError, zipfile.BadZipFile) as error:
        raise HTTPException(status_code=422, detail="Office document container is invalid") from error


def scan_document(path: Path, filename: str, content_type: str) -> None:
    suffix = Path(filename).suffix.lower()
    normalized_type = content_type.split(";", 1)[0].strip().lower()
    size = path.stat().st_size
    if size <= 0 or size > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File size is outside scanner policy")

    if suffix == ".pdf" or normalized_type == "application/pdf":
        with path.open("rb") as source:
            if source.read(5) != b"%PDF-":
                raise HTTPException(status_code=422, detail="PDF signature is invalid")
        token = _scan_stream_for_tokens(path, (b"/JavaScript", b"/Launch", b"/EmbeddedFile", b"/RichMedia"))
        if token:
            raise HTTPException(status_code=422, detail="PDF contains blocked active or embedded content")
        return

    if suffix in {".docx", ".xlsx"}:
        _scan_ooxml(path)
        return

    if suffix in {".txt", ".html", ".htm"} or normalized_type in {"text/plain", "text/html", "application/xhtml+xml"}:
        token = _scan_stream_for_tokens(path, (b"<script", b"javascript:", b"data:text/html"))
        if token:
            raise HTTPException(status_code=422, detail="Text document contains blocked active web content")
        return

    raise HTTPException(status_code=415, detail="Document format is not accepted by the scanner")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "scanner": "static-content-safety-v1"}


@app.post("/scan")
async def scan(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
) -> dict[str, str | bool | None]:
    authorize(authorization)
    digest = hashlib.sha256()
    size = 0
    temporary_path: Path | None = None
    try:
        suffix = Path(file.filename or "document").suffix.lower()
        with tempfile.NamedTemporaryFile(prefix="legal-eye-", suffix=suffix, delete=False) as target:
            temporary_path = Path(target.name)
            while block := await file.read(1024 * 1024):
                size += len(block)
                if size > MAX_BYTES:
                    raise HTTPException(status_code=413, detail="File exceeds scanner size limit")
                digest.update(block)
                target.write(block)

        scan_document(temporary_path, file.filename or temporary_path.name, file.content_type or "application/octet-stream")
        return {
            "clean": True,
            "scanner": "static-content-safety-v1",
            "signature": "active-content-archive-policy-v1",
            "sha256": digest.hexdigest(),
        }
    finally:
        await file.close()
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
