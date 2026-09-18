# Legal Eye compared with Legora — 15 September 2026

This is a feature inventory, not a claim of Legora equivalence. Code exists does not mean an authenticated end-to-end test has passed. Cathedral production was inspected as a visual reference; no Cathedral files or deployments were changed.

## Comparison

| Legora capability | Legal Eye implementation | Remaining verification / gap |
|---|---|---|
| Conversational legal research, follow-ups, cited sources | Indexed source-governed retrieval, exact passage panel, original URLs, saved threads, history search, jurisdiction filters, matter-scoped private evidence | Authenticated question → answer → passage test; professional quality benchmark; comprehensive authority treatment and licensed datasets |
| Cross-jurisdiction research | Jurisdiction selection; evidence includes jurisdiction and provenance | Coverage is uneven. TZ, UK, EU, CA, AU have catalogue entries. Other selections can return no evidence; they are not claims of coverage. |
| Tabular Review | Private document extraction, source-quote validation, saved tables, custom columns, row filtering, editable values, row review and locks, CSV | Authenticated multi-document test; 12-document API batch limit, not thousands; DMS/VDR imports and simultaneous cell collaboration not verified |
| Editor | Draft generation, text editing and formatted preview, save/version/restore, comments, reviewed AI proposals, translation, DOCX/TXT/Markdown import, real DOCX export | Authenticated save/reopen/import/export test; Word-native tracked-change interoperability and lossless rich DOCX import not implemented. Import extracts text. |
| Agent | Bounded AI SDK tool loop with primary-law search and selected private document reading; timeline derives from executed tools; Word export | Authenticated model test. Not an unrestricted background agent or autonomous external filing/delivery service. |
| Skills | Persisted firm instructions, versioned skills and execution through the agent | Firm evaluation sets and approved-playbook operational testing |
| Workflows | Persisted graph; immutable per-run snapshot; step results, optimistic execution leases, retry/resume/cancel, human approval notes, run history/export | Authenticated checkpoint/reload test; unresolved conditional edges deliberately block execution. Upload-triggered unattended workflows and graph editing are not implemented. |
| Lists | Source-derived checklists, history, status, due dates, self-assignment, Word export | Arbitrary team assignment, bulk operations and calendar sync |
| Monitors | Scheduled 15-minute source catalogue scans, manual scan, deduplication, pause/resume, triage, assign-to-self, resolve/dismiss | Matches catalogue titles/citations, not a comprehensive legislative redline service. Legal impact still requires review. No external email notifications configured. |
| Portal | Existing invitation, external access, shared work and portal assistant routes retained | Separate host and guest authenticated acceptance tests |
| Word add-in | Existing Office task pane and manifest retained; direct Office API integration exists | Sideload/tenant deployment and Word-host acceptance tests |
| Outlook add-in | Existing Office task pane and manifest retained | Outlook-host acceptance test and tenant deployment |
| Mobile | Responsive browser/PWA shell and bottom navigation | Native iOS/Android app is not implemented; mobile viewport verification still required |
| Enterprise knowledge integrations | Private Supabase vault and processing pipeline | No equivalent iManage/NetDocuments/SharePoint/VDR integration certified or verified |
| Security/governance | Organization/matter RLS retained, source registry gates, approval checkpoints, existing trust controls | Independent audit, SAML/SCIM operational proof, DR exercise and legal evaluation are not replaced by UI work |

## Visual specification

Cathedral live reference: Geist typography; charcoal #242529 canvas; 76 px top navigation; 1320 px shell; approximately 820 px question composer; 24 px composer radius; 68 px desktop hero heading; muted borders and generous whitespace. Legal Eye uses its own eye mark and legal modules with those proportions. Light mode, compact mobile navigation and reduced-motion handling are included. Pixel equivalence must be judged against rendered screenshots, not this specification.

## Verification recorded so far

