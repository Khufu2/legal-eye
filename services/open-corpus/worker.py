from __future__ import annotations

import argparse
import hashlib
import html
import json
import logging
import os
import re
import sys
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from pathlib import PurePosixPath
from typing import Any
from urllib.parse import quote, urlparse

import httpx

LOGGER = logging.getLogger("legal-eye-open-corpus")
USER_AGENT = "LOCKE/0.6 governed-open-corpus-worker"
MAX_SOURCE_BYTES = int(os.environ.get("OPEN_CORPUS_MAX_SOURCE_BYTES", str(6 * 1024 * 1024)))
EURLEX_SCOPE_VERSION = "primary-law-sectors-1-4-v1"


class SourceDocumentTooLarge(RuntimeError):
    pass


class SourceNotReady(RuntimeError):
    """The source accepted the request but did not supply a document yet."""
    def __init__(self, status: int):
        self.status = status
        super().__init__(f"Source returned HTTP {status} without a completed document")


def fetch_text_limited(client: httpx.Client, url: str, *, headers: dict[str, str], follow_redirects: bool = False) -> tuple[int, dict[str, str], str]:
    with client.stream("GET", url, headers=headers, follow_redirects=follow_redirects) as response:
        if response.status_code >= 400:
            return response.status_code, dict(response.headers), ""
        declared = response.headers.get("content-length")
        if declared and declared.isdigit() and int(declared) > MAX_SOURCE_BYTES:
            raise SourceDocumentTooLarge(f"source body exceeds {MAX_SOURCE_BYTES} bytes")
        body = bytearray()
        for chunk in response.iter_bytes():
            body.extend(chunk)
            if len(body) > MAX_SOURCE_BYTES:
                raise SourceDocumentTooLarge(f"source body exceeds {MAX_SOURCE_BYTES} bytes")
        encoding = response.encoding or "utf-8"
        return response.status_code, dict(response.headers), bytes(body).decode(encoding, errors="replace")


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
    api.upsert("source_sync_cursors", "source_id", [{"source_id": source_id, "cursor": cursor, "consecutive_failures": 0, "next_attempt_at": None, "updated_at": now()}])
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
        "published_at": published_at, "current_status": "published", "version_label": metadata.get("version_label", "Source version retrieved " + now()[:10]),
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
    chunk_rows: list[dict[str, Any]] = []
    for index, piece in enumerate(pieces):
        chunk_rows.append({"source_node_ref": f"#/texts/{index}", "node_type": "text",
                           "reading_order": index, "content": piece, "token_count": max(1, len(piece) // 4),
                           "language_code": "en", "extraction_confidence": 0.97,
                           "metadata": {"source_object_id": source_object_id, "parser": "open-corpus-worker"}})
    replaced = api.request("POST", "rpc/replace_open_corpus_chunks",
                           json_body={"p_document_id": document_id, "p_chunks": chunk_rows})
    if int(replaced or 0) != len(chunk_rows):
        raise RuntimeError(f"Chunk replacement count mismatch for {document_id}: {replaced} != {len(chunk_rows)}")
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


ATOM = {"a": "http://www.w3.org/2005/Atom"}


def uk_url(value: str) -> str:
    value = value.replace("http://", "https://", 1)
    parsed = urlparse(value)
    if parsed.scheme != "https" or parsed.hostname != "www.legislation.gov.uk" or parsed.username or parsed.password:
        raise ValueError("Unexpected UK legislation link")
    return value


def uk_feed(raw: str) -> tuple[list[dict[str, Any]], str | None]:
    if "<!ENTITY" in raw.upper():
        raise ValueError("XML entities are not supported")
    root = ET.fromstring(raw)
    if root.tag != "{http://www.w3.org/2005/Atom}feed":
        raise ValueError("UK source did not return an Atom feed")
    entries = []
    for entry in root.findall("a:entry", ATOM):
        links = entry.findall("a:link", ATOM)
        xml_link = next((link.get("href") for link in links if link.get("type") == "application/xml" and (link.get("href") or "").endswith("/data.xml")), None)
        entries.append({"id": entry.findtext("a:id", default="", namespaces=ATOM),
                        "title": entry.findtext("a:title", default="Untitled legislation", namespaces=ATOM),
                        "published": entry.findtext("a:published", namespaces=ATOM), "xml_url": uk_url(xml_link) if xml_link else None})
    next_link = next((link.get("href") for link in root.findall("a:link", ATOM) if link.get("rel") == "next"), None)
    return entries, uk_url(next_link) if next_link else None


def process_uk(api: Api, source: dict[str, Any], limit: int) -> int:
    cursor = get_cursor(api, source["id"])
    feed_url = uk_url(cursor.get("uk_next_feed") or "https://www.legislation.gov.uk/all/data.feed?sort=published&page=1")
    response = api.client.get(feed_url, headers={"accept": "application/atom+xml"}, follow_redirects=True)
    response.raise_for_status()
    if response.status_code in (202, 204) or not response.text.strip():
        raise SourceNotReady(response.status_code)
    entries, next_url = uk_feed(response.text)
    offset = int(cursor.get("uk_entry_offset", 0))
    processed = 0
    skipped = int(cursor.get("uk_non_xml_entries", 0))
    for index, item in enumerate(entries[offset:offset + limit], start=offset):
        if not item["xml_url"]:
            skipped += 1  # PDF-only and correction-slip coverage is explicitly recorded.
        else:
            document = api.client.get(item["xml_url"], headers={"accept": "application/xml"}, follow_redirects=True)
            document.raise_for_status()
            if document.status_code in (202, 204) or not document.text.strip():
                raise SourceNotReady(document.status_code)
            if "<Legislation" not in document.text:
                raise ValueError("UK source did not return a full CLML document")
            persist_document(api, source, external_id=item["id"], canonical_url=item["xml_url"].removesuffix("/data.xml"),
                             jurisdiction="UK", document_type="legislation", title=item["title"], citation=None,
                             published_at=item["published"], raw=document.text, media_type="application/xml",
                             metadata={"feed": feed_url, "version_label": "As made/enacted; subsequent amendments not verified"})
            processed += 1
        cursor.update({"uk_next_feed": feed_url, "uk_entry_offset": index + 1, "uk_non_xml_entries": skipped})
        set_cursor(api, source["id"], cursor)
    if offset + limit >= len(entries):
        cursor.update({"uk_next_feed": next_url, "uk_entry_offset": 0, "uk_backfill_complete": next_url is None})
        set_cursor(api, source["id"], cursor)
        if next_url is None:
            api.patch("source_sync_cursors", f"source_id=eq.{enc(source['id'])}", {"next_attempt_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()})
    return processed



def process_new_zealand(api: Api, source: dict[str, Any], limit: int) -> int:
    key = os.environ.get("NZ_LEGISLATION_API_KEY", "").strip()
    if not key:
        raise RuntimeError("NZ_LEGISLATION_API_KEY is required")
    cursor = get_cursor(api, source["id"])
    page = int(cursor.get("page", 1))
    page_size = max(1, min(limit, 100))
    response = api.client.get(
        "https://api.legislation.govt.nz/v0/works/",
        params={
            "page": str(page),
            "per_page": str(page_size),
            "sort_by": "most_recently_updated",
            "publisher": "Parliamentary Counsel Office",
        },
        headers={"X-Api-Key": key, "accept": "application/json", "user-agent": USER_AGENT},
    )
    response.raise_for_status()
    payload = response.json()
    entries = payload.get("results", [])
    if not isinstance(entries, list):
        raise RuntimeError("New Zealand Legislation API returned an unexpected payload")

    completed = 0
    for item in entries:
        if not isinstance(item, dict):
            continue
        work_id = str(item.get("work_id") or "").strip()
        version = item.get("latest_matching_version") or {}
        version_id = str(version.get("version_id") or "").strip()
        title = str(version.get("title") or work_id or "New Zealand legislation").strip()
        formats = version.get("formats") or []
        xml_url = next((str(x.get("url")) for x in formats if isinstance(x, dict) and str(x.get("type") or "").lower() == "xml" and x.get("url")), "")
        if not work_id or not version_id or not xml_url:
            continue
        document = api.client.get(xml_url, headers={"accept": "application/xml", "user-agent": USER_AGENT}, follow_redirects=True)
        if document.status_code >= 400:
            LOGGER.warning("New Zealand XML unavailable", extra={"work_id": work_id, "status": document.status_code})
            continue
        legislation_type = str(item.get("legislation_type") or "legislation").lower().replace("-", "_")
        persist_document(
            api,
            source,
            external_id=f"nz:{version_id}",
            canonical_url=xml_url.removesuffix(".xml/").removesuffix(".xml"),
            jurisdiction="NZ",
            document_type=legislation_type,
            title=title,
            citation=None,
            published_at=None,
            raw=document.text,
            media_type="application/xml",
            metadata={
                "work_id": work_id,
                "version_id": version_id,
                "legislation_status": item.get("legislation_status"),
                "publisher": "Parliamentary Counsel Office",
                "version_label": version_id,
            },
        )
        completed += 1

    total = int(payload.get("total") or 0)
    per_page = int(payload.get("per_page") or page_size)
    next_page = page + 1
    complete = not entries or (total > 0 and page * per_page >= total)
    set_cursor(api, source["id"], {"page": next_page, "per_page": per_page, "total": total, "complete": complete})
    return completed


def process_eurlex(api: Api, source: dict[str, Any], limit: int) -> int:
    cursor = get_cursor(api, source["id"])
    if cursor.get("scope_version") != EURLEX_SCOPE_VERSION:
        cursor = {"scope_version": EURLEX_SCOPE_VERSION, "offset": 0}
    offset = int(cursor.get("offset", 0))
    page_size = max(1, min(limit, 12))
    query = f"""PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT DISTINCT ?work ?celex ?date ?title ?resourceType WHERE {{
  ?work cdm:resource_legal_id_celex ?celex ;
        cdm:work_date_document ?date .
  OPTIONAL {{ ?work cdm:work_has_resource-type ?resourceType . }}
  OPTIONAL {{
    ?expression cdm:expression_belongs_to_work ?work ;
      cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/ENG> ;
      cdm:expression_title ?title .
  }}
  FILTER(REGEX(STR(?celex), "^[1234][0-9A-Z]{{4,}}$"))
}}
ORDER BY DESC(?date) DESC(?celex)
LIMIT {page_size}
OFFSET {offset}"""
    response = api.client.post(
        "https://publications.europa.eu/webapi/rdf/sparql",
        data={"query": query, "format": "application/sparql-results+json"},
        headers={
            "accept": "application/sparql-results+json",
            "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
            "user-agent": USER_AGENT,
        },
    )
    response.raise_for_status()
    payload = response.json()
    entries = payload.get("results", {}).get("bindings", [])
    if not isinstance(entries, list):
        raise RuntimeError("EUR-Lex SPARQL returned an unexpected payload")

    completed = 0
    for binding in entries:
        celex = str((binding.get("celex") or {}).get("value") or "").strip()
        work_uri = str((binding.get("work") or {}).get("value") or "").strip()
        published = str((binding.get("date") or {}).get("value") or "").strip() or None
        title = str((binding.get("title") or {}).get("value") or "").strip() or f"EU legal document {celex}"
        resource_type = str((binding.get("resourceType") or {}).get("value") or "").strip()
        if not celex:
            continue
        canonical_url = f"https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:{quote(celex, safe='')}"
        content_url = f"http://publications.europa.eu/resource/celex/{quote(celex, safe='')}"
        try:
            status, response_headers, raw = fetch_text_limited(
                api.client,
                content_url,
                headers={
                    "accept": "application/xhtml+xml, application/xml;q=0.9, text/html;q=0.8, text/xml;q=0.7",
                    "accept-language": "en",
                    "user-agent": USER_AGENT,
                },
                follow_redirects=True,
            )
        except SourceDocumentTooLarge:
            LOGGER.warning("EUR-Lex source skipped because body is too large", extra={"celex": celex, "max_bytes": MAX_SOURCE_BYTES})
            continue
        if status >= 400:
            LOGGER.warning("EUR-Lex text unavailable", extra={"celex": celex, "status": status})
            continue
        if len(strip_markup(raw)) < 120:
            LOGGER.warning("EUR-Lex response had no usable legal text", extra={"celex": celex})
            continue
        type_slug = resource_type.rsplit("/", 1)[-1].lower().replace("-", "_") if resource_type else "eu_legal_act"
        persist_document(
            api,
            source,
            external_id=f"celex:{celex}",
            canonical_url=canonical_url,
            jurisdiction="EU",
            document_type=type_slug,
            title=title,
            citation=f"CELEX {celex}",
            published_at=published,
            raw=raw,
            media_type=response_headers.get("content-type", "application/xhtml+xml").split(";", 1)[0],
            metadata={
                "celex": celex,
                "work_uri": work_uri,
                "resource_type": resource_type,
                "retrieved_via": "Publications Office CELLAR",
                "version_label": "Official EUR-Lex English expression",
            },
        )
        completed += 1

    next_offset = offset + len(entries)
    set_cursor(api, source["id"], {"scope_version": EURLEX_SCOPE_VERSION, "offset": next_offset, "batch_size": page_size, "complete": len(entries) < page_size})
    return completed


def source_ready(api: Api, source: dict[str, Any]) -> bool:
    rows = api.rows("source_sync_cursors", f"select=cursor,next_attempt_at&source_id=eq.{enc(source['id'])}&limit=1")
    if not rows:
        return True
    row = rows[0]
    if (row.get("cursor") or {}).get("access_blocked"):
        LOGGER.warning("source requires access review: %s", source.get("name", source["id"]))
        return False
    retry_at = row.get("next_attempt_at")
    return not retry_at or datetime.fromisoformat(retry_at.replace("Z", "+00:00")) <= datetime.now(timezone.utc)


def record_failure(api: Api, source: dict[str, Any], error: Exception) -> None:
    rows = api.rows("source_sync_cursors", f"select=cursor,consecutive_failures&source_id=eq.{enc(source['id'])}&limit=1")
    prior = rows[0] if rows else {}
    cursor = dict(prior.get("cursor") or {})
    count = int(prior.get("consecutive_failures") or 0) + 1
    status = error.response.status_code if isinstance(error, httpx.HTTPStatusError) else error.status if isinstance(error, SourceNotReady) else None
    cursor.update({"last_error_at": now(), "last_http_status": status, "last_error_type": type(error).__name__})
    if status in (401, 403):
        cursor["access_blocked"] = True
    retry_at = (datetime.now(timezone.utc) + timedelta(minutes=min(1440, 5 * 2 ** min(count, 8)))).isoformat()
    api.upsert("source_sync_cursors", "source_id", [{"source_id":source["id"], "cursor":cursor,
        "consecutive_failures":count, "next_attempt_at":retry_at, "updated_at":now()}])


def run(limit: int) -> int:
    base_url = os.environ.get("SUPABASE_URL", "").strip()
    secret = (os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not base_url or not secret:
        raise SystemExit("SUPABASE_URL and SUPABASE_SECRET_KEY are required")
    api = Api(base_url, secret)
    processed = 0
    try:
        sources = [("canada_justice_xml", process_canada), ("australia_register", process_australia), ("uk_legislation", process_uk), ("eurlex", process_eurlex), ("nz_legislation", process_new_zealand)]
        each = max(1, limit // len(sources))
        for adapter, handler in sources:
            source = source_policy(api, adapter)
            if not source:
                LOGGER.info("source not enabled", extra={"adapter": adapter})
                continue
            if not source_ready(api, source):
                continue
            try:
                count = handler(api, source, each)
                processed += count
                LOGGER.info("source batch complete", extra={"adapter": adapter, "processed": count})
            except Exception as error:
                record_failure(api, source, error)
                if isinstance(error, SourceNotReady):
                    LOGGER.warning("source deferred: %s (HTTP %s); checkpoint preserved", adapter, error.status)
                else:
                    LOGGER.exception("source batch failed", extra={"adapter": adapter})
        return processed
    finally:
        api.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest approved structured Commonwealth legal corpora")
    parser.add_argument("--limit", type=int, default=40)
    args = parser.parse_args()
    logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s", stream=sys.stdout)
    LOGGER.info("open corpus worker release=2026-09-25 deferred-source-v1 commit=%s", os.environ.get("RAILWAY_GIT_COMMIT_SHA", "unknown"))
    total = run(max(2, min(args.limit, 100)))
    LOGGER.info("open corpus batch complete processed=%s", total)


if __name__ == "__main__":
    main()
