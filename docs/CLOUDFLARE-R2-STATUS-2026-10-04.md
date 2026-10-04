# LOCKE R2 activation and migration status — 4 October 2026

This status supersedes the Cloudflare activation and current backend-health statements in the October 1 and October 3 audits. It does not supersede their feature acceptance requirements.

## Completed infrastructure

Cloudflare account `d860815c96d0d453f53a3a1b21bace76` now returns HTTP 200 for R2 bucket listing. The owner completed R2 subscription activation.

Created R2 Standard buckets:
- `locke-corpus`: raw official corpus bodies and eligible public artifacts.
- `locke-private-files`: planned firm document/artifact destination.

Both buckets use the EEUR location hint. This is a location hint, not a jurisdiction guarantee. Both managed r2.dev domains are disabled and both custom-domain lists are empty. No public access, CORS rules, new application credentials or application traffic cutover was configured.

Uploaded a non-sensitive activation receipt to `locke-corpus/migration/activation-2026-10-04.json`. Upload and subsequent object listing succeeded. Listed size is 179 bytes; the single-part ETag `14b5830f3e99187ae3930068a0684b12` matches the local payload MD5. Full-body GET through the connector returns a tool error labelled HTTP 200, so complete-byte download verification is not established. The receipt contains no client or source data.

## Renewed source database outage

Observed at approximately 03:31 UTC (06:31 Tanzania time):

- Management SQL fails with ECONNREFUSED at the project's Postgres endpoint.
- Anonymous data API returns HTTP 503, PGRST002: could not query database for schema cache.
- Management metadata still says ACTIVE_HEALTHY; this coarse flag contradicts actual connection tests and is not proof of availability.
- Latest returned Postgres logs are from October 3, 14:17 UTC. They report a failed checkpoint, “No space left on device”, failed recovery startup and “database system is shut down”. These logs establish the latest recorded failure; no successful later startup was returned.

No repeated restart, reset, data deletion, unpause of importers or paid Supabase upgrade was performed.

## Migration outcome

Source corpus bytes copied: **0**.
Private storage objects copied: **0**.
Application traffic switched: **none**.
Supabase disk reclaimed: **none**.
Free-plan target and lawyer-pilot readiness: **not achieved**.

An export cannot proceed while the source is unavailable. The approximately 138 MB Storage files are not the main PostgreSQL pressure; the October 3 snapshot measured 1.75 GB database and roughly 1.70 GB uncompressed raw-ingestion content. Existing copies and production data remain intact.

The connected Railway OAuth tool exposes variable names, not existing backend secret values. Vercel contains only public Supabase URL/publishable-key environment variables. No service credential or R2 S3 credential was retrieved, recreated or exposed. The existing storage copy runner needs secure operator credentials after recovery.

## Exact continuation

1. Supabase must recover existing project `ylkntvwvqzzmwstjejei` with sufficient temporary disk headroom for checkpoint/startup and export. Do not reset the project or discard Auth/firm data.
2. Recheck SQL and REST. Export a fresh approved-source inventory with immutable IDs, hashes and source rights.
3. Copy raw bodies and eligible artifacts to `locke-corpus`, and reviewed firm objects to `locke-private-files`. Verify downloaded SHA-256 and size for every object; retain source data and rollback records.
4. Implement provider-aware reads/writes in ingest, Docling, upload, download and deletion paths. Authorize firm objects using caller JWT/RLS before granting short-lived access.
5. Complete public search offload design and benchmarks: copying raw bodies alone cannot remove the approximately 1.08 GB chunk table/index footprint. Do not promise the free-plan goal from R2 provisioning alone.
6. Switch selected traffic only after live acceptance; consider removal of obsolete DB copies only after explicit authorization and a tested recovery plan.
7. Restore a bounded private Docling allowlist and verify a new synthetic upload, then authenticated research, saved drafts, review, agents and workflows before lawyer handoff.

## Recovery request text

Project: Legal (`ylkntvwvqzzmwstjejei`), eu-central-1.

The database is unavailable again. SQL connects with ECONNREFUSED and REST returns HTTP 503/PGRST002. Latest returned Postgres logs from 2026-10-03 14:17 UTC show “No space left on device”, failed recovery startup and shutdown, despite ACTIVE_HEALTHY management metadata.

Please recover the existing database without reset or data loss and provide enough temporary disk headroom to checkpoint/start and export bulky corpus bodies. R2 is now activated and private destination buckets are provisioned. We plan a verified offload while retaining authentication and private firm records. Please confirm a safe recovery/export route and whether temporary capacity requires a billing change before applying it.

No support message was sent in this turn; no support connector is exposed.
