# Locke release evidence — 5 October 2026

**Authenticated lawyer handover is blocked by Supabase disk exhaustion.** Public-law storage and retrieval on Cloudflare are working. This report supersedes yesterday's inventory and ingestion-running statements.

## Completed

Restored R2 checkpoint `backup-20261005T034956`: every compressed part and the complete archive passed SHA-256 verification, and the restored SQLite database passed its integrity check. Published the recovered inventory as `rebuild-20261005T170949`, after uploading and verifying all 256 shards for each of five jurisdictions and sealing each index.

| Jurisdiction | Published documents |
| --- | ---: |
| Tanzania | 5,561 |
| Canada | 5,861 |
| Australia | 33,247 |
| EU | 1,337 |
| UK | 1,340 |
| Total | 47,346 |

The snapshot contains **468,706 passages**. This remains an incomplete source rebuild, not a reconciled migration or a claim to contain all law. Australian discovery, source failures, UK feed limits and EU record limits remain as described in the previous report. Judgment coverage, amendments and legal currentness still require reconciliation and lawyer review.

The gateway now accepts pre-serialized index bytes, avoiding large JSON parsing/reserialization during upload while still verifying the exact stored bytes. A corruption regression test confirms that altered remote bytes are rejected. Legacy ingestion clients remain supported. Maintenance failures now back off independently for checkpoints and publication rather than immediately rebuilding another full generation.

The application now distinguishes a workspace service outage from invalid credentials or denied membership in the research API. Workspace callers show an availability message for provider outages and handle non-JSON responses without an unhelpful JSON parsing failure. These changes preserve authentication and membership requirements.

TypeScript and the full production build pass. All **23 Node tests and 19 Python tests** pass. The live 15-case Tanzania expected-title/citation benchmark passed against the preceding 32,789-document snapshot, which already contained the same 5,561 Tanzanian documents. That benchmark measures authority retrieval, not legal-answer correctness. A live Australian query also returned evidence successfully; it does not establish complete Australian authority coverage.

## Current blockers

- Supabase Legal `ylkntvwvqzzmwstjejei` refuses SQL connections. Its 5 October 12:41 UTC Postgres logs say `could not write to file "base/5/18903": No space left on device`, then startup failure and shutdown. REST returns 503 `PGRST002`; Auth health also returned 503 during this check. Management's `ACTIVE_HEALTHY` label does not establish database health.
- The supplied screenshot shows about 44 MB of current-cycle organization usage. That is not a successful measurement of the unavailable database's physical disk. Supabase documents that disk includes WAL/system files and usage snapshots can be stale when writes are blocked. The previous successful database measurement was about 1.75 GB.
- The Railway ingestion service was removed after its trial expired. Redeploy was rejected with an expired-trial message. This publication was completed from the recovered checkpoint in the execution workspace. No unattended ingestion service is now claimed to be running, and no Railway subscription was purchased.
- Secure dashboard sign-in was submitted, but an interactive hCaptcha blocks access to recovery controls. No dashboard recovery operation has been verified. No Supabase data was deleted and no paid upgrade was purchased.

## Remaining acceptance

After the database starts, inspect exact table sizes, dependencies and public-source inventories before removing any replaceable corpus content. Keep authentication, firms, roles, matter permissions and private operational data intact. A SQL delete is not proof that physical disk was reclaimed. Verify measured headroom after cleanup, pause old Supabase corpus writers, and confirm the app continues using Cloudflare evidence.

Then complete the existing lawyer pilot guide with real sessions: onboarding/login; private TXT/PDF/DOCX upload and processing; research with source inspection and save/reopen; drafting/editing/Word export; review and tables; agent/skills; workflow approval/retry; portal host/guest permissions; monitor/audit persistence; and cross-firm isolation. Native Word/Outlook acceptance remains outstanding. Semantic search, authority treatment and durable unattended agent/workflow gaps remain in the previous feature assessment. Do not describe them as completed features or claim Harvey/Legora parity.

## Prepared provider recovery request

Project: Legal (`ylkntvwvqzzmwstjejei`), organization Relay (`hzwaxdtaelrdgvbpfbzm`), region eu-central-1, Free plan. Postgres cannot finish startup because the physical disk is full; SQL connections are refused and REST/Auth are unavailable. Latest observed failure: 2026-10-05 12:41 UTC, `base/5/18903: No space left on device`, followed by shutdown. The dashboard usage display is low but cannot be reconciled against live SQL. Earlier pause/restore attempts did not recover service. Please restore sufficient disk headroom to start Postgres, preserving the existing schema, users and private data, so we can remove replaceable public-law content and stay within the free-plan database allowance. Public-law evidence has been rebuilt in private Cloudflare R2; authenticated application data still depends on this project.

This request is prepared, **not submitted** through a support channel in this turn.
