# Legal Eye

**Global legal intelligence, built from Africa.**

This repository contains the Legal Eye product, audited foundation decisions, Supabase control
plane and the private Docling, LangGraph and OpenContracts deployment boundaries.

## Product surfaces

- citation-first, three-pane Legal Research;
- context-aware Editor with playbook conflicts, precedent and redline actions;
- source-linked Tabular Review;
- visible Plan → Execute → Review → Deliver agent runs;
- versioned Skills and human checkpoints;
- natural-language and visual Workflows;
- transaction Lists and regulatory Monitors;
- matter-scoped private knowledge and source licensing controls.

The web experience is a private production preview. Illustrative matter/work-product records are
labelled; public-law catalog counts and the monitor feed are loaded from the live policy-gated
Supabase corpus. Nothing in the interface is legal advice.

## Architecture

- Legal Eye owns the experience, legal graph, jurisdiction normalization, authority treatment, temporal validity, African citation parsers and firm intelligence.
- OpenContracts is integrated behind the server-side transport contract in `lib/legal/opencontracts.ts` as a dedicated legal document/corpus service.
- Docling produces the canonical structured parse; `services/docling` is the private conversion boundary.
- Supabase PostgreSQL, full-text search, trigram and pgvector own application state, permissions and hybrid retrieval.
- LangGraph owns only the durable agent/workflow state machine; no second RAG framework is part of the initial platform.

Read [UPSTREAM.md](./UPSTREAM.md), [ADR 0001](./docs/adr/0001-legal-intelligence-foundations.md),
[ADR 0002](./docs/adr/0002-public-private-graph-boundary.md), [the source licensing
gate](./docs/SOURCE-LICENSING.md), [AI secrets](./docs/AI-SECRETS.md), [corpus ingestion](./docs/CORPUS-INGESTION.md),
[security](./docs/SECURITY.md), [the evidence-backed production gap audit](./docs/PRODUCTION-GAP-AUDIT.md),
and [production readiness](./docs/PRODUCTION-READINESS.md).

## Development

Requirements: Node.js 22.13+ and the dependency lock in this repository.

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` plus
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from Supabase Dashboard → Connect. Do not put a secret or
service-role key in a `NEXT_PUBLIC_` variable.

```bash
npm run install:ci
npm run build
```

Database changes are mirrored under `supabase/migrations`. Edge functions are under `supabase/functions`. The connected Supabase project is the system of record; do not introduce the starter D1 database into the product architecture.
