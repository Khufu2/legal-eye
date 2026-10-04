# LOCKE recovery attempt — 4 October 2026

The owner authorized deleting replaceable public corpus data and disposable demo data to recover access. Existing permission does not require another confirmation for that scoped cleanup.

SQL availability probe still returned ECONNREFUSED before cleanup, so no deletion query was sent and no Supabase data was deleted.

The project organization is on the free plan. Following Supabase's documented pause-and-restore recovery option, the pause request was accepted. The latest observed state at approximately 04:51 UTC is PAUSING. Restore was attempted once but rejected because pausing has not completed. Supabase's returned message advises contacting support if this lasts more than 30 minutes. Do not issue another pause or assume restoration occurred.

Next action: inspect project state. If INACTIVE/paused, restore project ylkntvwvqzzmwstjejei, wait for active SQL access, then inspect live foreign keys and table classification before cleanup. Remove replaceable public corpus chunks/raw payloads without cascading into Auth, firms or private documents. Ordinary DELETE may not reclaim physical disk immediately; choose a narrowly scoped approach based on actual live dependencies. No reset or paid upgrade is authorized by this attempt.

Cloudflare independent work:
- Created D1 database locke-corpus-tz, UUID 144cf566-1c2d-4dcc-b59c-df443effef04, EEUR.
- Deployed scripts/cloudflare/corpus_schema.sql with source policy, documents, R2 references, source spans, resumable cursor state and synchronized FTS5 index.
- Local SQLite and live D1 tests passed: insert/update matches, stale-match removal and document-delete cascade. Synthetic fixtures were removed; no legal documents have been ingested.
- Tanzania OAG acts catalogue successfully returned 316 published catalogue records in the response. This establishes source connectivity, not text extraction or search coverage.
- Production research has not switched to D1. Private R2 buckets remain available.

Official recovery guidance: https://supabase.com/docs/guides/troubleshooting/how-to-bypass-cooldown-period
