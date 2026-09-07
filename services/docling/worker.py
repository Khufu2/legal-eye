"""Durable, fail-closed Docling queue worker for public and private documents."""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import socket
import tempfile
import threading
from pathlib import Path
from typing import Any
from urllib.parse import quote, urljoin, urlparse

import httpx

from pipeline import PipelineError, batches, extract_docling_chunks, sha256_bytes, validate_download, validate_source_url


LOGGER = logging.getLogger("legal_eye.docling_worker")
MAX_BYTES = int(os.environ.get("DOCLING_MAX_UPLOAD_BYTES", str(100 * 1024 * 1024)))
LEASE_SECONDS = int(os.environ.get("DOCLING_LEASE_SECONDS", "900"))
HEARTBEAT_SECONDS = int(os.environ.get("DOCLING_HEARTBEAT_SECONDS", "30"))


def encoded(value: Any) -> str:
    return quote(str(value), safe="")


class SupabaseApi:
    def __init__(self, base_url: str, secret_key: str) -> None:
        self.base_url = base_url.rstrip("/")
        headers = {"apikey": secret_key}
        if not secret_key.startswith("sb_"):
            headers["authorization"] = f"Bearer {secret_key}"
        self.client = httpx.Client(
            timeout=httpx.Timeout(60, connect=10),
            headers=headers,
        )

    def close(self) -> None:
        self.client.close()

    def request(self, method: str, path: str, **kwargs: Any) -> Any:
        response = self.client.request(method, f"{self.base_url}{path}", **kwargs)
        if response.status_code >= 400:
            raise PipelineError(
                "supabase_request_failed",
                f"Supabase operation failed ({response.status_code})",
                response.status_code >= 500 or response.status_code == 429,
            )
        if not response.content:
            return None
        return response.json()

    def rows(self, table: str, query: str) -> list[dict[str, Any]]:
        result = self.request("GET", f"/rest/v1/{table}?{query}")
        return result if isinstance(result, list) else []

    def patch(self, table: str, query: str, values: dict[str, Any]) -> None:
        self.request(
            "PATCH",
            f"/rest/v1/{table}?{query}",
            json=values,
            headers={"content-type": "application/json", "Prefer": "return=minimal"},
        )

    def delete(self, table: str, query: str) -> None:
        self.request("DELETE", f"/rest/v1/{table}?{query}", headers={"Prefer": "return=minimal"})

    def upsert(self, table: str, conflict: str, values: list[dict[str, Any]]) -> list[dict[str, Any]]:
        result = self.request(
            "POST",
            f"/rest/v1/{table}?on_conflict={conflict}",
            json=values,
            headers={
                "content-type": "application/json",
                "Prefer": "resolution=merge-duplicates,return=representation",
            },
        )
        return result if isinstance(result, list) else []

    def claim(self, worker_id: str, job_types: list[str], limit: int) -> list[dict[str, Any]]:
        result = self.request(
            "POST",
            "/rest/v1/rpc/claim_ingestion_jobs",
            json={
                "p_worker_id": worker_id,
                "p_job_types": job_types,
                "p_limit": limit,
                "p_lease_seconds": LEASE_SECONDS,
            },
        )
        return result if isinstance(result, list) else []

    def heartbeat(self, job_id: str, lease_token: str) -> bool:
        return bool(self.request(
            "POST",
            "/rest/v1/rpc/heartbeat_ingestion_job",
            json={"p_job_id": job_id, "p_lease_token": lease_token, "p_extend_seconds": LEASE_SECONDS},
        ))

    def complete(self, job_id: str, lease_token: str) -> bool:
        return bool(self.request(
            "POST",
            "/rest/v1/rpc/complete_ingestion_job",
            json={"p_job_id": job_id, "p_lease_token": lease_token},
        ))

    def fail(self, job_id: str, lease_token: str, error: PipelineError) -> str:
        result = self.request(
            "POST",
            "/rest/v1/rpc/fail_ingestion_job",
            json={
                "p_job_id": job_id,
                "p_lease_token": lease_token,
                "p_error_code": error.code,
                "p_error_message": error.message,
                "p_retryable": error.retryable,
            },
        )
        return str(result)

    def storage_download(self, bucket: str, path: str, target: Path) -> tuple[str, str]:
        encoded_path = "/".join(encoded(part) for part in path.split("/"))
        with self.client.stream("GET", f"{self.base_url}/storage/v1/object/{encoded(bucket)}/{encoded_path}") as response:
            if response.status_code >= 400:
                raise PipelineError("source_object_unavailable", "Private source object is unavailable", response.status_code >= 500)
            digest = hashlib.sha256()
            byte_count = 0
            first = b""
            with target.open("wb") as output:
                for block in response.iter_bytes(1024 * 1024):
                    byte_count += len(block)
                    if byte_count > MAX_BYTES:
                        raise PipelineError("source_too_large", "Source exceeds the parser size limit", False)
                    if len(first) < 16:
                        first += block[: 16 - len(first)]
                    digest.update(block)
                    output.write(block)
            return digest.hexdigest(), response.headers.get("content-type", "application/octet-stream")

    def storage_upload(self, bucket: str, path: str, content: bytes, content_type: str) -> None:
        encoded_path = "/".join(encoded(part) for part in path.split("/"))
        self.request(
            "POST",
            f"/storage/v1/object/{encoded(bucket)}/{encoded_path}",
            content=content,
            headers={"content-type": content_type, "x-upsert": "true"},
        )


