# Security baseline

Legal Eye is designed for enterprise legal data, but production certification is evidence—not a
design claim. The following controls are mandatory before a bank or global firm deployment.

## Identity and tenancy

- SAML SSO with verified domains, enforced MFA and provider-specific assurance mapping.
- SCIM 2.0 provisioning through the `legal-scim` Edge Function; bearer tokens are random,
  revocable and stored only as SHA-256 hashes.
- least-privilege roles, matter-level ethical walls, periodic access recertification and break-glass
  access with alerts.
- automated cross-tenant authorization tests for every table, object, RPC and service adapter.

## Information protection

- per-document classification; default firm data is confidential and restricted material is denied
  external models;
- DLP before egress, immutable audit events, no raw prompts in AI telemetry, and private/public
  knowledge graph separation;
- envelope encryption with tenant key references, rotation, disable/revoke workflows and auditable
  KMS use; key material never enters Supabase tables;
- malware scanning, MIME verification, archive/decompression limits and isolated parsing;
- retention, legal hold, deletion verification, backup encryption and tested restoration.

## Secure delivery

- protected branches, peer review, signed commits/releases, dependency review, secret scanning,
  CodeQL, SBOM, container scanning and signed immutable image promotion;
- staging penetration test, threat model, abuse cases, incident exercises and independent annual
  penetration testing;
- centralized logs with redaction, alert ownership, SLOs, runbooks and evidence retention;
- vendor, subprocessor, data-residency, privacy-transfer and model-provider reviews.

The CI workflow performs build/tests, dependency audit, secret-pattern checks and CodeQL. Container
SBOM/signing and cloud posture checks run in the Google Cloud promotion pipeline once the project is
connected.

