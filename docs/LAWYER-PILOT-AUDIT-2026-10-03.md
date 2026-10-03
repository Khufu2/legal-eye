# LOCKE lawyer-pilot audit — 3 October 2026

## Release verdict

**Blocked for a complete lawyer pilot.** Public primary-law retrieval and tested database authorization work. Authenticated AI/application journeys, email delivery and new private-document processing are not verified in this session. Cloudflare offload has not started because R2 is not activated. No Harvey/Legora parity or unrestricted client-work readiness is claimed.

## Production identity and current evidence

- Repository: `Khufu2/legal-eye`, baseline `0b7f701fb99af668814f660f7d61b16b744232c3`.
- Production: https://lockeslaw.sheenax.xyz/; HTTP 200 and the live browser renders LOCKE. Vercel project `legal-eye`; baseline deployment `dpl_uQMbaZ22urefY6ezdU4i1kDmnxBk` is READY.
- Supabase Legal: `ylkntvwvqzzmwstjejei`. SQL responds and writes were successfully applied; the earlier recovery outage is no longer the current access blocker. This does not establish disaster recovery or sufficient disk headroom.
- Cloudflare account access and Workers listing succeed. R2 returns error 10042: “Please enable R2 through the Cloudflare Dashboard.” No bucket, credentials or migration was created.
- Railway `legal-eye-processing`: scanner has a SUCCESS deployment. Docling, structured-v2 and open-corpus workers remain intentionally paused with annual cron schedules. Docling's current start command prints the pause reason instead of processing jobs. The older structured worker is superseded. SUCCESS metadata does not mean these jobs are running.
- Vercel's seven-day grouped runtime-error query returned no errors. This is a limited query result, not evidence that every feature is healthy.

## Live fixes completed

1. Applied `enforce_active_client_portal_access`. Before the change, the corrected rollback-only portal test failed because an archived portal remained accessible to its guest. After the change, published draft access, guest publication denial and archive revocation pass.
2. Applied `index_driven_legal_evidence_search`. The deployed search now separates indexed chunk/title predicates. All 15 existing Tanzania primary-law retrieval cases pass. An anonymous REST search for employment/termination returned three expected authorities, HTTP 200, in approximately 1.75 seconds on one request. No broad latency SLO or legal-answer accuracy claim follows.
3. Added a live rollback-only publication regression test: same-firm publication succeeds; readable foreign-firm drafts, nonexistent IDs and reassignment of existing publications are denied.
4. Corrected the portal test's missing mandatory `document_type`; corrected the capacity audit to inspect `legal_documents.raw_text`, and added separate raw-ingestion size measurement.

All database-test fixtures were rolled back. No existing firm data, users or source records were removed.

## Capacity and migration decision

Measurements are snapshots from this audit, in bytes unless noted.

| Metric | Observed |
| --- | ---: |
| PostgreSQL database | 1,752,284,307 |
| Legal documents | 28,032 |
| Legal chunks | 180,873 |
| Chunk table including indexes/TOAST | 1,079,599,104 |
| Raw ingestion table including indexes/TOAST | 537,042,944 |
| Chunk text before database compression | 333,224,522 |
| Raw ingestion content before database compression | 1,696,998,455 |
| Largest raw ingestion object | 3,864,838 |
| Chunk trigram index | 249,634,816 |
| Chunk full-text index | 106,496,000 |
| Populated public chunk embeddings | 0 |
| Citation edges | 0 |
| Private corpus-artifact Storage | 137,901,428; 5,342 objects |
| Firm-vault Storage | 3,502; 4 objects |
| Ingestion jobs | 5,331 complete; 435 failed |

Zero `n_live_tup` estimates from reset statistics were not treated as empty tables. Exact counts were used instead. A later combined raw-content aggregation timed out; no missing result was treated as zero.

The main capacity problem is PostgreSQL content and indexes, not the approximately 138 MB of Storage files. Copying those files alone will not bring PostgreSQL under the free-plan database allowance. Physical-size reduction has not been attempted or claimed.

R2 is the appropriate next destination for large raw bodies and artifacts after activation, with immutable IDs/hashes and private access. Auth, firms, memberships, matter permissions and private operational metadata should remain in Supabase initially. The existing copy-only runner passed nine tests; it is not a complete production storage adapter. Upload, processing, retrieval, download and deletion callers still need provider-aware implementation before traffic switches.

D1 is a candidate for measured public search/metadata shards, not an immediate replacement for the relational backend. Current documented free limits include 500 MB per database, 5 GB per account and 2 MB maximum row/string size. Some current raw objects exceed that row limit. Do not import the entire corpus into one D1 database or presume Vectorize is needed: no populated embeddings were observed.

Bulk ingestion should remain paused until capacity is secured. Afterwards, restore the private Docling worker with an explicit `docling_parse` job allowlist and a bounded batch first; do not resume all public importers at once. Verify an actual synthetic upload before declaring processing restored.

Before/after: source data and Storage bytes were not migrated or deleted. Monthly egress, provider billing usage, physical disk free space and backup recovery remain unmeasured. The free-plan goal is **not achieved** yet.

