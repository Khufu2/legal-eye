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

## Sources already running without new credentials

- Tanzania Office of the Attorney General
- Australian Federal Register
- Canada Justice Laws XML
- UK Legislation
- EUR-Lex / Publications Office

Source policy gates remain authoritative. Do not enable a source marked `review_required` or `license_required` merely because its website is publicly reachable.
