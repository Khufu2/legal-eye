# LOCKE / Legal Eye — 4 October 2026 release evidence

**Full lawyer handover remains blocked.** Cloudflare public-law retrieval is deployed and its Tanzania expected-authority benchmark passes 15/15. This is retrieval evidence, not proof of legal-answer accuracy, completeness, currentness, or Harvey/Legora parity. Supabase's database is unavailable; authenticated application acceptance cannot pass yet.

## What is live

- Production https://lockeslaw.sheenax.xyz/ uses the private R2-backed public corpus gateway for research evidence and corpus statistics. Vercel deployed commit `15bb87365717e62507f99ce6c9dacf1c0ef15ff3` successfully; ingestion changes are in later commits.
- R2 buckets `locke-corpus` and `locke-private-files` have public bucket access disabled. Only public source material is ingested. The private-file bucket is provisioned; private upload/processing callers have not been switched to it.
- Source downloads are host-restricted. Raw source and extracted records are stored under immutable SHA-256 identifiers, then read back in full and verified. PDFs retain page references. Scanned PDFs use bounded English OCR, explicitly marked for lawyer verification.
- Versioned lexical indexes are verified before publication. Current-law/amendment uncertainty, bills, document types and OCR flags are supplied with evidence. This is lexical retrieval; no semantic-vector or citator implementation is claimed.
- The existing Railway open-corpus service is running the new Cloudflare rebuild, independently of this conversation and without writing into Supabase. It processes all five previously populated jurisdictions, checkpoints to R2 every five minutes, and publishes partial snapshots every fifteen minutes. It exits when its bounded discovery passes finish; no recurring cron or automatic restart was enabled.
- A checkpoint was downloaded from R2, hashes verified, and its restored SQLite database passed `integrity_check`. The restored receipt inventory contained AU 984, CA 2,196, EU 206, TZ 899 and UK 364 verified documents.

## Inventory and scope

The last successful Supabase inventory on 3 October contained 28,032 legal documents and 180,873 chunks. It showed searchable AU 14,438; CA 5,857; EU 1,904; TZ 5,317; UK 86. Today's database cannot be queried, so these are historical measurements, not a fresh SQL inventory.

The published Cloudflare snapshot at 13:51 UTC contains **4,014 verified documents / 70,531 passages**:

| Jurisdiction | Published documents | Source |
| --- | ---: | --- |
| Tanzania | 767 | Attorney General OAG MIS, eight catalogue collections |
| Canada | 1,799 | Justice Canada official English XML repository |
| Australia | 900 | Federal Register of Legislation official PDFs |
| EU | 184 | Official Publications Office / EUR-Lex Cellar content |
| UK | 364 | legislation.gov.uk structured legislative XML |

Railway subsequently reported AU 1,186; CA 2,640; EU 341; TZ 903; UK 566 verified documents at 13:52 UTC. These later receipts are not all in the published snapshot yet. Counts will change while the job runs.

This is a **source rebuild**, not a reconciled copy of the old database. Coverage is explicitly marked incomplete. Canada discovers 5,863 current English XML files. Australian discovery currently selects in-force titles; its live catalogue reports 51,404 such titles, while the full historical catalogue reports 132,509. UK discovery is capped at 100 feed pages; EU at 2,200 primary-sector records. Neither run establishes all historical law, all judgments, all amendments, or equivalent coverage to the previous snapshot. Unusable text, oversized files, bounded OCR failures and official-source 404s are retained as failed attempts rather than counted as successful ingestion.

## Backend recovery

Supabase Legal `ylkntvwvqzzmwstjejei` previously measured approximately 1.75 GB of database content. Its Postgres logs reported “No space left on device” followed by recovery/startup failures. Today management SQL still returns `ECONNREFUSED`; the REST database API returns HTTP 503 `PGRST002`. Auth's health endpoint returning 200 only proves that GoTrue's process responds.

Two pause attempts failed to leave the project paused; management eventually reports `ACTIVE_HEALTHY`, despite the failed SQL and REST probes. A free replacement project could not be created because the organization already has two active free projects. The unrelated Relay ai project was not changed. No paid upgrade was purchased. No Supabase data was deleted: the database must start before SQL cleanup can execute. Deleting ordinary rows after recovery is also not proof that physical disk space has been reclaimed.

Dashboard recovery controls are behind a Supabase sign-in wall in the available browser. The connected plugin has no restart, disk-resize, production-project deletion or support-ticket operation. Restoring database access, obtaining a clean permitted project slot, or a provider-assisted disk recovery is the outstanding infrastructure gate.

## Feature assessment

| Feature | Verified now | Remaining handover gate |
| --- | --- | --- |
| Public-law retrieval | Live Cloudflare API; 15/15 expected Tanzania title + Cap. matches; page evidence | Signed-in answer, citation inspection, save/reopen; lawyer accuracy review |
| Login, firms, roles, invitations | Prior SQL authorization tests; present sign-in gates | Database recovery and real email/account lifecycle |
| Private Vault and parsing | Visible upload surface; authenticated API required | Database recovery; paused private Docling worker; synthetic TXT/PDF/DOCX upload to Ready and retrieval |
| Editor, revisions and Word export | Deployed screen; existing unit checks | Generate, edit, save, reopen, export with a real test session |
| Review, Tables, Lists and Matters | Deployed surfaces render and require a firm session | Live generation, persistence, export and permission checks |
| Agent and Skills | Bounded tool loop/control paths and rendered surfaces | Real execution/failure/persistence; durable unattended agent execution remains a gap |
| Workflows | Designer and human-checkpoint implementation; deployed screen | Live approval/reload/retry/cancel acceptance; branching/scheduling gaps remain |
| Portal | Prior publication/archive authorization tests; current sign-in gate | Real host/guest publication and assistant flow |
| Monitor and Trust | Deployed screens and governance paths | Actual event triage/audit trail with restored backend |
| Word and Outlook add-ins | Office.js code/manifests and prior synthetic tests | Native Office host acceptance |
| Semantic search / authority treatment | Schema scaffolding only; prior populated embeddings/citation edges both zero | Actual implementation and legal quality benchmarks |
| Recovery, usage and enterprise identity | Control paths exist | Restore drill, usage enforcement and IdP lifecycle acceptance |

The signed-out browser rendered all twelve main feature screens. This does not verify authenticated workflows. Production legal-ai, legal-work, process-document, locke-assistant, workflows, portal-work and import-document APIs all returned 401 without a session. Browser extension errors were not treated as application errors.

## Checks completed

- TypeScript check, full production build and 21 Node tests passed for the application cutover.
- Five focused gateway tests now pass, including fail-closed tokens, index path restrictions, table-of-contents downranking and checkpoint-retention safety.
- Sixteen Python ingestion/migration tests passed; new ingestion/runner modules compile.
- Fifteen live Tanzanian expected-authority title/citation retrieval cases pass against the published Cloudflare index. This measures title/citation recall, not passage relevance or answer correctness.
- Verified raw/extracted remote hashes and full checkpoint restoration; no private firm data was included in the public rebuild.

Use the existing `LAWYER-PILOT-GUIDE.md` only after the backend gate is resolved and its authenticated acceptance checklist is completed. **Do not label this release fully functional or hand it over for ordinary client work on the present evidence.**
