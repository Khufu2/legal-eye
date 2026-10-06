# Account validation release — 6 October 2026

The owner confirmed SMTP delivery. A read-only live query confirms one email-confirmed Auth user and one active firm membership in the replacement Locke project. Email confirmation remains enabled.

Account signup now identifies invalid/missing email, missing practice name and passwords shorter than 12 characters beside the affected fields. Sign-in does not apply the new-password minimum to existing credentials. The app, recovery page, portal and Office sign-in share documented provider error handling, including unconfirmed email, invalid credentials, compromised-password reasons, rate limits and expiry. Backend SQL and unknown provider payloads are not exposed. Account network requests have a 20-second timeout. The main account dialog includes confirmation-email resend with the canonical redirect; responses preserve account-existence privacy.

Verification: three auth regression tests passed in addition to the existing 51 Node tests; app TypeScript and Next.js webpack production build passed. The final redirect-only change passed TypeScript. Production verification follows deployment.

Outstanding acceptance: native Word/Outlook operations in an authenticated Microsoft host; real lawyer review of source coverage, OCR and judgment treatment. The declared OAG catalogue is complete within its 5,621-record scope, not all-law coverage. The firm citator review feature is implemented, but no global good-law assurance is claimed. SMTP is no longer a pending configuration gate; account recovery and native Office acceptance should be exercised with the owner through secure authentication.
