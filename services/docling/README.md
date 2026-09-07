# Legal Eye private parsing service

This service is the only canonical document-parsing boundary. It calls Docling directly and returns lossless Docling JSON; downstream search chunks remain derived artifacts linked to structural nodes and page geometry.

Supported input follows the pinned Docling release, including PDF/scanned PDF, DOCX, XLSX, PPTX, HTML, images and text. Confidential uploads are streamed to an ephemeral file, converted locally, and removed when the request finishes. Network egress should be disabled in production and model artifacts should be preloaded into the image/volume.

Required runtime controls:

- private network exposure only;
- `LEGAL_EYE_PARSER_KEY` supplied from the secret manager;
- encryption in transit and at rest;
- request-size, MIME and decompression limits at the gateway;
- malware scanning before conversion;
- no request bodies in logs;
- immutable source hash and conversion provenance retained in Supabase;
- one worker per container unless memory profiling proves safe concurrency.

The Docker base and Python dependencies are pinned. Production image promotion also requires SBOM generation, vulnerability scanning, signature verification and the golden legal-document regression suite.

## Durable queue worker

The same image can run a bounded Cloud Run Job by overriding its command:

```text
python worker.py --limit 5 --job-types official_pdf_fetch_parse,docling_parse
```

Required secrets and configuration are `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and
`MALWARE_SCANNER_URL`; an optional `MALWARE_SCANNER_TOKEN` authenticates the scanner. The worker
refuses to claim jobs if scanning is not configured. It claims work atomically with `SKIP LOCKED`,
heartbeats a time-bounded lease, retries with exponential backoff, and dead-letters exhausted or
non-retryable jobs.

Public documents are fetched only from the approved source-registry host after the current licence
capabilities are checked. Redirects, private addresses, invalid MIME/signatures, oversized files,
and malware findings fail closed. Canonical Docling JSON is stored in the private
`legal-corpus-artifacts` bucket; derived chunks retain the Docling node reference, reading order,
page, coordinates, offsets, extraction confidence, and OCR provenance. Private Vault documents use
the same controls and remain organization-scoped in `firm-vault`.

Until this job is deployed with all required secrets, uploads and corpus records remain queued and
must be shown as not searchable.