class LeaseHeartbeat:
    def __init__(self, api: SupabaseApi, job_id: str, lease_token: str) -> None:
        self.api = api
        self.job_id = job_id
        self.lease_token = lease_token
        self.stop_event = threading.Event()
        self.lost = threading.Event()
        self.thread = threading.Thread(target=self._run, daemon=True)

    def _run(self) -> None:
        while not self.stop_event.wait(HEARTBEAT_SECONDS):
            try:
                if not self.api.heartbeat(self.job_id, self.lease_token):
                    self.lost.set()
                    return
            except Exception:
                LOGGER.exception("heartbeat failed", extra={"job_id": self.job_id})

    def __enter__(self) -> "LeaseHeartbeat":
        self.thread.start()
        return self

    def __exit__(self, *_: Any) -> None:
        self.stop_event.set()
        self.thread.join(timeout=5)


def download_public_source(url: str, allowed_host: str, target: Path) -> tuple[str, str, str]:
    current = validate_source_url(url, allowed_host)
    digest = hashlib.sha256()
    first = b""
    byte_count = 0
    content_type = "application/octet-stream"
    with httpx.Client(timeout=httpx.Timeout(90, connect=10), follow_redirects=False) as client:
        for _ in range(4):
            with client.stream("GET", current, headers={"user-agent": "LegalEye/0.2 governed-corpus-worker"}) as response:
                if response.status_code in {301, 302, 303, 307, 308}:
                    location = response.headers.get("location")
                    if not location:
                        raise PipelineError("invalid_redirect", "Upstream redirect omitted its destination", False)
                    current = validate_source_url(urljoin(current, location), allowed_host)
                    continue
                if response.status_code >= 400:
                    raise PipelineError(
                        "upstream_fetch_failed",
                        f"Approved source returned {response.status_code}",
                        response.status_code >= 500 or response.status_code == 429,
                    )
                content_type = response.headers.get("content-type", content_type)
                with target.open("wb") as output:
                    for block in response.iter_bytes(1024 * 1024):
                        byte_count += len(block)
                        if byte_count > MAX_BYTES:
                            raise PipelineError("source_too_large", "Source exceeds the parser size limit", False)
                        if len(first) < 16:
                            first += block[: 16 - len(first)]
                        digest.update(block)
                        output.write(block)
                validate_download(content_type, first, urlparse(current).path)
                return digest.hexdigest(), content_type, current
    raise PipelineError("redirect_limit", "Upstream exceeded the redirect limit", False)


