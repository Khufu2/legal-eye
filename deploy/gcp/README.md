# Google Cloud production deployment

This directory makes the private Legal Eye services reproducible on Google Cloud. It does not
pretend that a production deployment exists until a Cloud project, billing account, DNS zone,
and deployer identity have been supplied and the release evidence is green.

## Runtime topology

| Workload | Google Cloud runtime | Exposure | State |
| --- | --- | --- | --- |
| Legal Eye web app | Existing Sites deployment | Public, authenticated application | Supabase |
| AI gateway, SCIM, ingestion control | Supabase Edge Functions | Authenticated; SCIM uses its own bearer token | Supabase |
| Docling parser | Cloud Run service | Internal ingress only; IAM plus service secret | Ephemeral local disk; artifacts in approved object storage |
| LangGraph orchestrator | Cloud Run service | Internal ingress only; IAM plus service secret | Supabase run/event tables |
| OpenContracts API/GraphQL | Cloud Run service | Internal ingress only; adapter-facing | Dedicated Cloud SQL database |
| OpenContracts workers | Cloud Run worker pool | No public URL | Cloud SQL plus Memorystore Redis |

OpenContracts is built at the exact audited commit. Its UI is not routed to users. Before the
first build, verify that the upstream Dockerfile path in `cloudbuild.yaml` still exists at that
commit; the pipeline fails closed if the pin cannot be checked out.

## Required platform services

- Artifact Registry with immutable tags, vulnerability scanning and retention policy.
- Cloud Build with a dedicated least-privilege service account and private worker pool for
  regulated production environments.
- Cloud Run with internal ingress, no unauthenticated invocation, minimum instances for the
  parser/orchestrator where latency demands it, and per-service identities.
- Cloud SQL for PostgreSQL with private IP, HA, point-in-time recovery, deletion protection,
  separate OpenContracts database/user, and pgvector only where OpenContracts requires it.
- Memorystore Redis for OpenContracts background work. Do not expose Redis publicly.
- Secret Manager references mounted directly into each service. Never place secret values in
  Cloud Build substitutions, image layers, repository files, or Terraform state outputs.
- Customer-managed encryption keys in Cloud KMS for Cloud Run, Artifact Registry, Cloud SQL,
  storage, logs and backups where the selected service supports CMEK.
- VPC Service Controls, Cloud Armor at the public edge, Security Command Center, centralized
  audit logs, alerting, and a separate break-glass project role.

## Release order

1. Create separate development, staging and production projects and KMS key rings.
2. Build images with `gcloud builds submit --config deploy/gcp/cloudbuild.yaml .`.
3. Generate SBOMs, scan the three images, sign accepted digests, and promote digests—not tags.
4. Deploy Cloud SQL/Redis/private networking and run OpenContracts migrations as a one-off job.
5. Deploy the OpenContracts API and worker pool, then run its health and adapter contract tests.
6. Deploy Docling with network egress disabled after its model assets are available.
7. Deploy LangGraph and grant only `run.invoker` to the application service identity.
8. Add resulting internal service URLs as Supabase secrets and execute the staging evaluation
   suite, restore drill, tenant-isolation tests and a human-approved go/no-go review.

The application is not bank-grade merely because these resources exist. Production acceptance
also requires the controls and evidence listed in `docs/PRODUCTION-READINESS.md`.

