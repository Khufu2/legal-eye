# Locke firm release

## Release scope

The legal workflow library uses the existing workspace workflow runner and its lawyer approval checkpoint. Templates save into the firm's workspace and can be reviewed and customized. They are initial Locke templates. Record a named lawyer's acceptance and approved test cases for each template before describing it as lawyer-validated.

The Word and Outlook manifests use the production domain. Word can review its document body against a firm Skill, show source quotations, and apply a single approved tracked replacement to an unchanged document. WordApi 1.4 is required for tracked changes. A separate Word file can be downloaded from a workflow run or review. Google Drive Picker can import a Google Doc as DOCX. When the firm permits exports, enable NEXT_PUBLIC_LOCKE_GOOGLE_EXPORT_ENABLED and use the existing Google OAuth configuration to create a separate native Google Doc from the editor or a completed workflow. Users select the authorized destination account. Otherwise, open the exported DOCX in Drive. Use Suggesting mode for changes to an original. Google Docs API suggestion write-back is a Developer Preview and requires separate tenant acceptance.

## Packages

| Plan | Price | Offer |
| --- | --- | --- |
| Starter | TZS 49,000 for 30 days per workspace | Cited research, document review, standard workflows and Word export. The initial trial is 14 days with no payment method. Mobile money renewals require customer approval. |
| Firm | Quote after usage validation | Firm playbooks, shared matters, review tables, onboarding and training. Price by seats and measured workload. |
| Enterprise | Custom contract | Scope SSO, audit export, retention, approved models and regions, document system integration, support and service levels with the customer. Include only controls that have been delivered and verified. |

## Billing activation

1. Apply the billing migration to the Locke database. Confirm the billing tables and RPCs are inaccessible to anonymous and authenticated Data API roles.
2. Set the Locke project service-role JWT in Vercel as LOCKE_BILLING_SUPABASE_SERVICE_ROLE_KEY. Provision a Locke-specific payment key and webhook signing secret as LOCKE_SNIPPE_API_KEY and LOCKE_SNIPPE_WEBHOOK_SECRET.
3. Register the production callback https://www.lockeslaw.xyz/api/billing/webhook for the documented Snippe payment events. Verify the version, signature and metadata. Exercise success, duplicate delivery, concurrent renewals, failure and reconciliation in a test workspace.
4. Enable NEXT_PUBLIC_LOCKE_BILLING_VISIBLE and LOCKE_SNIPPE_ENABLED after configuration and checks. Keep LOCKE_BILLING_ENFORCED off until existing accounts have entitlements and applicable AI routes are covered. Core research, drafting, review and work APIs honor this flag. An active trial or confirmed payment does not itself authorize a workspace to process confidential client matters.
5. Confirm payment receipts, merchant and tax setup, refund handling, support for unresolved payments and cost limits before accepting paying customers.

## Firm production acceptance

| Area | Evidence to collect |
| --- | --- |
| Tenant boundaries | Test two isolated workspaces across matters, vault, signed downloads, workflow runs, billing and portals. Exercise invitations, role changes, revocation and recovery. |
| Legal output | Have Tanzanian lawyers prepare a blinded test set spanning statutes, judgments and ambiguous facts. Measure source match, citation accuracy, missing authority, effective dates and refusal when evidence is missing. Expand judiciary sources after access and reuse review. |
| Office | Sideload the manifests in the firm's managed tenant. Test Word on supported web and desktop hosts and confirm the actual change appears in Track Changes. Confirm Outlook draft insertion. |
| Reliability | Exercise retries, concurrent runs, cancellations, expired sessions and missing sources. Run representative multi-document loads, recovery and restoration. Monitor failures and per-task costs. |
| Procurement | Provide verified hosting and model-provider terms, subprocessors, DPA, retention and deletion procedures, access logs and incident response. Verify SSO and procurement controls required by the firm before contracting. |

The shared model gateway remains the routing boundary. Separate model overrides for research, agents and document work let the team run blinded comparisons without changing every feature. Approve provider privacy terms, processing region and retention before routing confidential documents. Use per-task legal accuracy, latency and cost to choose the model.
