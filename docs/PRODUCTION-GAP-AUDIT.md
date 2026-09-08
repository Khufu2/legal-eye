# Legal Eye production gap audit

Audit date: **2026-09-08**. Target: a defensible enterprise legal-intelligence product suitable
for a global bank or top-tier firm. This audit separates implemented foundations from operationally
proven capabilities. A screen or database table does not count as a working product capability.

## Executive finding

Legal Eye currently has a credible architecture, a strong premium product prototype, a live
Supabase control plane, policy-gated source registry and deployed Edge APIs. It is **not yet a fully
functional legal operating system**. The public catalogue contains 5,495 official Tanzania OAG
records, 250 EUR-Lex records and 20 UK records, but the structural processing queues have not yet produced searchable
legal text chunks, structured legislation expressions, case opinions or citation edges. A demo
organization and owner exist; real client matters and firm work product do not.

## Capability ledger

| Objective | Implemented | Missing before production acceptance |
| --- | --- | --- |
| Premium connected UI | Authenticated cited Research, AI-assisted clause drafting, pasted-text contract Review, private Vault upload/queue, live corpus Monitor, plus Editor, Tables, Agent, Skills, Workflows, Lists and Matters interaction surfaces | Persisted research/draft/review work product, database-backed mutations across remaining surfaces, permissions-aware states, accessibility QA and collaborative error recovery |
| OpenContracts | Audited MIT commit, adapter contract and Cloud Build boundary | Running API/workers, dedicated database/Redis, tenant adapter, migrations, health/load/contract tests and upstream security hardening |
| Docling | Live queue/artifact/chunk schema plus a private parser service and bounded worker with policy recheck, host/MIME/signature limits, mandatory malware-scanner gate, leases, heartbeat, retry/dead-letter handling, canonical artifacts and exact-span chunk mapping | Deploy the signed private image and scanner, drain a controlled batch, then complete golden-document, load and recovery tests |
| LangGraph | Inspectable plan/execute/review/deliver service with human checkpoint | Running service, durable queue/retry/idempotency, token exchange, cancellation, failure injection, observability and recovery drills |
| Public corpus | 136 registered sources; Tanzania OAG, UK and EUR-Lex policy-approved; 5,765 governed metadata records | Completed PDF retrieval, structural CLML/AKN/CELLAR parsing, cases, courts, citations, versions, amendments, authority treatment, embeddings and reconciliation |
| African moat | 5,495 official Tanzania OAG catalogue records, 30 jurisdictions and 12 parser plug-in registrations | Process the queued PDFs, ingest judgments/Gazettes, build court hierarchy, citation fixtures, treatment graph and lawyer QA |
| Legal research | Authenticated evidence-gated Vercel AI Gateway flow, hybrid retrieval, public/private separation, DLP and generation audit hashes | Searchable evidence corpus, temporal/authority ranking benchmarks, real citation verification and persisted research sessions |
| Drafting/editor | Premium editor prototype and template-licence schema | DOCX round-trip, track changes, styles, comments, version merge, template importer, clause bank, playbook enforcement and Word add-in |
| Tabular Review | Source-linked grid prototype | Upload/VDR ingest, job fan-out, persisted columns/cells, reviewer locks, confidence calibration, bulk retry, export and collaborative review |
| Agent/Skills/Workflows | Schemas, visible execution UX and service implementation | Persisted production runs, executable tools, version promotion, regression tests, permissions, schedules, approval routing and cost controls |
| Monitors | Source registry and policy-aware live feed | Schedulers, Gazette/regulator diffing, alerts, impact graph, client matching, change review and low-noise evaluation |
| Identity | RLS, role model and SCIM 2.0 endpoint | Supabase SAML plan/config, verified domains, IdP metadata, SCIM token, lifecycle conformance, MFA/session policies and access recertification |
| Data protection | DLP scanner/events, data classifications and KMS reference schema | Cloud KMS/CMEK, tenant envelope encryption, retention/legal hold, regional routing, provider agreements, deletion evidence and DLP testing |
| Evaluation | 23 draft cases across two datasets | Lawyer-authored African/global gold sets, completed runs, citation/temporal/retrieval thresholds, adversarial set, bias review and release gates |
| Security/compliance | RLS, security CI and audit schemas | Enable leaked-password protection, resolve performance lints, complete external penetration testing, threat modelling, DR exercise, SOC 2/ISO mapping, DPIA, vendor review and populated evidence register |
| Integrations | OpenContracts/Docling/LangGraph boundaries | DMS/VDR, Microsoft Word, Outlook, email, portal, authorised commercial-provider adapters and customer KMS/identity integrations |
| Mobile/low bandwidth | Responsive prototype | PWA/offline cache, resumable uploads, bandwidth modes, native/share-sheet flows, accessibility and real-device testing |

