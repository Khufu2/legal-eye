from __future__ import annotations

import argparse
import hashlib
import html
import json
import logging
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import PurePosixPath
from typing import Any
from urllib.parse import quote

import httpx

LOGGER = logging.getLogger("legal-eye-open-corpus")
USER_AGENT = "LegalEye/0.5 governed-open-corpus-worker"


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def enc(value: Any) -> str:
    return quote(str(value), safe="")


class Api:
    def __init__(self, url: str, secret: str):
        self.url = url.rstrip("/")
        self.secret = secret
        self.client = httpx.Client(timeout=httpx.Timeout(90, connect=12), headers={"user-agent": USER_AGENT})

    def headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        headers = {"apikey": self.secret}
        if not self.secret.startswith("sb_"):
            headers["authorization"] = f"Bearer {self.secret}"
        if extra:
            headers.update(extra)
        return headers

    def request(self, method: str, path: str, *, json_body: Any = None, prefer: str | None = None) -> Any:
        headers = self.headers({"content-type": "application/json"} if json_body is not None else {})
        if prefer:
            headers["Prefer"] = prefer
        response = self.client.request(method, f"{self.url}/rest/v1/{path}", headers=headers, json=json_body)
        text = response.text
        if response.status_code >= 400:
            raise RuntimeError(f"Supabase {method} {path} failed: {response.status_code} {text[:240]}")
        return json.loads(text) if text else None

    def rows(self, table: str, query: str) -> list[dict[str, Any]]:
        return self.request("GET", f"{table}?{query}") or []

    def upsert(self, table: str, conflict: str, rows: list[dict[str, Any]], return_representation: bool = False) -> list[dict[str, Any]]:
        if not rows:
            return []
        prefer = "resolution=merge-duplicates,return=representation" if return_representation else "resolution=merge-duplicates,return=minimal"
        result = self.request("POST", f"{table}?on_conflict={enc(conflict)}", json_body=rows, prefer=prefer)
        return result or []

    def patch(self, table: str, query: str, body: dict[str, Any]) -> None:
        self.request("PATCH", f"{table}?{query}", json_body=body, prefer="return=minimal")

    def delete(self, table: str, query: str) -> None:
        self.request("DELETE", f"{table}?{query}", prefer="return=minimal")

    def close(self) -> None:
        self.client.close()


