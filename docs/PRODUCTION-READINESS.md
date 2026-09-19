# Production readiness gate

Status as of 2026-09-19: **core workflows pass synthetic live tests; unrestricted client-work handover is not approved**.
A supervised evaluation using public law and fictional or de-identified documents can begin. The broader gates below track firm-production and enterprise readiness; enterprise certifications are not prerequisites for a synthetic pilot.

| Gate | Current evidence | Acceptance requirement |
| --- | --- | --- |
| Application and design system | Legal Eye premium workspace and connected modules build successfully | Accessibility, performance and browser matrix signed off |
| Database isolation | RLS on product/control tables; public catalog constrained by source policy | Automated tenant/matter isolation suite and independent review |
| AI routing | Gemini research, private review, table extraction and checklist generation succeeded live; editor AI and agent end-to-end acceptance remain outstanding | Keys, contracts, regional routing, red-team and quality/cost SLOs |
| Document parsing | Private Docling worker processed a synthetic upload to a searchable chunk; JSON artifact MIME and infrastructure retry fixed | Deployed private service, malware gate, golden corpus and load tests |
| Agent orchestration | LangGraph service with visible events and human checkpoint | Deployed service, durable retry/replay tests and failure injection |
| OpenContracts | Audited commit and isolated service build definition | Deployed API/workers, adapter contract tests and security hardening |
| Corpus | 19,182 catalogue records across TZ, UK, EU, CA and AU; UK pagination fix committed; Australian 403 source paused | Licensed source agreements, full structural bodies, reconciliation and lawyer QA |
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
