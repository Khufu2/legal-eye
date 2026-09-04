# OpenContracts service boundary

Legal Eye uses OpenContracts as a dedicated, private document/corpus/annotation/relationship
service. The adopted ref is `2cd5230d90cd666e9536103801fdcb118149fba7` under the MIT licence,
as recorded in `UPSTREAM.md`.

Rules for this boundary:

- no stock OpenContracts routes, React UI, branding or authentication screens are exposed;
- Legal Eye tenant and matter authorization is checked before every adapter request;
- source spans, annotations, relationships and graph identifiers map to stable Legal Eye IDs;
- canonical public-law and private-firm graphs remain physically and logically separable;
- raw upstream model/provider calls are disabled in favor of the Legal Eye AI gateway;
- upgrades require licence review, API/schema contract tests and golden-document tests;
- the upstream commit is built unchanged first; patches require an owned patch queue and an
  updated `UPSTREAM.md` record.

The Google Cloud build is defined in `deploy/gcp/cloudbuild.yaml`. OpenContracts receives its
own Cloud SQL database and Redis namespace. Only its API/GraphQL/MCP interfaces are reachable
from the Legal Eye service network.

