# LOCKE selective Cloudflare offload audit

Observed 2026-10-01, approximately 06:17 UTC. Production repository main was
5ada81a3c37e75e93bd56eaa9543ff690cc98175. This is an incomplete capacity audit,
not a production-readiness certification. No infrastructure migration or deletion
was performed during this audit.

## Confirmed incident and measurement limits

Supabase project `ylkntvwvqzzmwstjejei` SQL cannot connect. Current Postgres logs
at 06:16 UTC explicitly report both “the database system is in recovery mode”
and “the database system is not accepting connections”. The earlier signed-in
dashboard inspection on September 27 reported `HostOutOfDiskSpace` on `/data`
and a down database process. The platform project's coarse healthy flag does
not establish database availability.

The last successful database-size measurement on September 25 was about
1,593 MB. It is a historical value, not today's measured usage. The historical
public corpus snapshot contained 26,996 records, 26,568 searchable documents
and 175,424 chunks. Current size, table/index breakdown, Storage bytes, egress,
API usage, non-null embeddings, duplicate rows, cache volume and headroom are
unknown because database access is unavailable. Do not treat failed counts as
zero or use these snapshots as proof of current coverage.

The immediate confirmed blocker is database availability following disk
exhaustion. The exact table responsible cannot yet be established. Code/schema
inspection identifies public chunk text, stored full-text vectors, GIN indexes,
raw source content, and artifacts as candidates. An embedding column and HNSW
index exist, but no current non-null vector count is available. The inspected
ingestion workers do not establish that embeddings are populated. Moving files
from Supabase Storage alone will not remove PostgreSQL corpus rows/indexes.

Nine deployed Edge Functions are listed: legal-api, legal-app,
legal-process-document, legal-team-admin, legal-corpus-ingest, legal-scim,
legal-bootstrap-demo, legal-source-probe, and legal-ingestion-runner. Listing
them establishes deployment metadata, not successful execution or usage.

Vercel's current production deployment `dpl_7S2E3rpwkehYQKG35DRazGUapesj`
was checked this turn and is READY at the expected September 26 commit, with
both production domains attached. This establishes frontend deployment state;
it does not repair or prove the unavailable backend.

Cloudflare dashboard access is blocked in this browser by persistent human
verification after one reload. No Cloudflare connector is available in this
session. No account, bucket, Worker, D1 database or Vectorize index was created.

## Selective workload decisions

| Workload | Decision | Required evidence before switching |
| --- | --- | --- |
| Auth, profiles, firms, memberships, permissions, billing, private matter/client metadata | Keep in Supabase with current RLS | Restored DB, real login/onboarding, cross-firm and cross-matter tests |
| PDFs, DOCX, evidence, generated files, extracted artifacts | Private R2 is the planned target; not yet migrated | Object inventory, private bucket, byte/hash verification, provider-aware upload/download/delete and processing, short-lived access after caller-RLS authorization |
| Public legal metadata, importer state and eligible public caches | D1 candidate, not yet selected/provisioned | Measured size, licensing approval, SQLite-compatible export, quota and query benchmark |
| Public chunk search/text | D1 full-text index plus R2 larger text/artifacts is a candidate | Size-aware shards, citation IDs/spans, rights/currentness filters and retrieval benchmarks |
| Private ingestion events/caches/matter text | Keep private; do not classify as public just by table name | Row-level classification and private security boundary review |
| Embeddings | Defer Vectorize until actual count/model/bytes are known | Source-permission approval, matching dimensions/model, IDs and citation metadata, recall and isolation benchmarks |
| Frontend | Keep current Vercel deployment | Production smoke checks after backend recovery |

No fallback may fabricate evidence or substitute a demo account when the
private backend fails. No service-role key belongs in frontend code. A private
R2 key is not an authorization check: every read/signing operation must first
authorize the actual document using the caller's JWT and Supabase RLS.

## Concrete preparation completed

`supabase/sql/capacity_audit.sql` contains read-only table/index/TOAST size,
Storage inventory/bytes, RLS/policy, large-column, actual embedding/content and
duplicate-URL queries. It has bounded statement timeouts. Full scans are
separate from catalog queries. Egress/API/function monthly usage still requires
provider usage metrics, not an inference from PostgreSQL statistics.