## Feature status

“Implemented” below means inspected code exists; it does not mean today's browser acceptance succeeded.

| Feature | Current status and evidence | Remaining gate |
| --- | --- | --- |
| Signup, firm creation, invites and roles | Database tests pass for verified ownership, retry, email-bound invites, wrong recipient, escalation denial, last owner and suspension | Real confirmation/reset delivery and browser account flow |
| Tenant privacy | Tested foreign-firm document/agent visibility denied; all public tables have RLS; anonymous documents request returns no rows | Full matter/storage/download/write isolation and independent review |
| Public research retrieval | Live RPC/REST plus 15/15 TZ primary-law cases pass | Signed-in answer/citation/reopen flow and lawyer accuracy review |
| African/global corpus | 5 approved-source jurisdictions with searchable documents; uneven and incomplete | Judgments, regulators, currentness, licensing and coverage reconciliation |
| Semantic retrieval / authority treatment | Schema and ranking scaffolding; no populated public embeddings or citation edges | Actual production implementation and quality benchmarks |
| Private Vault, extraction/OCR | Upload/queue code exists; deployed processing function matches repository; worker paused | New synthetic TXT/PDF/DOCX upload → Ready → retrieval |
| Editor, revisions, export | Implemented; DOCX unit checks pass | Signed-in generate/edit/save/reopen/export and rich Word round-trip |
| Contract review and tables | Structured output and quote-validation implementation/tests exist | Current multi-document generation, persistence and export acceptance |
| Agent and skills | Bounded AI tool loop with saved-run path; no saved runs currently observed | Live execution/failure/persistence; durable background execution remains a gap |
| Workflows | Sequential designer, persisted steps, human approval, retry/resume/cancel implemented | Live checkpoint/reload/retry; branching/unattended scheduling remain gaps |
| Lists and matters | Implemented database-backed surfaces | Browser CRUD, checklist generation and permission acceptance |
| Monitors | Scheduled catalogue scan remains active; source-state UI exists | Actual event/triage test; paused importers mean freshness is limited |
| Portal | Live archive/publication authorization tests pass after fix | Host/guest browser flows and assistant acceptance |
| Word and Outlook | Office.js code/manifests; synthetic host tests pass | Native Office sideload and host tests; Graph/DMS integrations remain optional gaps |
| Languages and mobile | Translation action and responsive browser surfaces exist | Lawyer language quality and actual mobile device checks; no native app claim |
| Admin, usage, SSO/SCIM, recovery | Schemas/control paths exist; public API auth gates pass | Usage-limit/billing, IdP lifecycle, restore drill and operational acceptance |

Current searchable coverage: AU 14,438/14,439; CA 5,857/5,857; EU 1,904/2,155; TZ 5,317/5,495; UK 86/86. Counts do not establish completeness or current law. Canada is access-blocked; AU/EU/UK have recorded retries; bulk workers are paused.

Remaining security advisories include public-source search as a deliberately bounded definer RPC, eleven authenticated definer RPC notices requiring function-specific review, and disabled leaked-password protection. These are not all confirmed vulnerabilities. Full external security acceptance remains open.

## Verification completed

- TypeScript check passed.
- Vercel's Next.js production build passed.
- Full Vinext build plus all 17 Node tests passed.
- All 16 Python migration/ingestion tests passed after supplying the missing local test dependency.
- Live rollback-only onboarding, invitations, cross-firm document/agent visibility, portal archive/publication and expired-ingestion-lease recovery tests passed.
- Fifteen Tanzania expected-authority retrieval cases passed.
- Production research/work/processing/guide/workflow/portal APIs all return HTTP 401 without a session. Anonymous private documents return an empty result.
- Live signed-out research opens the sign-in dialog rather than returning a fake saved result.

## Next release gates and rollback

1. Activate R2 in the account dashboard, then inspect bucket privacy and create scoped operator access securely. Do not paste keys in chat.
2. Supply a signed-in browser session to the existing firm or a dedicated test firm. Do not impersonate an existing user or disable account confirmation to test.
3. Implement/verify the selected public/raw-content offload with a consistent export, hashes, reconciliation and rollback originals. Preserve source rights. Confirm actual database headroom.
4. Restore bounded private parsing; complete the checklist in `LAWYER-PILOT-GUIDE.md` before handing over the full beta.
5. Only after these pass invite the lawyer for a supervised fictional/de-identified-data pilot. Ordinary confidential client work needs the wider privacy, restore and contractual review.

The portal fix only restricts unsafe access; rolling it back would reintroduce the demonstrated bug. Search can be reverted using the prior function definition in `20260921235500_bounded_title_primary_law_search.sql` if new regressions appear. No infrastructure traffic switch occurred, so storage rollback is unnecessary today. Keep all original source data during future offload and reconcile changes before cutover.

References: https://developers.cloudflare.com/d1/platform/limits/ ; https://developers.cloudflare.com/r2/pricing/ ; https://supabase.com/docs/guides/database/database-linter ; https://supabase.com/docs/guides/auth/password-security .
