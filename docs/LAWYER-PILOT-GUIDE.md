# LOCKE supervised lawyer evaluation

Application: https://lockeslaw.sheenax.xyz/

**Email onboarding and lawyer acceptance remain pending.** The 6 October replacement workspace passed authenticated API checks for private extraction and the main work flows. Browser onboarding, email verification/recovery and lawyer assessment still need completion. See `LAWYER-PILOT-STATUS-2026-10-06.md`; this checklist is not a release certificate.

## Account and workspace

Use an individual account; never share the owner's password. The owner can create a separate test firm, or an owner/admin can create an expiring email-bound invitation in Trust → Firm team. Invitation delivery is manual in this implementation. The lawyer must sign in with the matching verified email. Confirm email delivery and recovery before relying on onboarding.

Use fictional or de-identified files for this supervised evaluation. Keep actual client documents out until the wider operational/privacy gates are satisfied.

## Walkthrough and acceptance script

| Step | Action | Pass condition |
| --- | --- | --- |
| 1 | Sign in and open the intended workspace | Correct firm identity; no another-firm work visible |
| 2 | Ask: “An employee is dismissed for misconduct without a hearing. What Tanzanian statutory provisions should I examine?” | Source-backed answer; open each citation, inspect exact wording and currentness; explicit gaps if cases are unavailable |
| 3 | Follow up: “What remedies should the lawyer investigate?” | Uses conversation context; cites supporting passages; no unsupported certainty |
| 4 | Navigate away, sign out/in, reopen research | Question, answer and evidence reopen in the same workspace |
| 5 | Create a synthetic TXT/PDF/DOCX agreement and upload it in Vault | Text-based files reach Ready; scanned PDFs explicitly request an OCR copy |
| 6 | Ask which notice period the uploaded agreement specifies | Exact agreement wording and correct source reference; never uses an unrelated firm file |
| 7 | Review: find confidentiality/termination issues | Quotes exist in the source; distinguishes commercial proposals from supported legal conclusions |
| 8 | Tables: extract parties, dates, notice and governing law | Correct quotes; absent clauses return Not found; save/reopen/export works |
| 9 | Editor: draft a short advice memo with placeholders | AI draft label, editable text, saved version, reopen and valid Word export |
| 10 | Agent: prepare a memo using only the selected Ready agreement and TZ sources | Timeline reflects actual tools; result saved for review; failure is visible and recoverable |
| 11 | Skills: save and rerun a firm review instruction | Correct instruction/version used and resulting work can be inspected |
| 12 | Workflows: review → human checkpoint → draft | Pauses for lawyer approval; reload preserves progress; retry/cancel behaves correctly |
| 13 | Matters/Lists: group work and record an obligation | Saved state and correct workspace visibility |
| 14 | Monitor: create a narrow source-topic monitor | Catalogue-based scope explained; events/triage persist; no claim of comprehensive regulatory alerts |
| 15 | Portal: publish one fictional draft; access as invited guest; archive portal | Guest sees only published resources; archive removes guest access; owner checks separately |
| 16 | Sign in as a second test firm and try foreign resource identifiers | No readable private documents, drafts, results or downloads; no foreign mutations allowed |

Word/Outlook add-ins require a separate Microsoft Office host evaluation. Opening the web task pane does not establish host integration. Validate selection insertion, failed insertions, token expiry and sign-out in actual Word/Outlook.

## Suggested legal quality questions

- Employment: procedural fairness, remedies and missing factual assumptions.
- Companies: directors' duties and the difference between Tanzanian and UK authority.
- Contract: breach and available remedies grounded in the relevant Act and facts.
- Land: rights of occupancy and statutory context.
- Privacy: identifying the applicable Tanzanian data-protection provisions and uncertain facts.

For each question the lawyer records the expected authorities before comparing LOCKE. Check every citation, quoted passage, jurisdiction and legal date. A successful retrieval test is not a successful legal-answer test. Where the corpus lacks judgments or current amendments, an honest limitation is the correct behavior.

## Feedback template

- Feature and exact task:
- Expected result:
- Actual result:
- Source/citation errors:
- Unsupported facts or missed legal issues:
- Reproduction steps and time:
- Correctness / usefulness / ease of use (1–5 each):
- Severity: blocks task / misleading result / inconvenience / suggestion.
- Would you use this for supervised research or drafting? Why?

Share only fictional/de-identified examples through the agreed feedback channel. The owner should reproduce problems, add regression coverage and rerun the affected journey before closing them.

## Exit decision

The owner first verifies the complete synthetic workflow. The lawyer then assesses source quality and practical usefulness. Use the verdict “supervised pilot ready with stated limitations” only after those checks pass. Current handover remains blocked by email setup and uncompleted browser/lawyer acceptance. No full Legora/Harvey equivalence or unrestricted production-use claim is made.
