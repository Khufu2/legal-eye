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

- Scanned/image-only PDFs require an OCR copy; automatic OCR and XLSX private ingestion are not implemented by the new extractor. PDF/DOCX structure is text extraction, not verified layout analysis.
- Public retrieval is lexical. Semantic retrieval, verified authority treatment/citator, complete judgments and amendment/currentness reconciliation are not established. The retrieval benchmark tests authority discovery, not answer accuracy.
- The expired Railway source-ingestion service is not running. No unattended corpus refresh is claimed. Catalogue monitors are narrower than comprehensive legal-change alerts.
- Agent and workflow API steps work, but durable unattended orchestration and native Microsoft Word/Outlook host acceptance remain outstanding.
- Supabase advisors flag intentional authenticated privileged RPCs; their caller/email/role checks were exercised by regression tests. Leaked-password protection remains subject to the project's available Auth controls. See https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

**Release decision:** replacement backend operational; supervised lawyer handover pending the email and browser acceptance gates above. Do not label the product fully finished or unrestricted production-ready.
