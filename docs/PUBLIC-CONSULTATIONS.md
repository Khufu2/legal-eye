# Public consultations

The public page is at https://app.lockeslaw.xyz/consult. It uses the published Tanzania corpus only. It does not generate advice, translate legal passages, or send a public query to firm data or a model. Matched Kiswahili and English terms expand common searches. The source titles and excerpts retain their original language.

Firm owners and admins use Consultations to submit, update and withdraw advocate listings and respond to requests. Users send a name, email, practice area and language only. The requester explicitly authorizes that information to go to the selected firm. No document uploads or legal narratives are collected. Contact requests are removed by a daily database job after 90 days. Firms handle scheduling, conflicts checks and engagement separately.

## Verify a real listing

1. Review pending listings using the Locke Supabase SQL Editor. Only platform operators with approved database access should publish a listing.
2. Confirm the advocate's full name, roll number and current eligibility in the official Judiciary e-Wakili register at https://ewakili.judiciary.go.tz/. Check that the advocate and firm have agreed to publish the stated listing.
3. After confirming, update the selected row by its ID and checked roll number, setting `state='verified', checked_at=now()` with the existing state restricted to `pending`. Use a parameterized operation or review the exact row first in the dashboard. Verify the row appears in the public directory. Do not publish a placeholder or a person whose eligibility cannot be checked.
4. Recheck verified listings before the 90-day display window ends. Withdraw a listing promptly if the advocate ceases participating or verification changes. If an advocate changes firms, an operator must re-verify the new affiliation and handle prior inquiries before any reassignment.

The first listing requires a real opt-in and manual verification. The directory starts empty. It displays the latest verification date and a link to the Judiciary register.