def strip_markup(raw: str) -> str:
    value = re.sub(r"<!DOCTYPE[\s\S]*?(?:\]>|>)", " ", raw, flags=re.I)
    value = re.sub(r"<!--.*?-->", " ", value, flags=re.S)
    value = re.sub(r"<(script|style)\b[^>]*>.*?</\1>", " ", value, flags=re.I | re.S)
    value = re.sub(r"</(?:p|div|section|article|h\d|li|tr|table|br|subsection|section|provision|marginalnote|heading)>\s*", "\n", value, flags=re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    value = html.unescape(value)
    value = re.sub(r"&[A-Za-z][A-Za-z0-9]+;", " ", value)
    lines = [re.sub(r"\s+", " ", line).strip() for line in value.splitlines()]
    return "\n".join(line for line in lines if line)


def chunk_text(text: str, max_chars: int = 2600) -> list[str]:
    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
    chunks: list[str] = []
    current = ""
    for paragraph in paragraphs:
        if len(paragraph) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            for start in range(0, len(paragraph), max_chars):
                piece = paragraph[start:start + max_chars].strip()
                if piece:
                    chunks.append(piece)
            continue
        candidate = f"{current}\n{paragraph}".strip() if current else paragraph
        if len(candidate) <= max_chars:
            current = candidate
        else:
            chunks.append(current)
            current = paragraph
    if current:
        chunks.append(current)
    return chunks


def title_from_markup(raw: str, fallback: str) -> str:
    patterns = [r"<ShortTitle[^>]*>(.*?)</ShortTitle>", r"<LongTitle[^>]*>(.*?)</LongTitle>", r"<TitleText[^>]*>(.*?)</TitleText>", r"<title[^>]*>(.*?)</title>"]
    for pattern in patterns:
        match = re.search(pattern, raw, flags=re.I | re.S)
        if match:
            value = strip_markup(match.group(1))
            if value:
                return value[:500]
    return fallback


def source_policy(api: Api, adapter: str) -> dict[str, Any] | None:
    rows = api.rows("source_registry", f"select=*&adapter_key=eq.{enc(adapter)}&sync_enabled=is.true&policy_state=eq.approved&limit=1")
    if not rows:
        return None
    source = rows[0]
    required = ["discovery_allowed", "individual_retrieval_allowed", "bulk_ingestion_allowed", "permanent_storage_allowed", "computational_analysis_allowed", "commercial_display_allowed"]
    if not all(source.get(key) is True for key in required):
        raise RuntimeError(f"Source policy gate rejected {adapter}")
    return source


def get_cursor(api: Api, source_id: str) -> dict[str, Any]:
    rows = api.rows("source_sync_cursors", f"select=cursor&source_id=eq.{enc(source_id)}&limit=1")
    return dict((rows[0].get("cursor") if rows else {}) or {})


def set_cursor(api: Api, source_id: str, cursor: dict[str, Any]) -> None:
    api.upsert("source_sync_cursors", "source_id", [{"source_id": source_id, "cursor": cursor, "consecutive_failures": 0, "updated_at": now()}])
    api.patch("source_registry", f"id=eq.{enc(source_id)}", {"last_synced_at": now()})


def persist_document(api: Api, source: dict[str, Any], *, external_id: str, canonical_url: str, jurisdiction: str,
                     document_type: str, title: str, citation: str | None, published_at: str | None,
                     raw: str, media_type: str, metadata: dict[str, Any]) -> tuple[str, int]:
    raw_bytes = raw.encode("utf-8", errors="replace")
    content_hash = sha256(raw_bytes)
    existing = api.rows("legal_documents", f"select=id,content_hash&source_id=eq.{enc(source['id'])}&canonical_source_id=eq.{enc(external_id)}&limit=1")
    if existing and existing[0].get("content_hash") == content_hash:
        chunks = api.rows("legal_document_chunks", f"select=id&legal_document_id=eq.{enc(existing[0]['id'])}&limit=1")
        if chunks:
            return str(existing[0]["id"]), 0
    text = strip_markup(raw)
    pieces = chunk_text(text)
    if not pieces:
        raise RuntimeError(f"No searchable text extracted from {canonical_url}")
    values = {
        "source_id": source["id"], "canonical_source_id": external_id, "canonical_url": canonical_url,
        "jurisdiction_code": jurisdiction, "document_type": document_type, "title": title[:500], "citation": citation,
        "published_at": published_at, "current_status": "published", "version_label": "official current expression",
        "language": "en", "structured_content": {"format": "OFFICIAL_STRUCTURED_TEXT", "hierarchy_preserved": False,
        "parser_state": "indexed", "parser_engine": "open-corpus-worker", "searchable_chunk_count": len(pieces)},
        "content_hash": content_hash, "retrieved_at": now(), "updated_at": now(),
        "metadata": {**metadata, "source": source["name"], "attribution": source.get("attribution_text"), "licence": source.get("license_name")},
    }
    rows = api.upsert("legal_documents", "source_id,canonical_source_id", [values], return_representation=True)
    document_id = str(rows[0]["id"])
    source_rows = api.upsert("source_ingest_objects", "source_id,external_id,content_sha256", [{
        "source_id": source["id"], "external_id": external_id, "canonical_url": canonical_url, "media_type": media_type,
        "source_published_at": published_at, "content_sha256": content_hash, "byte_size": len(raw_bytes),
        "raw_content": raw if len(raw_bytes) <= 4_000_000 else None,
        "headers": {}, "provenance": {"retrieved_by": "open-corpus-worker", **metadata}, "processing_state": "indexed",
    }], return_representation=True)
    source_object_id = source_rows[0]["id"] if source_rows else None
    api.delete("legal_document_chunks", f"legal_document_id=eq.{enc(document_id)}")
    batch: list[dict[str, Any]] = []
    for index, piece in enumerate(pieces):
        batch.append({"legal_document_id": document_id, "source_node_ref": f"#/texts/{index}", "node_type": "text",
                      "reading_order": index, "content": piece, "token_count": max(1, len(piece) // 4), "language_code": "en",
                      "extraction_confidence": 0.97, "metadata": {"source_object_id": source_object_id, "parser": "open-corpus-worker"}})
        if len(batch) == 100:
            api.request("POST", "legal_document_chunks", json_body=batch, prefer="return=minimal")
            batch = []
    if batch:
        api.request("POST", "legal_document_chunks", json_body=batch, prefer="return=minimal")
    try:
        api.upsert("authorities", "canonical_key", [{"legal_document_id": document_id, "canonical_key": f"legal-document:{document_id}",
            "name": title[:500], "authority_type": "legislation", "jurisdiction_code": jurisdiction, "strength": "binding",
            "metadata": {"citation": citation, "canonical_url": canonical_url}}])
    except Exception:
        LOGGER.exception("authority upsert failed", extra={"legal_document_id": document_id})
    return document_id, len(pieces)


def canada_entries(client: httpx.Client) -> tuple[str, list[dict[str, Any]]]:
    response = client.get("https://api.github.com/repos/justicecanada/laws-lois-xml/git/trees/main?recursive=1",
                          headers={"accept": "application/vnd.github+json", "user-agent": USER_AGENT})
    response.raise_for_status()
    payload = response.json()
    paths = [item for item in payload.get("tree", []) if item.get("type") == "blob" and re.match(r"^eng/(acts|regulations)/.+\.xml$", str(item.get("path", "")), re.I)]
    paths.sort(key=lambda item: str(item.get("path", "")))
    return str(payload.get("sha") or "main"), paths


def process_canada(api: Api, source: dict[str, Any], limit: int) -> int:
    cursor = get_cursor(api, source["id"])
    tree_sha, entries = canada_entries(api.client)
    if cursor.get("complete") and cursor.get("tree_sha") == tree_sha:
        return 0
    offset = int(cursor.get("offset", 0)) if cursor.get("tree_sha") == tree_sha else 0
    selected = entries[offset:offset + limit]
    completed = 0
    for item in selected:
        path = str(item["path"])
        raw_url = f"https://raw.githubusercontent.com/justicecanada/laws-lois-xml/main/{path}"
        response = api.client.get(raw_url, headers={"accept": "application/xml", "user-agent": USER_AGENT})
        response.raise_for_status()
        raw = response.text
        stem = PurePosixPath(path).stem
        doc_type = "act" if "/acts/" in f"/{path}" else "regulation"
        title = title_from_markup(raw, f"Canada federal {doc_type} {stem}")
        persist_document(api, source, external_id=f"justicecanada:{path}", canonical_url=raw_url, jurisdiction="CA",
                         document_type=doc_type, title=title, citation=None, published_at=None, raw=raw,
                         media_type="application/xml", metadata={"repository": "justicecanada/laws-lois-xml", "path": path,
                         "blob_sha": item.get("sha"), "accuracy_notice": "Reproduction is not represented as an official version"})
        completed += 1
    next_offset = offset + len(selected)
    set_cursor(api, source["id"], {"tree_sha": tree_sha, "offset": next_offset, "total": len(entries), "complete": next_offset >= len(entries)})
    return completed


def pick(item: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in item and item[key] not in (None, ""):
            return item[key]
        lower = key[:1].lower() + key[1:]
        if lower in item and item[lower] not in (None, ""):
            return item[lower]
    return None


def process_australia(api: Api, source: dict[str, Any], limit: int) -> int:
    cursor = get_cursor(api, source["id"])
    offset = int(cursor.get("offset", 0))
    params = {"$top": str(limit), "$skip": str(offset)}
    response = api.client.get("https://api.prod.legislation.gov.au/v1/titles", params=params,
                              headers={"accept": "application/json", "user-agent": USER_AGENT})
    response.raise_for_status()
    payload = response.json()
    entries = payload.get("value") if isinstance(payload, dict) else payload
    if not isinstance(entries, list):
        raise RuntimeError("Australia Titles API returned an unexpected payload")
    completed = 0
    for item in entries:
        if not isinstance(item, dict):
            continue
        register_id = pick(item, "RegisterId", "Id", "TitleId")
        title = pick(item, "Name", "Title", "ShortTitle", "DisplayName")
        if not register_id or not title:
            continue
        canonical_url = f"https://www.legislation.gov.au/{register_id}/latest/text"
        document = api.client.get(canonical_url, headers={"accept": "text/html", "user-agent": USER_AGENT}, follow_redirects=True)
        if document.status_code >= 400:
            LOGGER.warning("Australia text unavailable", extra={"register_id": register_id, "status": document.status_code})
            continue
        raw = document.text
        doc_type = str(pick(item, "Collection", "Type", "TitleType") or "legislation").lower().replace(" ", "_")
        published = pick(item, "LastUpdated", "DateMade", "Start", "AsMadeDate")
        citation = str(register_id)
        persist_document(api, source, external_id=f"australia:{register_id}", canonical_url=canonical_url, jurisdiction="AU",
                         document_type=doc_type, title=str(title), citation=citation, published_at=str(published) if published else None,
                         raw=raw, media_type="text/html", metadata={"register_id": register_id, "api_record": item,
                         "reuse_notice": "CC BY 4.0; attribution required"})
        completed += 1
    next_offset = offset + len(entries)
    set_cursor(api, source["id"], {"offset": next_offset, "batch_size": limit, "complete": len(entries) < limit})
    return completed


def run(limit: int) -> int:
    base_url = os.environ.get("SUPABASE_URL", "").strip()
    secret = (os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not base_url or not secret:
        raise SystemExit("SUPABASE_URL and SUPABASE_SECRET_KEY are required")
    api = Api(base_url, secret)
    processed = 0
    try:
        sources = [("canada_justice_xml", process_canada), ("australia_register", process_australia)]
        each = max(1, limit // len(sources))
        for adapter, handler in sources:
            source = source_policy(api, adapter)
            if not source:
                LOGGER.info("source not enabled", extra={"adapter": adapter})
                continue
            try:
                count = handler(api, source, each)
                processed += count
                LOGGER.info("source batch complete", extra={"adapter": adapter, "processed": count})
            except Exception:
                LOGGER.exception("source batch failed", extra={"adapter": adapter})
        return processed
    finally:
        api.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest approved structured Commonwealth legal corpora")
    parser.add_argument("--limit", type=int, default=40)
    args = parser.parse_args()
    logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")
    total = run(max(2, min(args.limit, 100)))
    LOGGER.info("open corpus batch complete", extra={"processed": total})


if __name__ == "__main__":
    main()