## Current live-data evidence

- Supabase project `Legal` is healthy on PostgreSQL 17 in `eu-central-1`.
- 136 source-registry records, 30 jurisdictions and 12 citation-parser registrations exist.
- 5,495 Tanzania OAG, 250 EUR-Lex and 20 UK legal-document metadata records exist. The Tanzania run preserved
  5,495 source objects and queued 5,495 official-PDF fetch/Docling jobs; the EU run preserved 250
  CELLAR metadata objects and queued 250 rights-aware structured-content jobs.
- Zero legal text chunks, authorities, citation edges, legislation works/expressions, private
  documents, matters, review projects, agent runs, workflows, monitors, SSO providers, SCIM tokens,
  evaluation runs, security-test runs or compliance-evidence records exist.
- Nine Edge Functions are active. `legal-api` is JWT-protected; `legal-scim` uses a custom SCIM
  bearer-token boundary. AI providers remain disabled until secrets and contractual controls pass.
- Supabase reports one security warning: leaked-password protection is disabled. Performance advice
  still includes unindexed foreign keys and overlapping permissive RLS policies that must be
  resolved and benchmarked.
- The 2026-09-04 frontend refresh passes the production build, unit tests, ESLint, Python service
  compilation and repository secret scan. Dependency upgrades removed all high-severity npm
  findings; four moderate development-only findings remain through Drizzle Kit's legacy esbuild
  loader and require an upstream-safe migration rather than a forced downgrade.

## 2026-09-08 verification delta

- A read-only public Data API check reconfirmed 5,495 Tanzania, 20 UK and 250 EU catalogue records
  (5,765 total) and zero publicly readable `document_chunks`, `authorities` and `citation_edges`.
- The durable processing migration is applied in production. Operator verification found 5,745
  queued jobs, zero dead-lettered jobs, four worker RPCs, and zero extracted legal chunks/artifacts.
- `legal-process-document`, `legal-corpus-ingest`, and the hardened `legal-api` were redeployed to
  the Legal project. The API accepts modern Supabase key formats and restricts browser CORS to the
  production Legal Eye origin.
- The Next.js application now uses Vercel AI Gateway through OIDC for authenticated research,
  drafting and structured review. Research remains evidence-gated; no verified chunks means no
  synthesized legal conclusion. Requests are attributed per user and generation hashes/usage are
  recorded without persisting prompt or response content.
- The native Next.js production build, TypeScript and direct ESLint checks pass on Windows.
- No GCP project/runtime credentials or malware-scanner endpoint were available in this checkout;
  the worker therefore remains intentionally undeployed and fail-closed.

## Critical path

1. Activate app-owned authentication, create the first organization and replace illustrative UI
   data with real matter/document/research state.
2. Deploy Docling, OpenContracts and LangGraph in the chosen Google Cloud production project;
   complete service-to-service IAM, queues, storage, KMS and observability.
3. Ingest and structurally parse the first legally approved Tanzanian corpus, then build the court,
   citation, treatment and temporal graph around a lawyer-verified gold set.
4. Make Research, Upload, Review, Editor and Agent one complete end-to-end workflow before widening
   feature coverage.
5. Configure SAML/SCIM, complete isolation and lifecycle tests, then run an external security and
   disaster-recovery assessment.
6. Admit pilot matters only after quantitative quality thresholds, contractual source rights and
   compliance evidence are signed off.

## Acceptance rule

Do not describe Legal Eye as bank-production-ready until every applicable row above has a named
owner, operating evidence, measurable threshold, approver and expiry/retest date. The architecture
is suitable for the target; operational proof is the remaining work.
