from pathlib import Path

path=Path('services/docling/worker.py')
text=path.read_text()
text=text.replace('import tempfile\nimport threading\n', 'import tempfile\nimport threading\nimport xml.etree.ElementTree as ET\n',1)
anchor='''def process_job(api: SupabaseApi, job: dict[str, Any]) -> int:\n'''
helper=r'''def structured_text_canonical(raw: str, file_name: str, content_type: str, source_hash: str, source_url: str | None = None) -> tuple[dict[str, Any], bytes]:
    """Convert governed XML/HTML legal text into canonical lightweight nodes.

    This path is used for official structured sources (for example UK CLML and
    EUR-Lex XML). It deliberately rejects DTD/entity constructs before parsing.
    """
    upper = raw[:20000].upper()
    if "<!DOCTYPE" in upper or "<!ENTITY" in upper:
        raise PipelineError("unsafe_structured_source", "Structured source contains DTD or entity declarations", False)
    try:
        root = ET.fromstring(raw)
    except ET.ParseError as error:
        raise PipelineError("structured_parse_failed", "Official structured source could not be parsed", True) from error
    flattened = " ".join(part.strip() for part in root.itertext() if part and part.strip())
    flattened = " ".join(flattened.split())
    if not flattened:
        raise PipelineError("no_searchable_text", "Official structured source contains no searchable text", False)
    pieces: list[str] = []
    current = ""
    for sentence in flattened.replace("; ", ";\n").split("\n"):
        sentence = sentence.strip()
        if not sentence:
            continue
        if len(sentence) > 2600:
            if current:
                pieces.append(current)
                current = ""
            for start in range(0, len(sentence), 2600):
                piece = sentence[start:start + 2600].strip()
                if piece:
                    pieces.append(piece)
            continue
        candidate = f"{current}\n{sentence}".strip() if current else sentence
        if len(candidate) <= 2600:
            current = candidate
        else:
            pieces.append(current)
            current = sentence
    if current:
        pieces.append(current)
    texts = [{
        "text": piece,
        "label": "paragraph",
        "self_ref": f"#/texts/{index}",
        "_source": "official-structured-source",
        "prov": [{"confidence": 0.96}],
    } for index, piece in enumerate(pieces)]
    payload = {
        "schema": "legal-eye.structured-conversion.v1",
        "engine": {"name": "structured-source", "version": "1.0.0"},
        "source": {"file_name": file_name, "content_type": content_type, "sha256": source_hash, "resolved_url": source_url},
        "status": "success",
        "document": {"texts": texts, "tables": []},
        "provenance": {"confidence": {"text": 0.96}, "canonical_format": "structured-json", "fallback": False},
    }
    encoded_payload = json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8")
    return payload, encoded_payload


def enforce_public_source_policy(api: SupabaseApi, source_id: str) -> dict[str, Any]:
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
    return source


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
        enforce_public_source_policy(api, source_id)
        objects = api.rows(
            "source_ingest_objects",
            f"source_id=eq.{encoded(source_id)}&external_id=eq.{encoded(document['canonical_source_id'])}&select=id,content_sha256,raw_content,media_type,canonical_url&order=retrieved_at.desc&limit=1",
        )
        if not objects or not objects[0].get("raw_content"):
            raise PipelineError("source_object_unavailable", "Official structured source object is unavailable", True)
        source_object = objects[0]
        raw = str(source_object["raw_content"])
        source_hash = str(source_object.get("content_sha256") or sha256_bytes(raw.encode("utf-8")))
        canonical, artifact_bytes = structured_text_canonical(
            raw,
            f"{document['canonical_source_id']}.xml",
            str(source_object.get("media_type") or "application/xml"),
            source_hash,
            str(source_object.get("canonical_url") or document.get("canonical_url") or ""),
        )
        scan = {"scanner": "official-structured-source", "signature": "xml-entity-policy-v1", "fallback": False, "signature_antivirus": False}
        return persist_public(api, job, document, source_object, canonical, artifact_bytes, source_hash, scan)

    source_id = str(job.get("source_id") or "")
    external_id = str(payload.get("external_id") or "")
    if not source_id or not external_id:
        raise PipelineError("invalid_public_job", "Structured public job lacks source identity", False)
    source = enforce_public_source_policy(api, source_id)
    celex = str(payload.get("celex") or "").strip()
    if not celex:
        raise PipelineError("eurlex_identifier_missing", "EUR-Lex job lacks a CELEX identifier", False)
    xml_url = f"https://eur-lex.europa.eu/legal-content/EN/TXT/XML/?uri=CELEX:{quote(celex, safe='')}"
    allowed_host = urlparse(source["base_url"]).hostname or ""
    parsed_url = urlparse(xml_url)
    if parsed_url.hostname != allowed_host or parsed_url.scheme != "https":
        raise PipelineError("source_host_mismatch", "EUR-Lex structured URL failed source policy", False)
    try:
        response = httpx.get(xml_url, timeout=httpx.Timeout(90, connect=10), follow_redirects=True, headers={"user-agent": "LegalEye/0.3 governed-corpus-worker"})
    except httpx.HTTPError as error:
        raise PipelineError("upstream_fetch_failed", "EUR-Lex structured fetch failed", True) from error
    if response.status_code >= 400:
        raise PipelineError("upstream_fetch_failed", f"EUR-Lex returned {response.status_code}", response.status_code >= 500 or response.status_code == 429)
    if urlparse(str(response.url)).hostname != allowed_host:
        raise PipelineError("source_host_mismatch", "EUR-Lex redirected outside the approved source host", False)
    raw = response.text
    source_hash = sha256_bytes(raw.encode("utf-8"))
    canonical, artifact_bytes = structured_text_canonical(raw, f"{celex}.xml", response.headers.get("content-type", "application/xml"), source_hash, str(response.url))
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
if 'def structured_text_canonical(' not in text:
    if anchor not in text: raise SystemExit('process_job anchor missing')
    text=text.replace(anchor,helper+anchor,1)
branch='''    with tempfile.TemporaryDirectory(prefix="legal-eye-docling-") as directory:\n        file_name = str(payload.get("file_name") or "document.pdf")\n        source_path = Path(directory) / Path(file_name).name\n'''
replacement='''    if job.get("job_type") in {"legal_xml_parse", "eurlex_structured_fetch_parse"}:\n        return process_structured_public_job(api, job, payload)\n    with tempfile.TemporaryDirectory(prefix="legal-eye-docling-") as directory:\n        file_name = str(payload.get("file_name") or "document.pdf")\n        source_path = Path(directory) / Path(file_name).name\n'''
if branch not in text: raise SystemExit('job branch anchor missing')
text=text.replace(branch,replacement,1)
text=text.replace('default="official_pdf_fetch_parse,docling_parse",','default="official_pdf_fetch_parse,docling_parse,legal_xml_parse,eurlex_structured_fetch_parse",',1)
path.write_text(text)
print('structured UK/EU corpus processing enabled')
