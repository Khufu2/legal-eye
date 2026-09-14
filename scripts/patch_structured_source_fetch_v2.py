from pathlib import Path
p=Path('services/docling/worker.py')
s=p.read_text()
start=s.index('def process_structured_public_job(')
end=s.index('\ndef process_job(', start)
new=r'''def fetch_official_structured(url: str, allowed_hosts: set[str], accept: str = "application/xml", language: str | None = None) -> tuple[str, str, str]:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in allowed_hosts:
        raise PipelineError("source_host_mismatch", "Structured source URL failed source policy", False)
    headers = {"user-agent": "LegalEye/0.4 governed-corpus-worker", "accept": accept}
    if language:
        headers["accept-language"] = language
    try:
        response = httpx.get(url, timeout=httpx.Timeout(90, connect=10), follow_redirects=True, headers=headers)
    except httpx.HTTPError as error:
        raise PipelineError("upstream_fetch_failed", "Official structured fetch failed", True) from error
    if response.status_code >= 400:
        raise PipelineError("upstream_fetch_failed", f"Approved structured source returned {response.status_code}", response.status_code >= 500 or response.status_code == 429)
    final = urlparse(str(response.url))
    if final.scheme != "https" or final.hostname not in allowed_hosts:
        raise PipelineError("source_host_mismatch", "Structured source redirected outside approved official hosts", False)
    raw = response.text
    if not raw.strip():
        raise PipelineError("no_searchable_text", "Official structured source returned no text", False)
    return raw, response.headers.get("content-type", accept), str(response.url)


def process_structured_public_job(api: SupabaseApi, job: dict[str, Any], payload: dict[str, Any]) -> int:
    job_type = str(job.get("job_type") or "")
    if job_type == "legal_xml_parse":
        legal_document_id = str(payload.get("legal_document_id") or "")
        documents = api.rows(
            "legal_documents",
            f"id=eq.{encoded(legal_document_id)}&select=id,source_id,canonical_source_id,jurisdiction_code,language,structured_content,canonical_url&limit=1",
        )
        if not documents:
            raise PipelineError("legal_document_missing", "Canonical legal document is unavailable", False)
        document = documents[0]
        source_id = str(document.get("source_id") or "")
        source = enforce_public_source_policy(api, source_id)
        objects = api.rows(
            "source_ingest_objects",
            f"source_id=eq.{encoded(source_id)}&external_id=eq.{encoded(document['canonical_source_id'])}&select=id,content_sha256,raw_content,media_type,canonical_url&order=retrieved_at.desc&limit=1",
        )
        source_object = objects[0] if objects else None
        canonical_url = str(document.get("canonical_url") or (source_object or {}).get("canonical_url") or "")
        allowed_host = urlparse(str(source.get("base_url") or "")).hostname or ""
        if not canonical_url or not allowed_host:
            raise PipelineError("source_object_unavailable", "Official UK source URL is unavailable", True)

        # Correction slips and other PDF attachments are legitimate source objects, but not CLML.
        if urlparse(canonical_url).path.lower().endswith(".pdf"):
            with tempfile.TemporaryDirectory(prefix="legal-eye-uk-pdf-") as directory:
                target = Path(directory) / "official.pdf"
                source_hash, content_type, resolved_url = download_public_source(canonical_url, allowed_host, target)
                scan = malware_scan(target, content_type)
                canonical, artifact_bytes = convert(target, "official.pdf", content_type, source_hash)
                canonical["source"]["resolved_url"] = resolved_url
                artifact_bytes = json.dumps(canonical, separators=(",", ":"), default=str).encode("utf-8")
                return persist_public(api, job, document, source_object, canonical, artifact_bytes, source_hash, scan)

        # legislation.gov.uk exposes every piece of legislation as Akoma Ntoso by appending /data.akn.
        base = canonical_url.rstrip("/")
        candidates = [f"{base}/data.akn", f"{base}/data.xml"]
        last_error: PipelineError | None = None
        raw = content_type = resolved_url = ""
        for candidate in candidates:
            try:
                raw, content_type, resolved_url = fetch_official_structured(candidate, {allowed_host}, "application/xml")
                break
            except PipelineError as error:
                last_error = error
        if not raw:
            raise last_error or PipelineError("upstream_fetch_failed", "UK official structured source could not be fetched", True)
        source_hash = sha256_bytes(raw.encode("utf-8"))
        canonical, artifact_bytes = structured_text_canonical(raw, "official-legislation.akn", content_type, source_hash, resolved_url)
        scan = {"scanner": "official-structured-source", "signature": "xml-entity-policy-v1", "fallback": False, "signature_antivirus": False}
        return persist_public(api, job, document, source_object, canonical, artifact_bytes, source_hash, scan)

    source_id = str(job.get("source_id") or "")
    external_id = str(payload.get("external_id") or "")
    if not source_id or not external_id:
        raise PipelineError("invalid_public_job", "Structured public job lacks source identity", False)
    enforce_public_source_policy(api, source_id)
    work_uri = str(payload.get("work_uri") or "").strip()
    if not work_uri:
        raise PipelineError("eurlex_identifier_missing", "EUR-Lex job lacks a CELLAR work URI", False)
    if work_uri.startswith("http://"):
        work_uri = "https://" + work_uri.removeprefix("http://")
    # CELLAR's dissemination API supports content negotiation on the Work URI. This avoids
    # guessing a CELEX identifier from cdm:work_id_document, which is not the CELEX key.
    raw, content_type, resolved_url = fetch_official_structured(
        work_uri,
        {"publications.europa.eu", "op.europa.eu"},
        "application/xhtml+xml, application/xml;q=0.9, text/xml;q=0.8",
        "eng",
    )
    source_hash = sha256_bytes(raw.encode("utf-8"))
    canonical, artifact_bytes = structured_text_canonical(raw, "eurlex-cellar.xml", content_type, source_hash, resolved_url)
    documents = api.rows(
        "legal_documents",
        f"source_id=eq.{encoded(source_id)}&canonical_source_id=eq.{encoded(external_id)}&select=id,jurisdiction_code,language,structured_content&limit=1",
    )
    if not documents:
        raise PipelineError("legal_document_missing", "Canonical EUR-Lex document is unavailable", False)
    objects = api.rows(
        "source_ingest_objects",
        f"source_id=eq.{encoded(source_id)}&external_id=eq.{encoded(external_id)}&select=id,content_sha256&order=retrieved_at.desc&limit=1",
    )
    scan = {"scanner": "official-structured-source", "signature": "xml-entity-policy-v1", "fallback": False, "signature_antivirus": False}
    return persist_public(api, job, documents[0], objects[0] if objects else None, canonical, artifact_bytes, source_hash, scan)
'''
s=s[:start]+new+s[end:]
p.write_text(s)
print('structured source fetch v2 applied')
