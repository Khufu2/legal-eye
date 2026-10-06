# Locke replacement and pilot evidence — 6 October 2026

**The replacement is deployed and its main authenticated API flows passed synthetic acceptance. Lawyer handover remains pending email delivery/recovery, browser onboarding and lawyer quality assessment.** This supersedes the deleted-project outage described in the 5 October report. It does not certify all features, comprehensive law coverage or Harvey/Legora parity.

## Replacement and storage

Created Supabase **Locke**, project `zvljalgjvenllfqepqnt`, in eu-central-1 on the existing Free organization. Verified SQL, Auth and REST, rebuilt the foundation and applied all 42 historical migrations plus integrity and storage hardening. Production at https://lockeslaw.sheenax.xyz/ now uses its URL and publishable key. The unrelated Relay/MARS project was not modified.

The database measured approximately **20 MB**, with **5,561 Tanzanian catalogue metadata records and zero public passage rows**. Public-law bulk writers are disabled. Public source files and **47,346 documents / 468,706 passages** remain in private Cloudflare R2 and are retrieved through the authenticated server gateway. No second full ingestion or transfer into Supabase was necessary. This is the recovered five-jurisdiction snapshot, not a complete collection of all law. Other jurisdictions' catalogue metadata is not mirrored for workspace monitors.

`supabase/bootstrap/README.md` records the fresh-project order. `scripts/cloudflare/catalog_metadata.py` produces bounded metadata-only SQL batches from the verified checkpoint. Source data, private records, account credentials and live tokens are not embedded in the reconstruction scripts. Deployment configuration and SMTP credentials still require separate service configuration.

## Verified behavior

| Area | Observed result |
| --- | --- |
| Backend and onboarding RPC | Three disposable verified Auth accounts could sign in, create their own firm idempotently and perform workspace CRUD |
| Tenant isolation | Second-firm reads and mutations returned no rows; foreign private processing was rejected; private Storage download was denied |
| Database permission regressions | Cross-firm isolation, portal isolation/publication/revocation, verified firm onboarding, email-bound firm invitations and ingestion recovery SQL checks passed |
| Private Vault | Live TXT, text-based PDF and DOCX uploads processed into Ready/searchable private chunks; stored source access used caller JWT and matter permissions |
| Drafts | Two saved versions persisted and reopened; OOXML export/import regression passed |
| Research | Live authenticated AI returned source-backed output; all 15 expected Tanzanian title/citation retrieval cases passed |
| Research-quality fix | A misconduct termination question initially retrieved unrelated employment passages. Inflection/issue weighting, distinct passage windows and a focused fairness query now retrieve the fair-procedure provision. The recheck cites the 2023 revised Act and explicitly identifies the missing detailed Code of Good Practice; lawyer correctness/currentness review remains necessary |
| Review, tables and lists | Live AI review, quoted table extraction and checklist generation returned successful responses; test table quote was verified against the selected private source |
| Skills and Agent | Instructions, selected-file reading, task timeline and generated result persisted; agent output remained marked for lawyer review |
| Transformation | Live Kiswahili transformation succeeded |
| Workflows | Persisted run paused at a human checkpoint, accepted a review note and completed the delivery step |
| Portal | Invited verified guest redeemed an email-bound invite, read only a published draft and used the portal question API; revocation regressions passed |
| Monitor and audit | A fresh Tanzania employment monitor created and stored nine catalogue events; authenticated generation telemetry was recorded through the deployed legal-api Edge Function; workspace change auditing persisted |
| Production and local checks | Vercel production deployment READY; app TypeScript check and all 28 Node tests passed; public application navigation rendered in the browser |

These are API, database and regression checks, not completed authenticated browser journeys or lawyer acceptance. Disposable test files, workspaces and Auth users were removed after testing. The account used for management is separate from app accounts.

## Authentication and handover

Saved production Site URL `https://lockeslaw.sheenax.xyz` and exact redirects for the application root and `/reset-password` in the new project's dashboard. Email sign-up and email confirmation remain enabled; verification was not bypassed. **Custom SMTP is not yet configured**, so arbitrary lawyer email verification/recovery is not proven. Complete the SMTP provider form using a verified sender and encrypted provider credentials, then test real email delivery, sign-up, confirmation, sign-in, recovery and a complete browser journey before inviting lawyers.

The dashboard also shows a previous-cycle organization quota warning: projects may be restricted from **2 November 2026** if the organization remains over quota. The Usage page attributes the warning to the previous cycle’s database size; its current summary shows 0.045 / 0.5 GB (9%), with Locke at 34.41 MB and Relay ai at 43.14 MB. The live SQL measurement is about 20 MB; these provider snapshots differ and may lag. Current displayed usage is below quota, but automatic clearance of the historical banner has not been verified. No paid upgrade was purchased.

Use `LAWYER-PILOT-GUIDE.md` for supervised fictional/de-identified evaluation after email onboarding is verified. Each lawyer needs an individual verified account; firm invitation delivery is manual in the current implementation.

## Remaining feature limits

