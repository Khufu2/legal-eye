# Domain recovery and SMTP acceptance — 6 October 2026

At 19:55:42 UTC the Cloudflare CNAME for lockeslaw.sheenax.xyz was restored to legal-eye-six.vercel.app (DNS only, TTL 300). The previous record pointed to lockeslaw-sheenax-xyz.brand.brevosend.com with TTL 3600, routing the app domain to Brevo branding instead of the verified Vercel project.

Verification after restoration: HTTPS home returned 200; /api/corpus-overview returned 200 with 47,406 legal records and 470,680 passages; the cloud browser rendered the Locke home over HTTPS. Some recursive resolvers still cached the prior record, so propagation is not asserted complete. Brevo img and r subdomain records were preserved. Configure future branded email links on a dedicated email subdomain in Brevo; do not replace the app CNAME.

SMTP was reported configured by the owner. Auth logs show configuration reloads, but delivery has not been verified. The new Locke project had zero real auth users at this check. First real signup and receipt of its confirmation email are the next acceptance gate. Never disable confirmation to bypass delivery testing.

Microsoft sign-in was stopped by the owner after a prolonged loading/passkey flow. No successful native Word or Outlook host acceptance is claimed. Existing manifest validation and task-pane checks remain valid; native host testing still requires Microsoft authentication and actual insertion/compose operations.