`scripts/cloudflare/copy_storage.py` implements the COPY and byte-VERIFY stage
for a reviewed Storage inventory. It retains original IDs, buckets, paths and
timestamps in a restricted local receipt journal, preserves supplied MIME
types, streams through a temporary file, and verifies complete downloaded R2
bytes with SHA-256. Existing target objects are never overwritten, reruns
revalidate them, changed sizes fail, and source redirects are refused to prevent
credential forwarding. There is no deletion or traffic-switch operation.
Default execution only validates inventory; `--execute` is required for copying.
Nine local unit tests passed with an in-memory S3 test double. This does not
prove live R2 operation, bucket privacy, successful copying or production flows.

## Before/after and cost report

| Metric | Before | After this turn |
| --- | --- | --- |
| Supabase database bytes | Current unknown; historical ~1,593 MB on Sept 25 | Current unknown; no data removed |
| Supabase Storage bytes | Unknown | Unknown; no objects moved/deleted |
| Monthly egress/API usage | Unknown | Unknown |
| Current free-plan headroom | Unknown; outage prevents usable DB | Not restored or verified |
| Cloudflare resources created | None observed | None created |
| Data copied and verified | None | None |
| Production environment variables added | None | None |
| Auth/RLS changes | None | None |

The migration runner expects operator-only `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, and `R2_MIGRATION_BUCKET`. These were not added to
production, and must not be pasted into chat or committed. Inventory/receipts
can contain private object paths; keep them in ignored `work/`, mode 0600.

Official Cloudflare pricing/limits checked October 1:

- R2 Standard includes 10 GB-month storage, 1 million Class A operations and
  10 million Class B operations each month, with no egress charge. Beyond those
  allowances storage is $0.015/GB-month, A operations $4.50/million and B
  operations $0.36/million. Verification reads and migration writes count.
- D1 Workers Free includes 5 GB total storage, but each database is limited to
  500 MB and accounts to 10 databases. Daily limits are 5 million rows read and
  100,000 rows written; indexes increase writes. Import/search design must
  respect these limits. Free limits can block work rather than guarantee
  unlimited availability. Full-corpus sharding must be measured first.
- Vectorize Free allows 5 million stored dimensions and 30 million queried
  dimensions/month. At the existing schema's 1,536 dimensions this stores at
  most 3,255 vectors; embedding all historical 175,424 chunks would need about
  269.45 million stored dimensions. Actual populated vector count is unknown.
  Do not create an index for the entire corpus under an assumed free allowance.
- Existing AI model calls, Vercel and Railway remain separate potential costs.
  No paid plan, card, or recurring subscription was accepted in this turn.
  Cloudflare account activation/payment terms must be reviewed by the owner.

Sources:
https://developers.cloudflare.com/r2/pricing/
https://developers.cloudflare.com/r2/examples/aws/boto3/
https://developers.cloudflare.com/d1/platform/pricing/
https://developers.cloudflare.com/d1/platform/limits/
https://developers.cloudflare.com/vectorize/platform/pricing/

## Recovery and release gates

1. Restore read access to the existing Supabase database without resetting it
   or discarding Auth/private data. The already-attempted restart did not fix
   the incident. Provider assistance may be needed for out-of-disk recovery;
   no support message was sent without the owner's explicit authorization.
2. Complete Cloudflare access and inspect account plan, privacy and remaining
   capacity before provisioning free resources. No bot safeguard is bypassed.
3. Run audit sections, obtain a consistent inventory/export and classify public
   versus private rows. Copy approved workloads, verify all bytes and IDs, then
   implement/verify all provider-aware callers including Docling artifacts.
4. Shadow/dual operations as needed; benchmark current versus replacement
   retrieval with citation identity, jurisdiction, date and source-rights
   checks. Then switch selected traffic and monitor. Retain rollback copies.
5. Only after production proof consider old-data removal with explicit approval.
   Row deletion does not promise immediate physical-disk reclamation. Do not
   run `VACUUM FULL` on an exhausted production volume as a blind cleanup.
6. Verify signup, confirmation/login/recovery and existing users; firm/matter
   negative isolation tests; upload/processing/retrieval; legal search;
   RAG/citations; real agent execution; generated files; Vault, Skills,
   Workflows, Monitor and Office flows. Backend outage blocks these acceptance
   tests today. LOCKE is **not ready for a law-firm trial** on current evidence.

Ingestion remains paused from the earlier incident response to prevent the
workers adding data into an unavailable/full database. Do not resume until
capacity and successful bounded processing are demonstrated.