def malware_scan(path: Path, content_type: str) -> dict[str, Any]:
    scanner_url = os.environ.get("MALWARE_SCANNER_URL")
    if not scanner_url:
        raise PipelineError("scanner_unconfigured", "Malware scanner is not configured; job remains safely queued")
    headers: dict[str, str] = {}
    if token := os.environ.get("MALWARE_SCANNER_TOKEN"):
        headers["authorization"] = f"Bearer {token}"
    with path.open("rb") as source:
        response = httpx.post(
            scanner_url,
            files={"file": (path.name, source, content_type)},
            headers=headers,
            timeout=120,
        )
    if response.status_code >= 500 or response.status_code == 429:
        raise PipelineError("scanner_unavailable", "Malware scanner is temporarily unavailable")
    if response.status_code >= 400:
        raise PipelineError("scanner_rejected", "Malware scanner rejected the source", False)
    result = response.json()
    if result.get("clean") is not True:
        raise PipelineError("malware_detected", "Source failed malware validation", False)
    return {"scanner": result.get("scanner", "configured-service"), "signature": result.get("signature")}


def convert(path: Path, file_name: str, content_type: str, source_hash: str) -> tuple[dict[str, Any], bytes]:
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
        },
    }
    encoded_payload = json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8")
    return payload, encoded_payload


def persist_public(
    api: SupabaseApi,
    job: dict[str, Any],
    legal_document: dict[str, Any],
    source_object: dict[str, Any] | None,
    canonical: dict[str, Any],
    artifact_bytes: bytes,
    source_hash: str,
    scan: dict[str, Any],
) -> int:
    artifact_hash = sha256_bytes(artifact_bytes)
    legal_document_id = legal_document["id"]
    path = f"public/{legal_document.get('jurisdiction_code') or 'ZZ'}/{legal_document_id}/{artifact_hash}.docling.json"
    api.storage_upload("legal-corpus-artifacts", path, artifact_bytes, "application/json")
    api.patch("legal_document_artifacts", f"legal_document_id=eq.{encoded(legal_document_id)}&is_canonical=is.true", {"is_canonical": False})
    artifacts = api.upsert("legal_document_artifacts", "legal_document_id,artifact_type,content_hash", [{
        "legal_document_id": legal_document_id,
        "source_object_id": source_object.get("id") if source_object else None,
        "ingestion_job_id": job["id"],
        "artifact_type": "docling_json",
        "schema_version": canonical["schema"],
        "engine_name": canonical["engine"]["name"],
        "engine_version": canonical["engine"]["version"],
        "content_hash": artifact_hash,
        "source_content_hash": source_hash,
        "storage_path": path,
        "byte_size": len(artifact_bytes),
        "confidence": canonical["provenance"].get("confidence") or {},
        "ocr_provenance": scan,
        "provenance": {"job_id": job["id"], "source_url": canonical["source"].get("resolved_url")},
        "is_canonical": True,
    }])
    if not artifacts:
        raise PipelineError("artifact_persistence_failed", "Canonical artifact was not persisted")
    artifact_id = artifacts[0]["id"]
    chunks = extract_docling_chunks(canonical["document"], legal_document.get("language"))
    api.delete("legal_document_chunks", f"artifact_id=eq.{encoded(artifact_id)}")
    for group in batches(chunks):
        api.upsert("legal_document_chunks", "artifact_id,source_node_ref", [
            {**chunk, "legal_document_id": legal_document_id, "artifact_id": artifact_id} for chunk in group
        ])
    structured = dict(legal_document.get("structured_content") or {})
    structured.update({
        "format": "DOCLING_JSON",
        "hierarchy_preserved": True,
        "parser_state": "indexed",
        "canonical_artifact_id": artifact_id,
        "searchable_chunk_count": len(chunks),
    })
    api.patch("legal_documents", f"id=eq.{encoded(legal_document_id)}", {"structured_content": structured})
    if source_object:
        api.patch("source_ingest_objects", f"id=eq.{encoded(source_object['id'])}", {
            "processing_state": "indexed",
            "storage_path": path,
        })
    return len(chunks)