- English image-only PDFs now support local OCR with a 20-scanned-page limit, bounded rendering and source-verification flags. Live OCR upload → processing → private search passed. XLSX private ingestion and verified layout analysis remain absent.
- Public retrieval now uses conceptual query expansion and embedding reranking of up to 32 retrieved candidates, with a visible lexical fallback. Live embedding reranking passed. This is not a complete semantic vector index. Passage-label and verbatim quotation checks flag unsupported output; verified authority treatment/citator, complete judgments and amendment/currentness reconciliation remain unestablished.
- A Cloudflare cron checks 22 priority Tanzanian source PDFs in rotation, one every ten minutes. Unchanged-file checking passed live. Changed-file parsing, version publication and concurrent-index protection passed regression tests; no actual changed official file was encountered in acceptance. New-law discovery, full-corpus refresh and comprehensive legal-change alerts remain outstanding.
- Workflow execution now continues through Vercel Workflow after the start request returns, preserves human checkpoints and saved results, guards replayed steps and respects cancellation/revoked membership. Live background/approval/cancellation/access checks passed. Expired caller sessions require sign-in and resume; native Microsoft Word/Outlook host acceptance remains outstanding.
- Supabase advisors flag intentional authenticated privileged RPCs; their caller/email/role checks were exercised by regression tests. Leaked-password protection remains subject to the project's available Auth controls. See https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

**Release decision:** replacement backend operational; supervised lawyer handover pending the email and browser acceptance gates above. Do not label the product fully finished or unrestricted production-ready.

## Feature release update

Commits `bb4e820`, `67a32dc` and `4a4a8c5` added the features above. Vercel production deployment `dpl_8UwTQfdvLex7vAjK492y98JodFZh` is READY. The source Worker and ten-minute cron are active. All **41 Node regression tests** passed, app TypeScript passed, and the source monitor browser showed the priority coverage and recorded checks. Synthetic live API checks verified OCR metadata and private search, embedding reranking, durable approvals, replay guard, cancellation and revoked-membership rejection. These tests do not replace email onboarding, authenticated browser acceptance or lawyer accuracy/currentness assessment.

Email setup remains an external configuration gate: the replacement project's SMTP credentials and verified sender have not been supplied or saved. No user verification settings were weakened. Do not describe this update as Harvey/Legora parity or all-law coverage.

Private embedding inputs now pass credential detection and government/financial identifier redaction before any embedding request. The disposable scan files, fixture workspace and Auth account used for live checks were deleted after scoped cleanup; no existing account or firm data was removed.

## Citator and Office release

The firm judgment-treatment workflow is implemented with exact source-passage verification, source-document permissions, pending/verified/withdrawn states, owner/admin/partner review, immutable verified content and mutation audits. Research looks up matching neutral/source citations against accessible firm-reviewed evidence. Absence is unknown; this is not global good-law certification. The transactional live SQL assertions pass and roll back all fixtures.

Word and Outlook manifests version 1.0.1.0 were accepted by Microsoft's manifest validation service with zero errors and warnings. Outlook exposes read/compose commands and requests ReadWriteItem rather than ReadWriteMailbox. Word offers WordApi 1.4 tracked replacement with restoration of the prior setting. Current email/selection changes prevent stale insertion; all host calls await completion or report a bounded timeout. The host diagnostic performs a content-free reported read test. Native host acceptance is still pending on an authenticated Microsoft 365 Word and Outlook session. See OFFICE-MANIFEST-VALIDATION-2026-10-06.json and the pilot guide for exact tests.

The complete OAG catalogue was reconciled on 6 October, revealing 60 missing downloadable documents. Additional ingestion and OCR repair completed against official sources, with source hashes and remote R2 verification before indexing. PDFs above 32 MB use a bounded streaming route up to 96 MB. Mixed PDFs now inspect each sparse page for OCR instead of accepting a text cover page as complete document extraction. Coverage is a declared catalogue reconciliation, not assurance that all Tanzanian law, judgments, amendment effect or OCR quality is complete. The final coverage assessment is published separately from the main index manifest.

The implementation passed 46 Node regression tests, three Python corpus tests and the Next.js webpack production build. Custom SMTP, real Microsoft host acceptance and lawyer authority/currentness assessment remain handoff prerequisites. Microsoft Graph access to a whole mailbox, SharePoint or OneDrive requires an Entra registration and consent; the existing add-ins do not require an Office API key. No Google Workspace connection is required. Broader court/content coverage may require a provider token and agreed content rights; no unavailable licensed content is represented as ingested.

## Final catalogue reconciliation and release checks

The 6 October OAG recheck found 5,621 published catalogue records with downloadable-file metadata; all 5,621 are now ingested with verified R2 receipts. All seven nonempty collections reconcile. Parliamentary resolution 19 has a broken OAG PDF link (404), including the original double-slash path. The exact Resolution 09/2019, adopted 11 September 2019, was recovered from Parliament of Tanzania's official PDF. Its title and adoption date match the catalogue entry; actual Parliament provenance is retained alongside the OAG catalogue URL. The collection table is exposed in Trust through the live corpus overview. See TANZANIA-CATALOGUE-RECONCILIATION-2026-10-06.json. This certifies ingestion against the declared catalogue; it does not certify all Tanzanian law, judgments, amendment effect, OCR accuracy or good-law status.

The Tax Administration Act (acts:149) was re-extracted across all 128 pages, including 127 OCR pages, replacing the prior cover-page-only extracted pointer while preserving the source version. OCR remains subject to human verification. The final corpus index and checkpoint publication are recorded separately after completion. The updated coverage UI passed application TypeScript and Next.js webpack production build checks. All 47 Node regression tests pass, including actual-source provenance for the recovered resolution.

Microsoft account identifier submission advanced to passkey authentication, which has not completed. No native Word/Outlook acceptance is claimed. SMTP and real email onboarding remain unverified. The product is available for supervised technical evaluation; unrestricted lawyer handoff remains pending these gates and legal-source/currentness assessment.

The recovered resolution also passed live Worker retrieval: matching evidence returns the official Parliament PDF URL and Parliament attribution. The production corpus overview reports the reconciled catalogue as complete (within the explicit catalogue scope). The verified local receipt ledger now contains 47,406 public documents and 470,680 extracted passages across the five declared jurisdictions; statistical publication follows completion of the sealed base index and latest delta.