- Production Next.js build passed after the main functional changes.
- Four focused core tests passed: dependency ordering, cycle/conditional blocking, query term handling, and genuine OOXML ZIP export.
- Public-role source retrieval returned 12 passages from 7 documents with original URLs for the employment-termination query. The same authenticated-role query improved from 47.8 seconds to 13.9 seconds after indexing and a bounded public-only search function with an explicit approved/display-rights predicate. Private retrieval remains under caller RLS.
- At 19:28 UTC: 19,182 catalogue records; 18,655 documents with searchable chunks; 143,794 chunks. Live ingestion continues; these are a timestamped observation.
- Extra Railway open-corpus deployment succeeded and logs show successful official-source fetches and Supabase chunk inserts.
- `legal-eye-source-monitors` is active on `*/15 * * * *`.
- Actual anonymous REST calls to `legal_corpus_overview` and `search_legal_evidence` succeeded. The former originally hit the API statement timeout; scoped RPC settings and public-only counting fixed that failure. The count request took 15.1 seconds including network overhead, so further latency optimization remains. Search returned 12 Tanzanian passages.
- Production release `0e1dc10` reached READY and the public desktop interface was inspected. Research history now has an explicit mobile close control; session loading ignores stale requests, and editor controls prevent switching or editing during a save.
- No authenticated end-to-end success is claimed without a valid organization session.

## Authenticated verification — 16 September 2026

- Secure browser sign-in succeeded; organization workspace and persisted draft library were visible.
- Created a clearly fictional agreement, saved version 1, navigated away, reopened it, and downloaded Word output. The downloaded DOCX passed ZIP integrity and XML parsing checks and contained the expected saved text.
- A full employment-law question exposed a source-search timeout. Public retrieval now filters permitted jurisdictions before ranking and tries all meaningful terms together before broader fallback. The precise REST query returned 11 passages; the same full question in the authenticated browser subsequently reached AI generation.
- AI generation is blocked by Vercel AI Gateway requiring a valid card on file. Both research and editor summarization returned that provider error. No generated answer, review, or AI workflow success is claimed.
- Upload initially failed because INSERT plus return=representation evaluated the document SELECT policy before the new row was visible to its stable helper. Upload and pasted-source creation now use client-generated UUIDs and return=minimal, followed by normal authenticated reads. No RLS policy was weakened.
- The synthetic TXT upload now persists and the processing API queues ingestion. The worker initially failed because the private bucket rejected its application/json parser artifact. A scoped bucket MIME migration fixed this; the retried ingestion job completed. The bucket remains private. Infrastructure failures can now be retried through the existing authenticated processing endpoint; blocked-file failures remain blocked.
- Upload and editor AI errors now remain visible on the page.
- Production Next.js build and the four core tests passed. Latest deployed application commit: b05a16e7c4a55670c21c3ba8538927a3b69ea4b3.

## Official comparison sources

[Agent](https://legora.com/product/agent), [Legal Research](https://legora.com/product/legal-research), [Tabular Review](https://legora.com/product/tabular-review), [Editor](https://legora.com/product/editor), [Workflows](https://legora.com/product/workflows), [Lists](https://legora.com/product/lists), [Monitors](https://legora.com/product/monitors), [Portal](https://legora.com/product/portal), [Word](https://legora.com/product/word-add-in), [Outlook](https://legora.com/product/outlook-add-in), [Mobile](https://legora.com/product/mobile-app).

Legora's publisher partnerships and geographic coverage are commercial/data work in addition to software. Legal Eye must obtain the necessary licensed sources; adding public legislation does not establish corpus parity.

## Follow-up hardening — 16 September 2026

Workflow creation now uses one security-invoker database transaction for the workflow, nodes and edges. It validates unique keys, supported step types and a lawyer approval checkpoint. Anonymous execution is revoked; existing caller RLS remains authoritative. The production build and four core tests pass. Authenticated AI-driven creation remains blocked by Gateway billing and is not claimed as verified.

The UK pagination and source failure-backoff worker changes are committed with five passing ingestion tests. Deployment must select the new commit explicitly: Railway redeploy reuses its previous commit. The Australian source is paused after repeated HTTP 403 responses. Catalogue size remains 19,182 at this checkpoint; no additional live ingestion is claimed without database evidence.

## 18 September 2026: manual workflow design

Added manual sequential workflow creation, editable step types/titles/instructions, add/remove/reorder controls and save-as-new editing of existing sequential designs. Saving uses the existing atomic caller-RLS RPC and requires a lawyer approval checkpoint. Branching graphs are rejected by this editor rather than silently flattened. Original workflows and run snapshots are preserved. Switching workflows ignores stale network responses and clears previous results. Production build and four core tests pass; authenticated browser acceptance of the new designer remains outstanding. The user reports billing has been activated; AI availability must be tested afresh rather than treating the earlier billing failure as current.