def persist_private(
    api: SupabaseApi,
    job: dict[str, Any],
    document: dict[str, Any],
    canonical: dict[str, Any],
    artifact_bytes: bytes,
    source_hash: str,
    scan: dict[str, Any],
) -> int:
    artifact_hash = sha256_bytes(artifact_bytes)
    path = f"{document['organization_id']}/.artifacts/{document['id']}/{artifact_hash}.docling.json"
    api.storage_upload("firm-vault", path, artifact_bytes, "application/json")
    api.patch("document_ingestion_artifacts", f"document_id=eq.{encoded(document['id'])}&is_canonical=is.true", {"is_canonical": False})
    artifacts = api.upsert("document_ingestion_artifacts", "document_id,artifact_type,content_hash", [{
        "document_id": document["id"],
        "ingestion_job_id": job["id"],
        "artifact_type": "docling_json",
        "schema_version": canonical["schema"],
        "engine_name": canonical["engine"]["name"],
        "engine_version": canonical["engine"]["version"],
        "content_hash": artifact_hash,
        "storage_path": path,
        "byte_size": len(artifact_bytes),
        "confidence": canonical["provenance"].get("confidence") or {},
        "provenance": {"source_sha256": source_hash, "malware_scan": scan},
        "is_canonical": True,
    }])
    if not artifacts:
        raise PipelineError("artifact_persistence_failed", "Canonical artifact was not persisted")
    artifact_id = artifacts[0]["id"]
    chunks = extract_docling_chunks(canonical["document"])
    api.delete("document_chunks", f"source_artifact_id=eq.{encoded(artifact_id)}")
    for group in batches(chunks):
        rows = [{
            "document_id": document["id"],
            "source_artifact_id": artifact_id,
            "source_node_ref": chunk["source_node_ref"],
            "bounding_boxes": chunk["bounding_boxes"],
            "reading_order": chunk["reading_order"],
            "page_number": chunk["page_number"],
            "content": chunk["content"],
            "extraction_confidence": chunk["extraction_confidence"],
            "ocr_provenance": chunk["ocr_provenance"],
            "metadata": chunk["metadata"],
        } for chunk in group]
        api.request("POST", "/rest/v1/document_chunks", json=rows, headers={"Prefer": "return=minimal"})
    metadata = dict(document.get("metadata") or {})
    metadata.update({"parser": "docling", "parser_state": "indexed", "canonical_artifact_hash": artifact_hash})
    api.patch("documents", f"id=eq.{encoded(document['id'])}", {
        "status": "indexed",
        "content_hash": source_hash,
        "metadata": metadata,
    })
    return len(chunks)


