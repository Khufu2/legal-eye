# Corpus ingestion runbook

No connector may fetch content unless its `source_policies` row permits that exact operation.
The gate distinguishes discovery, individual fetch, cache, permanent storage, commercial display,
bulk ingest, embedding, computational analysis, redistribution and attribution.

## Current state

- UK Legislation is approved under the Open Government Licence v3, subject to per-item notices,
  third-party rights and required attribution. Twenty current official metadata records have been
  ingested with source URLs, hashes, provenance and an evaluation case for each record.
- EUR-Lex is approved under its official reuse policy, subject to per-document notices and excluded
  third-party material. Its connector has not yet been activated.
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

