# LOCKE — Internal Law Firm CRM (pilot)
Date: 2026-11-09

## Purpose
Maintain a provenance-backed pipeline for legal-firm outreach without allowing prospects, customer firms or anonymous users to view Locke sales records. This is an *internal* admin surface and must never be exposed through the lawyer workspace navigation.

## Source of truth
- Supabase: public.crm_staff, crm_leads, crm_events. Explicit staff allowlist populated by admin only.
- Import: `locke_law_firm_prospects_2026-11-09.csv` from the research handoff, after reviewing individual sources. Import records default to `email_permission=not_established` and `stage=researched`.
- Gmail: `hello@lockelaw.xyz` is the user's requested sender, **not yet verified against the authenticated Gmail alias**. Do not send without explicit user approval, sender identity verification, applicable legal basis, recipient-specific approval and suppression checks.
- Slack: optional notifications (new reply, meeting, pilot) via internal server event integration. Never put credentials or confidential client documents into Slack. Slack list creation may not be supported by the currently connected provider.
- Never add the CRM to public legal-data search, legal workflow retrieval or the client portal.

## User journey
1. Internal owner authenticates (confirmed email) and is individually enrolled as CRM staff using their exact auth user UUID.
2. CRM shows stages: Researched, Qualified, Permission pending, Ready for approval, Invited, Engaged, Pilot booked, Pilot active, Converted, Closed.
3. Every contact retains website, source URL, source checked date, point of contact and segment.
4. Owner records lawful marketing eligibility/permission evidence and approves exact recipient and message before any send.
5. Outreach must run with dry-run first, no tracking pixels, no hidden recipient expansion, clear identity and unsubscribe. Suppress opt-outs everywhere.
6. Log Gmail message ID, response, meeting and next action. A scheduled monitor may alert on follow-ups, but may **not** send on its own.
7. New replies can be reconciled by message/thread IDs and Slack-notified after authorization, with no duplication.

## Go/no-go product claims
The live legal product remains under supervised lawyer evaluation; only offer synthetic/de-identified document pilots. Do not claim that full Harvey or Legora parity, independent certification, accuracy guarantees, SOC2, or firm-production readiness have been demonstrated.

## Security acceptance tests
- Anonymous and unauthorised user see zero leads and events and cannot mutate anything.
- Staff user sees leads; inactive, suspended or removed staff sees nothing.
- Reader cannot insert or update; operator can create researched records; no deletes are permitted.
- User cannot mark a lead invited without approval timestamp, approver UUID and legal eligibility evidence.
- Client organizations and internal CRM never share visibility through their organization membership.
- Unauthorized staff enrollment fails because no client grant or insert policy exists.
- Service credentials remain server-side; do not create NEXT_PUBLIC secrets.
- Do not merge or seed production until RLS/isolation checks pass.

## Rollout checklist
- [ ] Review CRM migration and apply to connected Locke Supabase after DB backup.
- [ ] Explicitly enroll a confirmed internal account as CRM staff (never a prospect/customer).
- [ ] Import 25 researched contacts with source provenance, treating every contact as NOT permission established.
- [ ] Add a private admin-only CRM dashboard with server-side approval enforcement.
- [ ] Recheck official URLs, contact recency, deliverability, compliance and opt-outs.
- [ ] Verify the requested Gmail send-as alias; prepare reviewable drafts.
- [ ] Enable Slack notification once the connected provider can accept changes.
- [ ] Complete synthetic lawyer pilot/landing-page CTA acceptance.
- [ ] Obtain user approval for the exact contacts and copy before sending any messages.
