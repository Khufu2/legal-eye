"""Small authenticated ClamAV gateway for Legal Eye ingestion workers."""

from __future__ import annotations

import hashlib
import hmac
import os
import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Header, HTTPException, UploadFile


MAX_BYTES = int(os.environ.get("SCANNER_MAX_UPLOAD_BYTES", str(100 * 1024 * 1024)))
SCANNER_TOKEN = os.environ.get("SCANNER_TOKEN", "")
app = FastAPI(title="Legal Eye Malware Scanner", docs_url=None, redoc_url=None)


def authorize(authorization: str | None) -> None:
    if not SCANNER_TOKEN:
        raise HTTPException(status_code=503, detail="Scanner authentication is not configured")
    supplied = authorization.removeprefix("Bearer ") if authorization else ""
    if not hmac.compare_digest(supplied, SCANNER_TOKEN):
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health() -> dict[str, str]:
    try:
        version = subprocess.run(
            ["clamscan", "--version"],
            check=True,
            capture_output=True,
            text=True,
            timeout=10,
        ).stdout.strip()
    except (OSError, subprocess.SubprocessError) as error:
        raise HTTPException(status_code=503, detail="ClamAV is unavailable") from error
    return {"status": "ok", "scanner": version}


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

        result = subprocess.run(
            ["clamscan", "--no-summary", "--infected", str(temporary_path)],
            capture_output=True,
            text=True,
            timeout=180,
        )
        output = (result.stdout or result.stderr).strip()
        if result.returncode == 0:
            return {
                "clean": True,
                "scanner": "clamav",
                "signature": None,
                "sha256": digest.hexdigest(),
            }
        if result.returncode == 1:
            signature = output.rsplit(": ", 1)[-1].removesuffix(" FOUND") if output else "unknown"
            return {
                "clean": False,
                "scanner": "clamav",
                "signature": signature,
                "sha256": digest.hexdigest(),
            }
        raise HTTPException(status_code=503, detail="ClamAV scan failed")
    except subprocess.TimeoutExpired as error:
        raise HTTPException(status_code=503, detail="ClamAV scan timed out") from error
    finally:
        await file.close()
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)

