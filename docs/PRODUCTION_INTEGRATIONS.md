# LOCKE production integrations

## Microsoft Word and Outlook

LOCKE currently uses Office.js task-pane APIs directly. The manifests are:

- `public/office/word-manifest.xml`
- `public/office/outlook-manifest.xml`

Both task panes authenticate to LOCKE through the existing Supabase organization session and call LOCKE's own server routes. This implementation does **not** require a Microsoft Graph client secret merely to sideload and use the add-ins.

For organization-wide Microsoft 365 deployment, upload the manifests through the Microsoft 365 admin center / integrated apps flow after validating them against the production origin.

### Optional Microsoft SSO / Graph phase

Use Microsoft Entra + MSAL Nested App Authentication only if LOCKE needs Microsoft identity or Graph data such as OneDrive files, mailbox search, calendar or contacts.

Suggested server/environment names for that future phase:

- `NEXT_PUBLIC_MICROSOFT_CLIENT_ID` — Vercel, safe public client/application ID.
- `MICROSOFT_TENANT_ID` — Vercel server environment when restricting to a tenant.
- `MICROSOFT_CLIENT_SECRET` — Vercel server environment only if a confidential server-side Graph/OBO flow is added. Never expose it with `NEXT_PUBLIC_`.

Do not place a Microsoft client secret in Supabase unless a Supabase Edge Function itself is the component calling Microsoft Graph.

## Legal corpus credentials

### New Zealand Legislation

The official PCO API requires an API key. LOCKE's worker is prepared for:

- `NZ_LEGISLATION_API_KEY` — Railway `open-corpus-worker` service variable.

After the key is installed, the `nz_legislation` source can be approved/enabled and the worker will ingest PCO-published XML versions.

### United States

Congress.gov and GovInfo both require api.data.gov keys. Their registry entries intentionally do not currently permit permanent local storage, so they should not be switched into the persistent corpus worker without a rights-policy change. Prefer a governed on-demand retrieval connector first.

CourtListener is also intentionally gated: the current registry does not permit bulk ingestion, permanent storage, computational analysis or commercial display.

## Configured sources and current ingestion status

- Tanzania Office of the Attorney General
- Australian Federal Register
- Canada Justice Laws XML — checkpoint retained; access review required after HTTP 403
- UK Legislation — checkpoint retained; recent empty HTTP 202 responses deferred
- EUR-Lex / Publications Office

Source policy gates remain authoritative. Do not enable a source marked `review_required` or `license_required` merely because its website is publicly reachable.


## Account emails and firm onboarding

Supabase Auth owns password signup, confirmation and recovery emails. On 24 September public settings showed signup and email enabled, anonymous users disabled, and email auto-confirm disabled.

Before onboarding clients, verify in the Supabase dashboard:

- Site URL: `https://legal-eye-six.vercel.app` (or the configured production custom domain).
- Allowed redirects include the same origin and `https://legal-eye-six.vercel.app/reset-password`.
- Custom SMTP with a verified sender domain, sufficient sending limits and delivery monitoring. Do not put SMTP credentials in public frontend variables.
- The confirmation email confirms the account, and the recovery email returns to `/reset-password`. The home route also forwards recovery callbacks to that page.

The Trust page's Firm team panel creates email-bound, expiring invite links. Owners share these directly; no invitation email is sent by this implementation. Invited users register/sign in with the matching email. New independent firms get their own owner workspace after confirmation.
