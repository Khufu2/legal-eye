# Legal Eye — Legora parity audit (September 2026)

This is a product/implementation audit, not a marketing comparison. A feature counts as **implemented** only when the repository contains a usable end-to-end workflow; a visual mock, static demo rows, toast-only action or placeholder control is **partial**.

Official Legora product surface reviewed in September 2026:

- aOS / Agent
- Assistant
- Legal Research
- Editor
- Tabular Review
- Workflows
- Lists
- Monitors
- Portal
- Mobile app
- Word Add-in
- Outlook Add-in
- firm database search / file intelligence
- translation and drafting/review actions embedded into workflows

## Executive result

Legal Eye already has the **correct desktop information architecture** and a meaningful amount of backend infrastructure, but it is **not yet at full Legora feature parity**.

The first UI implementation deliberately created the full workspace vocabulary early. Several modules are currently convincing product shells around incomplete execution paths. Those should not be represented to customers as production-complete until the gaps below are closed.

## Feature-by-feature status

| Legora capability | Legal Eye surface | Status | What is real today | Remaining work |
|---|---|---:|---|---|
| Assistant | Ask | Partial | Routes questions into Legal Eye research; matter/jurisdiction context visible | Persistent assistant threads, true conversation history, thread titles, thread search, cross-device sync, file-scoped chat, multi-tool selection |
| Legal Research | Research | Strong partial | Live `/api/legal-ai` research call, governed corpus retrieval, citations/source viewer, public + firm context model | Parallel multi-query research, stronger authority ranking/treatment, full source verification pipeline, richer research history, export/save-to-matter |
| Editor | Draft | Partial | Live AI draft request, document-style canvas, playbook suggestion surface | Real rich-text editor, tracked changes, comments, collaborative presence, section-aware drafting, citation anchors, template-preserving DOCX export/import |
| Tabular Review | Tables | Prototype/partial | Correct spreadsheet/review UX vocabulary and source-confidence affordances | Real document-set ingestion, AI columns, persistent cells, filters/sorts, cell locking, review state, reviewer identity, collaboration, exports, large-set processing |
| Workflows | Workflows | Prototype/partial | Natural-language builder UI and connected-step model | Persisted workflow schema, actual execution engine, step tools, branching/conditions, retries, tests, versions, run history, permissions, human approvals |
| Agent | Agent | Prototype/partial | Visible planning/execution/review timeline and human checkpoint UX | Real agent orchestration, autonomous tool choice, durable runs, pause/resume, tool records, evidence verification, human approval enforcement, delivery artifacts |
| Skills / firm standards | Skills | Prototype/partial | Versioned skill UX, tests/versions/permissions vocabulary | CRUD, persistence, real test harness, version diffs, approval workflow, tool permissions, reusable runtime instructions |
| Lists | Lists | Prototype/partial | Closing-list UI with source, owner and status concepts | Agent-populated rows, persistent assignments/status/comments, deadlines, source anchors, audit history, templates, sign-off and team collaboration |
| Monitors | Monitor | Partial | Real source registry/corpus policy state and official document feed | Continuous scheduled monitoring, change detection/diffing, topic/jurisdiction subscriptions, impact classification, owner assignment, alerts, audit trail, affected-client matching |
| Files / database intelligence | Vault | Strong partial | Private Supabase storage upload, org-scoped records, document-processing queue, firm/public separation | Full folder navigation, file search, previews, versioning, matter linking, permissions UI, file-scoped assistant, deduplication, retention controls |
| Mobile app | Responsive web | Gap / early partial | Responsive web shell and core pages | Purpose-built Assistant + Files mobile experience, persistent threads, file browser/search/viewer, cross-device sync, push notifications, native auth/secure storage; native iOS/Android wrapper/app if required |
| Word Add-in | None | Missing | — | Office add-in, in-document Assistant/Agent, redline, playbooks, clause drafting, anonymize, improve writing, translate, save back to matter |
| Outlook Add-in | None | Missing | — | Thread summarization, reply drafting, tone/refinement, attachment-to-matter save, email-to-assistant workflow |
| Portal | None | Missing | — | Client/external collaborator portal, firm branding, guest access, per-matter publishing, workflows/tables/files sharing, comments/collaboration, granular permissions |
| Translation | No dedicated production tool | Missing/partial | Language architecture exists in product strategy | Translation action across Assistant, Editor, files and Workflows; source/original pairing; formatting-preserving document translation |
| Database Search | Corpus/Vault foundations | Partial | Legal corpus + private vault data model | Unified searchable internal database tool as an Assistant/Workflow tool with permission-aware retrieval |
| Web Search | No dedicated Assistant tool | Missing/partial | Legal research API may use configured providers, but no explicit user-facing web-search tool | Governed web search with source capture, domain filters, date controls and matter saving |
| Collaboration | Scattered UX concepts | Missing/partial | Roles/org RLS and review-state vocabulary | Presence, comments, mentions, assignments, shared live state, notifications, change history and approvals across Editor/Tables/Lists/Portal |
| Client delivery | Export buttons / Trust concepts | Missing/partial | UI affordances | Finished artifact packaging, branded delivery, Portal publication, approval chain and auditable external sharing |

## Important distinction: mobile

Legora itself does **not** put the complete desktop product on a phone. Its 2026 mobile product is intentionally centered on:

1. starting and continuing Assistant threads,
2. browsing/searching files across matters,
3. asking questions of files and producing summaries/key points,
4. running legal/open-web research through Assistant,
5. keeping thread/context history synced across devices.

Drafting, Tabular Review and Workflows remain primarily desktop experiences. Legal Eye should follow the same product logic rather than trying to compress every desktop workspace into one phone screen.

The current Legal Eye responsive site is therefore being refined toward **mobile assistant + file intelligence first**, while preserving access to the rest of the product through navigation.

## What Legal Eye should exceed rather than copy

Parity is the floor. Legal Eye's defensible product advantages should remain:

- African legal corpus depth and jurisdiction normalization
- Tanzanian primary-law quality and temporal/versioned legislation
- African court hierarchy and authority treatment
- Gazette and regulator monitoring across African jurisdictions
- OHADA, AfCFTA, regional courts and cross-border African comparison
- multilingual legal retrieval (English, Kiswahili, French, Portuguese and later Arabic)
- public authority graph separated from private firm intelligence
- low-bandwidth/mobile-conscious delivery
- citation normalization across fragmented African sources
- permission-isolated firm learning and lawyer-verification flywheel

## Priority implementation sequence

### P0 — complete the core lawyer loop

- Persistent Assistant threads + history
- Matter/project selector backed by real data
- File browser/search/view/query
- Research save/export/history
- Editor rich text + tracked changes + DOCX roundtrip
- Tabular Review real document ingestion + persistent AI columns/cells

### P1 — make the platform operationally agentic

- Durable Agent execution and tool orchestration
- Workflow persistence/execution/versioning/tests
- Skills persistence/approval/tests
- Lists persistence, Agent population and audit trail
- Monitors scheduled scanning/change detection/alerts

### P2 — meet the surrounding-tool footprint

- Client Portal
- Word Add-in
- Outlook Add-in / Email-the-Assistant equivalent
- dedicated web search and internal database search tools
- translation action
- cross-surface collaboration, comments, mentions and notifications

### P3 — native mobile

Build only after Assistant threads, file intelligence and sync are durable on web. The first mobile release should be narrow and excellent rather than a miniature desktop client.

## Product rule

Do not mark a Legora-parity item complete merely because a page exists. Completion means the workflow persists data, enforces permissions, runs end to end, retains provenance/audit information where relevant, and survives reload/session/device transitions.
