# Production readiness gate

Status as of 2026-09-04: **foundation implemented; external production controls not yet accepted**.
This is the release gate for an institution comparable to Goldman Sachs or J.P. Morgan.

| Gate | Current evidence | Acceptance requirement |
| --- | --- | --- |
| Application and design system | Legal Eye premium workspace and connected modules build successfully | Accessibility, performance and browser matrix signed off |
| Database isolation | RLS on product/control tables; public catalog constrained by source policy | Automated tenant/matter isolation suite and independent review |
| AI routing | Gemini-first/OpenRouter-fallback gateway with DLP and hash-only telemetry | Keys, contracts, regional routing, red-team and quality/cost SLOs |
| Document parsing | Private Docling service image and structural artifact model | Deployed private service, malware gate, golden corpus and load tests |
| Agent orchestration | LangGraph service with visible events and human checkpoint | Deployed service, durable retry/replay tests and failure injection |
| OpenContracts | Audited commit and isolated service build definition | Deployed API/workers, adapter contract tests and security hardening |
| Corpus | 20 official UK metadata records with provenance and policy gate | Licensed source agreements, full structural bodies, reconciliation and lawyer QA |
| SSO/SCIM | SCIM endpoint implemented; SAML schema/policies prepared | Supabase Pro, IdP metadata/domain, conformance and lifecycle tests |
| Encryption/DLP | Classification, DLP events and KMS reference model | Cloud KMS/CMEK deployed, rotation/revocation and data-loss exercises |
| Evaluation | Synthetic smoke set plus 20 source-backed UK normalization cases | Lawyer-authored African/global gold sets, thresholds, regression and bias review |
| Security | CI policy and control inventory | Threat model, external penetration test, remediation, DR and incident exercise |
| Compliance | Evidence registry schema | Approved SOC 2/ISO 27001 control mapping, DPIA, vendor/legal reviews |

No customer production data should enter the system until every applicable gate has a named owner,
dated evidence, approver and expiry. “Implemented” is not interchangeable with “certified” or
“operationally proven.”

