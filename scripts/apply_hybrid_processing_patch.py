from pathlib import Path
import re

pyproject = Path("services/docling/pyproject.toml")
text = pyproject.read_text()
for dependency in ['"openpyxl==3.1.5",', '"pypdf==6.1.1",', '"python-docx==1.2.0",']:
    if dependency not in text:
        text = text.replace("dependencies = [\n", "dependencies = [\n  " + dependency + "\n", 1)
pyproject.write_text(text)

dockerfile = Path("services/docling/Dockerfile")
text = dockerfile.read_text()
clam = """RUN apt-get update \\
    && apt-get install --no-install-recommends -y clamav clamav-freshclam \\
    && freshclam \\
    && rm -rf /var/lib/apt/lists/*

"""
if "clamav clamav-freshclam" not in text:
    text = text.replace("WORKDIR /service\n", "WORKDIR /service\n\n" + clam, 1)
dockerfile.write_text(text)

worker = Path("services/docling/worker.py")
text = worker.read_text()
import_line = "from fallback import lightweight_convert, local_malware_scan\n"
if import_line not in text:
    text = text.replace(
        "from pipeline import PipelineError, batches, extract_docling_chunks, sha256_bytes, validate_download, validate_source_url\n",
        "from pipeline import PipelineError, batches, extract_docling_chunks, sha256_bytes, validate_download, validate_source_url\n" + import_line,
    )

malware = '''def malware_scan(path: Path, content_type: str) -> dict[str, Any]:
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
                    raise PipelineError("scanner_rejected", "Malware scanner rejected the source", False)
                result = response.json()
                if result.get("clean") is not True:
                    raise PipelineError("malware_detected", "Source failed malware validation", False)
                return {"scanner": result.get("scanner", "configured-service"), "signature": result.get("signature"), "fallback": False}
            LOGGER.warning("remote malware scanner unavailable; falling back locally", extra={"status": response.status_code})
        except PipelineError:
            raise
        except (httpx.HTTPError, ValueError) as error:
            LOGGER.warning("remote malware scanner request failed; falling back locally", extra={"error": type(error).__name__})
    else:
        LOGGER.warning("remote malware scanner is not configured; falling back locally")
    return local_malware_scan(path)
'''
text, count = re.subn(
    r"def malware_scan\(path: Path, content_type: str\) -> dict\[str, Any\]:.*?(?=\ndef convert\()",
    malware + "\n",
    text,
    flags=re.S,
)
if count != 1:
    raise SystemExit(f"Expected one malware_scan replacement, got {count}")

convert = '''def convert(path: Path, file_name: str, content_type: str, source_hash: str) -> tuple[dict[str, Any], bytes]:
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
            "Docling conversion failed; using lightweight extractor",
            extra={"file_name": file_name, "error": type(error).__name__},
        )
        return lightweight_convert(path, file_name, content_type, source_hash)
'''
text, count = re.subn(
    r"def convert\(path: Path, file_name: str, content_type: str, source_hash: str\) -> tuple\[dict\[str, Any\], bytes\]:.*?(?=\ndef persist_public\()",
    convert + "\n",
    text,
    flags=re.S,
)
if count != 1:
    raise SystemExit(f"Expected one convert replacement, got {count}")

text = text.replace(
    '"artifact_type": "docling_json",',
    '"artifact_type": "docling_json" if canonical["engine"]["name"] == "docling" else "lightweight_json",',
)
text = text.replace(".docling.json", ".canonical.json")
text = text.replace(
    '"format": "DOCLING_JSON",',
    '"format": "DOCLING_JSON" if canonical["engine"]["name"] == "docling" else "LIGHTWEIGHT_JSON",',
)
text = text.replace(
    '"parser_state": "indexed",\n        "canonical_artifact_id": artifact_id,',
    '"parser_state": "indexed",\n        "parser_engine": canonical["engine"]["name"],\n        "canonical_artifact_id": artifact_id,',
)
text = text.replace(
    'metadata.update({"parser": "docling", "parser_state": "indexed", "canonical_artifact_hash": artifact_hash})',
    'metadata.update({"parser": canonical["engine"]["name"], "parser_state": "indexed", "canonical_artifact_hash": artifact_hash})',
)
worker.write_text(text)

pipeline = Path("services/docling/pipeline.py")
text = pipeline.read_text()
text = text.replace('"source": "docling",', '"source": str(node.get("_source") or "docling"),')
text = text.replace(
    '"metadata": {"docling_label": node.get("label")},',
    '"metadata": {"docling_label": node.get("label"), "extractor": str(node.get("_source") or "docling")},',
)
pipeline.write_text(text)
