# Production readiness gate

Status as of 2026-09-24: **verified self-service onboarding and firm administration are implemented; unrestricted client-work handover remains unverified**.
A supervised evaluation using public law and fictional or de-identified documents can begin. The broader gates below track firm-production and enterprise readiness; enterprise certifications are not prerequisites for a synthetic pilot.

| Gate | Current evidence | Acceptance requirement |
| --- | --- | --- |
| Application and design system | Legal Eye premium workspace and connected modules build successfully | Accessibility, performance and browser matrix signed off |
| Database isolation | Rollback-safe live tests pass for firm provisioning, invitation email binding, role escalation denial, last-owner protection, suspended members and foreign document/agent visibility | Full matter/portal/storage isolation coverage and independent review |
| AI routing | Gemini research, private review, table extraction and checklist generation succeeded live; editor AI and agent end-to-end acceptance remain outstanding | Keys, contracts, regional routing, red-team and quality/cost SLOs |
| Document parsing | Private Docling worker processed a synthetic upload to a searchable chunk; JSON artifact MIME and infrastructure retry fixed | Deployed private service, malware gate, golden corpus and load tests |
| Agent orchestration | LangGraph service with visible events and human checkpoint | Deployed service, durable retry/replay tests and failure injection |
| OpenContracts | Audited commit and isolated service build definition | Deployed API/workers, adapter contract tests and security hardening |
| Corpus | 26,156 records, 25,728 searchable documents and 171,280 chunks at 18:38 UTC on 24 September; AU/EU ingestion active; Canada access-blocked; UK empty HTTP 202 responses deferred | Licensed source agreements, full structural bodies, reconciliation and lawyer QA |
| SSO/SCIM | SCIM endpoint implemented; SAML schema/policies prepared | Supabase Pro, IdP metadata/domain, conformance and lifecycle tests |
| Encryption/DLP | Classification, DLP events and KMS reference model | Cloud KMS/CMEK deployed, rotation/revocation and data-loss exercises |
| Evaluation | Synthetic smoke set plus 20 source-backed UK normalization cases | Lawyer-authored African/global gold sets, thresholds, regression and bias review |
| Security | CI policy and control inventory | Threat model, external penetration test, remediation, DR and incident exercise |
| Compliance | Evidence registry schema | Approved SOC 2/ISO 27001 control mapping, DPIA, vendor/legal reviews |

No customer production data should enter the system until every applicable gate has a named owner,
dated evidence, approver and expiry. “Implemented” is not interchangeable with “certified” or
“operationally proven.”


## Live acceptance evidence — 19 September 2026

- Research generated cited answers, saved and reopened. Fixed missing research_sessions.updated_at. A page-boundary omission caused an unsupported amendment claim; adjacent-page retrieval and excerpt-aware instructions corrected the tested answer. This is not a broad legal-accuracy benchmark.
- Private synthetic agreement review generated and saved three findings; a finding was accepted. Gemini initially rejected structured output complexity. Shared provider schemas now omit array bounds while preserving full server-side Zod validation; a regression test verifies rejected invalid outputs.
- Tabular extraction saved one row with verified quotes; absent change-of-control language returned Not found. Mark-reviewed persisted.
- Checklist generation saved two source-linked obligations from the synthetic agreement.
- Previously verified: synthetic upload/processing, manual draft save/reopen and valid Word export, manual workflow creation and human approval through completion.
- Deployment e48c0e63b4784d7d2918f5e9e34ea672622ad47b is READY. Review instructions are now editable and default instructions no longer presume regulatory approvals. Build and focused tests passed.
- Still required before ordinary client-work handover: representative lawyer accuracy review, tenant/matter isolation tests, operational recovery checks, and acceptance of remaining AI/editor/agent/portal/Office flows. Corpus coverage/currentness and licensed-content parity remain incomplete; UK ingestion update has not been verified deployed.


## 24 September 2026 onboarding and corpus update

