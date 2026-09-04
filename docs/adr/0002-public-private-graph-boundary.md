# ADR 0002: Public and private legal graph boundary

- Status: accepted
- Date: 2026-09-03

## Decision

Legal Eye maintains two logically and access-control-separated graphs.

- The **public legal graph** contains licensed public authorities, normalized citations, public authority treatment, legislation versions, court hierarchy and source provenance.
- Each organization’s **private graph** contains its matters, documents, annotations, precedents, playbooks, reviewer decisions and workflow outcomes. Access is constrained by organization membership, matter membership, document permissions and ethical walls.

Private lawyer actions may generate organization-local ranking signals. They are never copied into another organization. Only deliberately submitted, de-identified, rights-cleared corrections may enter a moderated public improvement queue.

## Enforcement

- Row-level security is mandatory on every tenant table.
- Retrieval requires the caller’s organization and, when applicable, matter context.
- Search functions are invoker-scoped and may not bypass RLS with arbitrary organization identifiers.
- Agent tool calls, document reads, citation approvals and exports are audit events.
- Model providers receive only the minimum authorized context and may not train on customer content under Legal Eye contracts.
- Backups, analytics, caches and vector indexes preserve the same separation.

