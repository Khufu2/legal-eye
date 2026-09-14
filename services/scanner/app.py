"""Small authenticated ClamAV gateway for Legal Eye ingestion workers."""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Header, HTTPException, UploadFile


MAX_BYTES = int(os.environ.get("SCANNER_MAX_UPLOAD_BYTES", str(100 * 1024 * 1024)))
SCANNER_TOKEN = os.environ.get("SCANNER_TOKEN", "")
LOGGER = logging.getLogger("legal_eye.malware_scanner")
app = FastAPI(title="Legal Eye Malware Scanner", docs_url=None, redoc_url=None)


def authorize(authorization: str | None) -> None:
    if not SCANNER_TOKEN:
        raise HTTPException(status_code=503, detail="Scanner authentication is not configured")
    supplied = authorization.removeprefix("Bearer ") if authorization else ""
    if not hmac.compare_digest(supplied, SCANNER_TOKEN):
        raise HTTPException(status_code=401, detail="Unauthorized")


def run_scan(path: Path, timeout: int = 180) -> subprocess.CompletedProcess[str]:
    """Scan through the resident clamd process instead of loading signatures per request."""
    return subprocess.run(
        ["clamdscan", "--fdpass", "--no-summary", str(path)],
        capture_output=True,
        text=True,
        timeout=timeout,
    )


@app.get("/health")
def health() -> dict[str, str]:
    try:
        result = subprocess.run(
            ["clamdscan", "--version"],
            check=True,
            capture_output=True,
            text=True,
            timeout=10,
        )
        with tempfile.NamedTemporaryFile(prefix="legal-eye-health-") as target:
            probe = run_scan(Path(target.name), timeout=20)
        if probe.returncode != 0:
            raise RuntimeError((probe.stdout or probe.stderr or "clamd probe failed").strip())
    except (OSError, RuntimeError, subprocess.SubprocessError) as error:
        raise HTTPException(status_code=503, detail="ClamAV daemon is unavailable") from error
    return {"status": "ok", "scanner": result.stdout.strip() or "clamd"}


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
        with tempfile.NamedTemporaryFile(prefix="legal-eye-", delete=False) as target:
            temporary_path = Path(target.name)
            while block := await file.read(1024 * 1024):
                size += len(block)
                if size > MAX_BYTES:
                    raise HTTPException(status_code=413, detail="File exceeds scanner size limit")
                digest.update(block)
                target.write(block)

        result = run_scan(temporary_path)
        output = (result.stdout or result.stderr or "").strip()
        if result.returncode == 0:
            return {
                "clean": True,
                "scanner": "clamd",
                "signature": None,
                "sha256": digest.hexdigest(),
            }
        if result.returncode == 1:
            signature = output.rsplit(": ", 1)[-1].removesuffix(" FOUND") if output else "unknown"
            return {
                "clean": False,
                "scanner": "clamd",
                "signature": signature,
                "sha256": digest.hexdigest(),
            }
        LOGGER.error("ClamAV daemon scan failed: exit=%s output=%s", result.returncode, output[:500])
        raise HTTPException(status_code=503, detail="ClamAV daemon scan failed")
    except subprocess.TimeoutExpired as error:
        LOGGER.error("ClamAV daemon scan timed out", extra={"timeout_seconds": 180})
        raise HTTPException(status_code=503, detail="ClamAV daemon scan timed out") from error
    finally:
        await file.close()
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