- Added email/password registration, confirmation callback handling, first-firm creation, password recovery, sign-out revocation and switching between existing firm memberships. No shared demo session is created.
- Fixed the first-firm RPC: invoker RLS rejected insertion before membership existed. The bounded definer operation checks the authenticated, non-anonymous, email-confirmed caller, validates inputs, creates only their own firm and owner membership atomically, and supports a safe retry. Anonymous execution is revoked.
- Added seven-day invitations bound to verified recipient email; only token hashes are stored. Owners/admins can create and revoke links, manage roles and suspend/restore members. Direct member mutation is revoked; the controlled RPC prevents removal of the last active owner. Invitation links are shared manually; the app does not claim to send them.
- Added live rollback-only database suites in tests/firm-onboarding.sql and tests/firm-invitations.sql. Both pass, as does tests/cross-firm-isolation.sql. These are database authorization tests, not proof of email delivery or full browser onboarding.
- Supabase public Auth settings verified: signup enabled, email enabled, anonymous accounts disabled, email auto-confirm disabled. Custom SMTP, sender-domain setup and confirmation/reset email delivery still need authenticated dashboard verification.
- Next.js production build, the full npm test command (Vinext build plus 13 Node tests), and seven Python corpus tests pass. Fixed the build script invocation so checked-out scripts do not require executable file bits.
- UK source returned an empty 202 Accepted, causing repeated XML parse failures. Added explicit deferred-source handling and Atom-root validation without advancing the checkpoint. No source restriction was bypassed.
- Trust now displays blocked/retrying source states rather than treating every enabled connector as healthy.

### Remaining handover requirements

1. Verify real confirmation and password-reset delivery, and the full register → confirm → firm creation → invite acceptance → recovery flow. Supabase site URL must be the production origin; allow the production `/reset-password` redirect.
2. Complete lawyer acceptance for editor AI, agent execution, client portal and Office add-ins, including failures and recovery. Existing synthetic successes are documented above; they do not establish legal accuracy across jurisdictions.
3. Resolve Canada's access review and the UK's deferred source responses; reconcile missing documents and currentness. Corpus totals are counts, not a completeness or competitor-parity claim. Licensed publisher material needs its own rights and access.
4. Verify restore/recovery, monitoring and contractual handling of real client data before ordinary client-work handover.

## 26 September 2026 release evidence

- Office: guarded Word replacement, escaped Outlook reply HTML, callback-confirmed reply/cursor insertion, compose-subject support, bounded inputs instead of silent truncation. Session renewal and revocation added to Office and client portal; legacy non-refreshable tokens discarded.
- Portal: reject generated citations unless their quotes occur in explicitly published source text. Model page numbers are not presented as verified. Empty evidence returns an explicit inability to answer.
- Agent: optional server-side run persistence records running, failed and needs-review outcomes; only actually read private documents are labelled used. Generation has a 45-second abort budget. This is not a durable background-worker acceptance result.
- Automated evidence: 17 Node tests passed on 25 September; Next production build passed. Office host adapters were tested with synthetic host doubles, not a live Word/Outlook installation.
- Proposed indexed retrieval SQL returned the expected authority/citation in all 15 Tanzanian retrieval cases against the live corpus. The original benchmark timed out. This tests retrieval, not generated-answer accuracy or current-law completeness.
- Pending database migrations: active portal revocation/publication validation and indexed retrieval. Both migration attempts must use write-authorized access; the current connector rejected DDL with SQLSTATE 25006. Do not disable read-only protection to apply them. Portal isolation test exists but has not run successfully.
- Corpus snapshot 25 September 08:22 UTC: 26,996 records, 26,568 searchable documents, 175,424 chunks, 5 sources. Approved AU/EU workers were writing successfully; CA remained access-blocked and UK deferred. No proprietary competitor-corpus parity claim.
- No full production acceptance claim: real account email flows, AI/editor/agent/portal end-to-end operation, native Office host behavior, lawyer quality review and operational recovery remain outstanding.
