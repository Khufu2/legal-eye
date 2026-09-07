# Corpus ingestion runbook

No connector may fetch content unless its `source_policies` row permits that exact operation.
The gate distinguishes discovery, individual fetch, cache, permanent storage, commercial display,
bulk ingest, embedding, computational analysis, redistribution and attribution.

## Current state

- Tanzania OAG is active following direct permission asserted by the product owner on 5 September
  2026. The first governed sync captured 5,495 official catalogue records: 316 Acts, 542 revised
  Acts, 4,481 subsidiary instruments, 126 Bills, 26 parliamentary resolutions and four guidelines.
  Each record retains its official URL, source metadata, attribution and content hash. All 5,495
  official-PDF fetch/Docling jobs are queued; until those jobs complete, the catalogue is metadata,
  not a searchable full-text Tanzanian corpus.
- UK Legislation is approved under the Open Government Licence v3, subject to per-item notices,
  third-party rights and required attribution. Twenty current official metadata records have been
  ingested with source URLs, hashes, provenance and an evaluation case for each record.
- EUR-Lex is approved under its official reuse policy, subject to per-document notices and excluded
  third-party material. The CELLAR knowledge-graph connector is active and the first governed sync
  captured 250 recent EU legal-document records with CELEX identifiers, official work URIs,
  provenance and hashes. Structured-content jobs are queued; each item must pass its own rights
  exception check before full text is published.
- Laws.Africa is discovery-only in this commercial product until a commercial Content API agreement
  is executed; open content is CC BY-NC-SA and cannot be assumed commercially reusable.
- CourtListener requires an API token and approved quota/terms. No scraping fallback is permitted.
- All other African and global sources remain blocked until an owner, reviewed licence/terms,
  robots/API assessment and capability matrix are recorded.

## Ingestion stages

1. Discover source identifiers and capture HTTP validators without assuming content rights.
2. Fetch only approved individual or bulk artifacts; preserve the raw response and checksum.
3. Parse legislation as CLML/Akoma Ntoso structure and documents as canonical Docling JSON.
4. Normalize jurisdiction, court, dates, language, citations and temporal expressions.
5. Derive traceable search passages linked to source spans; never make flattened chunks canonical.
6. Resolve citations and edges, compute authority/temporal features, then embed only where allowed.
7. Run source-specific reconciliation, duplicate, completeness and licence tests.
8. Publish only records whose policy allows commercial display and whose provenance is complete.

Every run writes `connector_runs`, `source_sync_cursors` and `source_ingest_objects`. Retries must
use ETag/Last-Modified and canonical IDs so that ingestion is idempotent. Failed or quarantined
items never enter the public catalog.

## Processing worker release boundary

Migration `20260907121920_processing_queue_and_legal_chunks.sql` adds atomic leases, heartbeats,
bounded attempts, exponential retry, dead-letter timestamps, idempotency keys and append-only job
events. It also adds private canonical public-law artifacts and derived chunks with Docling node,
page, coordinates, offsets, confidence and OCR provenance. The public RLS policy permits reads only
when the governing source remains approved for commercial display.

`services/docling/worker.py` is the bounded Cloud Run Job entry point. It rechecks source rights,
restricts fetches to the approved HTTPS host, validates redirects, MIME/signatures and size, and
requires a configured malware scanner before claiming work. It stores the canonical artifact before
publishing chunks and marks a job complete only after all persistence succeeds.

This code and migration do not mean the live queue has been drained. The worker image, scanner,
Supabase secret, private networking and service identity must be deployed and a controlled batch
must complete before any record is reported as searchable.