def process_job(api: SupabaseApi, job: dict[str, Any]) -> int:
    payload = job.get("payload") or {}
    with tempfile.TemporaryDirectory(prefix="legal-eye-docling-") as directory:
        file_name = str(payload.get("file_name") or "document.pdf")
        source_path = Path(directory) / Path(file_name).name
        if job.get("job_type") == "docling_parse":
            documents = api.rows(
                "documents",
                f"id=eq.{encoded(job.get('document_id'))}&select=id,organization_id,storage_path,mime_type,file_name,metadata&limit=1",
            )
            if not documents:
                raise PipelineError("private_document_missing", "Private document no longer exists", False)
            document = documents[0]
            source_hash, content_type = api.storage_download("firm-vault", document["storage_path"], source_path)
            with source_path.open("rb") as source:
                first_bytes = source.read(16)
            validate_download(content_type, first_bytes, document.get("file_name") or file_name)
            scan = malware_scan(source_path, content_type)
            canonical, artifact_bytes = convert(source_path, document.get("file_name") or file_name, content_type, source_hash)
            return persist_private(api, job, document, canonical, artifact_bytes, source_hash, scan)

        source_id = job.get("source_id")
        external_id = payload.get("external_id")
        if not source_id or not external_id:
            raise PipelineError("invalid_public_job", "Public ingestion job lacks source identity", False)
        sources = api.rows(
            "source_registry",
            f"id=eq.{encoded(source_id)}&select=id,base_url,policy_state,individual_retrieval_allowed,permanent_storage_allowed,computational_analysis_allowed,commercial_display_allowed&limit=1",
        )
        if not sources:
            raise PipelineError("source_missing", "Source registry entry is unavailable", False)
        source = sources[0]
        required = (
            source.get("policy_state") == "approved"
            and source.get("individual_retrieval_allowed") is True
            and source.get("permanent_storage_allowed") is True
            and source.get("computational_analysis_allowed") is True
            and source.get("commercial_display_allowed") is True
        )
        if not required:
            raise PipelineError("source_policy_blocked", "Source policy does not permit this processing stage", False)
        allowed_host = urlparse(source["base_url"]).hostname or ""
        source_hash, content_type, resolved_url = download_public_source(payload["download_url"], allowed_host, source_path)
        scan = malware_scan(source_path, content_type)
        canonical, artifact_bytes = convert(source_path, file_name, content_type, source_hash)
        canonical["source"]["resolved_url"] = resolved_url
        artifact_bytes = json.dumps(canonical, separators=(",", ":"), default=str).encode("utf-8")
        documents = api.rows(
            "legal_documents",
            f"source_id=eq.{encoded(source_id)}&canonical_source_id=eq.{encoded(external_id)}&select=id,jurisdiction_code,language,structured_content&limit=1",
        )
        if not documents:
            raise PipelineError("legal_document_missing", "Canonical legal document is unavailable", False)
        objects = api.rows(
            "source_ingest_objects",
            f"source_id=eq.{encoded(source_id)}&external_id=eq.{encoded(external_id)}&select=id,content_sha256&order=retrieved_at.desc&limit=1",
        )
        return persist_public(api, job, documents[0], objects[0] if objects else None, canonical, artifact_bytes, source_hash, scan)


def run(limit: int, job_types: list[str]) -> int:
    base_url = os.environ.get("SUPABASE_URL", "").strip()
    secret_key = (os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not base_url or not secret_key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SECRET_KEY are required")
    if secret_key.startswith("sb_publishable_"):
        raise SystemExit("SUPABASE_SECRET_KEY must be a backend secret key, not a publishable key")
    if not os.environ.get("MALWARE_SCANNER_URL"):
        raise SystemExit("MALWARE_SCANNER_URL is required; refusing to claim documents without malware scanning")
    worker_id = os.environ.get("DOCLING_WORKER_ID") or f"{socket.gethostname()}:{os.getpid()}"
    api = SupabaseApi(base_url, secret_key)
    processed = 0
    try:
        for job in api.claim(worker_id, job_types, limit):
            job_id = str(job["id"])
            lease_token = str(job["lease_token"])
            try:
                with LeaseHeartbeat(api, job_id, lease_token) as heartbeat:
                    chunk_count = process_job(api, job)
                    if heartbeat.lost.is_set() or not api.complete(job_id, lease_token):
                        raise PipelineError("lease_lost", "Worker lease was lost before completion")
                    LOGGER.info("job completed", extra={"job_id": job_id, "chunks": chunk_count})
                    processed += 1
            except PipelineError as error:
                state = api.fail(job_id, lease_token, error)
                LOGGER.warning("job failed", extra={"job_id": job_id, "error_code": error.code, "state": state})
            except Exception as error:
                LOGGER.exception("unexpected job failure", extra={"job_id": job_id})
                api.fail(job_id, lease_token, PipelineError("unexpected_worker_error", str(error)))
    finally:
        api.close()
    return processed


def main() -> None:
    parser = argparse.ArgumentParser(description="Drain a bounded Legal Eye Docling batch")
    parser.add_argument("--limit", type=int, default=1)
    parser.add_argument(
        "--job-types",
        default="official_pdf_fetch_parse,docling_parse",
        help="Comma-separated allowlist of job types",
    )
    args = parser.parse_args()
    logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")
    count = run(max(1, min(args.limit, 10)), [value.strip() for value in args.job_types.split(",") if value.strip()])
    LOGGER.info("batch complete", extra={"processed": count})


if __name__ == "__main__":
    main()
