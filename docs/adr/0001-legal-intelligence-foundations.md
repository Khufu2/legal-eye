# ADR 0001: Legal intelligence foundations

- Status: accepted
- Date: 2026-09-03

## Context

Legal Eye needs document intelligence, legal research, drafting, review and long-running agents without becoming a fragile collection of overlapping RAG frameworks. It must retain original source structure and provenance, enforce firm/matter isolation, and support jurisdiction-specific authority, citation and temporal rules.

## Decision

Use four explicit planes:

1. **Experience plane — Legal Eye.** Next.js/React and the proprietary Legal Eye design system own every user-facing surface: Research, Editor, Tabular Review, Agent, Skills, Workflows, Lists and Monitors.
2. **Legal intelligence plane — OpenContracts plus Legal Eye.** OpenContracts runs behind an adapter as the document/corpus/annotation/relationship substrate. Legal Eye owns the canonical cross-jurisdiction model, court hierarchy, authority treatment, temporal legislation, citation plug-ins, playbooks, private firm graph and evaluation.
3. **Parsing plane — Docling.** Confidential files are parsed in a private service. The canonical parse is structured Docling JSON with page geometry, hierarchy, reading order, tables, images, confidence and OCR provenance. Search chunks are derived and traceable, never canonical.
4. **Data and execution plane — Supabase/PostgreSQL/pgvector plus LangGraph.** PostgreSQL owns application state, row-level security, hybrid retrieval and audit data. LangGraph owns durable workflow state and human checkpoints only. It does not own documents, retrieval or permissions.

OpenAgreements is a selectively imported starting library governed per asset. Indigo supplies the legislation model and possible isolated service capabilities; its GPL code is not linked into the proprietary application. Eyecite is the US citation implementation behind the common `CitationParser` contract.

## Retrieval contract

Candidate generation combines PostgreSQL full-text search, trigram similarity, metadata filters and pgvector. Ranking then applies jurisdiction, court hierarchy, decision date, law-in-force date, treatment, citing graph, source authority and firm/matter permissions. An embedding match alone can never establish legal authority.

Every answer proposition must resolve to immutable evidence with source identifier, version/effective date, page or structural location, source span, retrieval score, authority treatment, parser/OCR provenance and verification state.

## Consequences

- No LlamaIndex or Haystack dependency in the initial platform.
- LangChain is not a second orchestration layer; only narrowly required integration packages may enter the graph service.
- OpenSearch is introduced only after PostgreSQL benchmarks fail an agreed latency/recall threshold.
- OpenContracts and Docling can be upgraded independently through stable adapters and golden tests.
- The web shell can progress while production ingestion/orchestration services are deployed separately and securely.

