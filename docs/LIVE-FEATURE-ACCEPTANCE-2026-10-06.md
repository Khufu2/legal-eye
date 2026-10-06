# LOCKE live feature acceptance — 6 October 2026

The production domain responds and the owner can use the core legal work flows. This is a bounded technical acceptance record, not certification of every feature, legal accuracy, all-law coverage, or Harvey/Legora equivalence.

## Checks and results

| Area | Evidence | Result / limit |
|---|---|---|
| Auth and SMTP | Owner-confirmed delivery; confirmed Auth user and active firm membership; production signup validation | Specific email, password and firm errors shipped. Invalid credentials remain deliberately ambiguous between email and password. Recovery has not been completed with an owner password change. |
| Research | Source-backed answer, source inspection, saved session and reopened history | Repaired missing mode/status/completed_at fields. Saved session `bdf9d1d4-291f-4a33-95ba-4f0cd0fa31c5`. |
| Vault | Fictional TXT agreement uploaded and processed to Ready | Private source `19de46ab-457c-4bea-89ad-c253ba3ff337`; no real client data used. PDF/OCR and DOCX have parser regression coverage, not every document layout. |
| Review | Generated three source-bound findings; saved review reopen available | Output remains a draft requiring a lawyer's assessment. |
| Tables | Persisted exact-source extraction; absent clause shown as Not found; technical signoff saved as Reviewed | Repaired reviewed_by/reviewed_at. The fictional signoff is not a legal approval. |
| Lists | Five source-linked items persisted; one assignment saved | Repaired source_document_id. Rolled-back RLS fixture test accepts same-firm sources and rejects foreign-firm sources. |
| Editor | Fictional memo saved as v1; proposal accepted and v2 saved; comment persists in database | Source facts preserved in this test. Word archive structure passes regression tests. Browser download completion remains unverified. |
| Agent | Fictional-source run persists with output and Needs review | Review-ready status made explicit; no automatic legal approval. |
| Skills | Reusable fictional-source instructions saved and run | Returned the source payment, deadline and notice terms. |
| Workflows | AI graph saved; two human checkpoints; completion 6/6 steps | First run cancelled after an invented memo date. Drafting rules repaired; second run has accurate fixture facts and no invented date. Approvals explicitly identify technical fixture acceptance only. |
| Portal | Empty test portal created; fictional source published; no guests invited | Owner publication passes. Prior API/RLS guest-revocation checks pass; live guest-browser acceptance still needed. |
| Monitors | Topic monitor created and scanned; last_scanned_at recorded | Zero matching new changes. Priority refresh is a bounded 22-source rotation, not comprehensive new-law discovery. |
| Matters | Fictional matter created and retained | Matter cards now open the Research context. Complete matter association across all work products is not certified. |
| Trust | Coverage panel and firm audit rows load in production | Fixed audit_events→audit_logs and missing last_synced_at query. Source adapter register is distinct from published Cloudflare collections. |
| Citator | Source quotation, reviewer permission and immutable-review regression/RLS checks | **0 genuine verified treatment entries.** No result means unknown; this is not a comprehensive good-law citator. |
| Word / Outlook | Official manifest validation previously accepted; host-operation regression checks | Native signed-in Word insertion/track changes and Outlook read/compose acceptance remain pending. |
| Exports | DOCX ZIP/OOXML regression passes; attached download anchors shipped | Download capture timed out in the cloud browser. Its downloads page is unavailable under browser policy; user-side download acceptance remains pending. |

## Published corpus

Cloudflare contains 47,406 records and 470,680 source passages: Tanzania 5,621, Australia 33,247, Canada 5,861, EU 1,337 and UK 1,340. The declared Tanzania OAG downloadable catalogue reconciles 5,621/5,621. These counts do not establish comprehensive judgments, amendment effect, legal currentness, or permission for every future source adapter.

The sealed index is `rebuild-20261006T184626`; its verified checkpoint is `backup-20261006T190526`. Publication and provenance receipts are in the corpus reports in this directory.

## UI improvements

Step-by-step guides collapse by default; field validation uses compact text; Agent distinguishes draft readiness from legal approval; tool search names its actual navigation function. Trust puts audit/source status before optional team/citator forms, bounds long tables and offers source filtering. Monitors display scan time and distinguish a completed empty scan from an unconfigured monitor. Matter cards have a real action.

These are functional usability fixes. A complete visual redesign and mobile-device acceptance remain separate work.

## Release gates

1. Complete Microsoft sign-in and native Word/Outlook host acceptance; inspect any add-in permission grant before authorizing it.
2. Accept real downloaded DOCX/CSV/audit exports on a lawyer's browser; complete password recovery and invited-guest browser tests.
3. Have a qualified reviewer validate genuine judgment-treatment evidence and the pilot's legal outputs. Expand court/current-law coverage against an explicit source list; do not label ingestion counts as all-law coverage.
4. Finish consistent matter association and complete mobile/visual acceptance before claiming every feature is fully functional.

Validation for the shipped functional fixes: 55 Node regression tests pass; TypeScript and production Next.js webpack builds pass. Security advisor notices remain for intentional authorized SECURITY DEFINER onboarding/invite RPCs and unavailable leaked-password protection in the current configuration; neither is represented as a completed enterprise-security certification.
