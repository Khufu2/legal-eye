# LOCKE pilot onboarding audit — 16 October 2026

## Scope

This release addresses browser-storage failures, bounded account requests, recovery UX, offline navigation and anonymous onboarding telemetry. It does not change credentials, send recovery emails or grant account access. Delivered-email HTML and actual Safari email-click acceptance remain separate checks.

## Changes

- Browser storage exceptions no longer block homepage boot, sign-in state, invitation handling, confirmation callbacks or reset completion. Storage-denied browsers retain the current in-memory session only.
- Account requests use a bounded AbortController rather than depending on newer AbortSignal.timeout browser support. Membership checks are bounded too.
- Invalid query-string callback errors and unsupported callback types show errors instead of masquerading as confirmation.
- Password visibility controls, preserved recovery-email entry, resend guidance and a 60-second retry wait improve recovery. A failed logout request cannot leave a successfully updated password on an indefinite spinner.
- Service workers cache only a small public static allowlist. Navigation failures show a reconnect page; account and application responses are not cached as an offline workspace.
- A generic retry boundary handles workspace rendering failures without leaking exception details.

## Analytics

Dedicated PostHog project: LOCKE (668232), connected organization cathedral. Production configuration uses server-only POSTHOG_PROJECT_TOKEN and the approved US ingestion host. Only explicitly instrumented event names and allowlisted properties are forwarded. No email, password, token, reset URL, query, document text, matter name, raw exception or client IP is forwarded. Session replay, DOM autocapture and console capture are absent. IDs are random per tab/session; DNT is respected. Analytics failures do not block legal work.

Observe: page visits, tool navigation, authentication attempts, authentication failures, completed workspace sign-in, recovery requests, reset-link opening, password reset completion and generic runtime failures. Events before installation cannot be reconstructed.

## Verification and limits

60 functional Node checks pass, including new denied-storage and analytics privacy tests. Production Next.js build and TypeScript checks are required before release. The alternative Vinext build used by two starter catalog tests cannot bundle native canvas binaries in this environment; this is separate from the Vercel Next.js deployment.

The actual delivered confirmation/reset email HTML is not available through the connected Supabase tools, and the dashboard browser is signed out. The exact href, provider click tracking, delivery timing and actual Safari email-click flow remain unverified. Do not label the root cause as Safari popup blocking or claim an affected account's access is resolved without a successful sign-in. Lawyer retesting must use the newest original email, complete password reset, then successfully sign in and open the firm workspace.

Native Office acceptance, guest portal/recovery end-to-end acceptance and legal accuracy/authority-treatment review remain separate pilot gates.
