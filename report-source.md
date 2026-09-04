# Research record: Legal Eye foundation and product benchmark

This internal source record captures the evidence used for the 2026-09-03 architecture and product pass. The authoritative incorporation ledger is `UPSTREAM.md`.

## Findings

- OpenContracts is the broadest fit for corpus, annotation, relationship, citation graph, agent and API foundations. A service boundary protects product identity and upstream upgradeability.
- Docling is the canonical parsing choice because it retains document layout and structure across the target office/document formats and supports private/local execution.
- OpenAgreements separates code licensing from template-content licensing; import must be asset-specific and fail closed.
- Indigo’s work/expression/point-in-time model is highly aligned with African legislation. GPL code is kept out of the proprietary runtime unless deployed behind a separately reviewed boundary. `indigo-akn` has conflicting licence declarations and is blocked.
- PostgreSQL plus pgvector is sufficient for the initial hybrid retrieval architecture. Legal relevance requires graph, temporal and authority signals in addition to lexical/vector similarity.
- LangGraph has one narrow ownership area: durable, inspectable, interruptible workflow execution. Other RAG frameworks are deferred.
- Current public Legora materials emphasize one connected system; primary-source-in-context research; visible plan/execute/review/deliver agent stages; row/document and prompt/column tabular review with review controls; natural-language workflows; and regulatory monitoring that progresses directly into impact assessment and deliverables. Legal Eye reproduces these interaction principles with an original visual system and a differentiated African/global legal graph.

## Sources inspected

- The GitHub repositories and exact revisions listed in `UPSTREAM.md`, including their root licence files, package metadata and content-specific licensing documentation.
- Legora public product pages: main product, aOS, Tabular Review, Workflows, Editor, Legal Research, Agent and Monitors, inspected 2026-09-03.
- Supabase official changelog and documentation for current Data API and row-level-security behavior.

## Limits

- No commercial legal database content or private Legora material was accessed.
- Repository licences do not determine third-party model weights, datasets, bundled assets or live source/API terms. Those remain separate release gates.
- Source Registry entries marked `review_required` are a roadmap inventory, not permission to crawl or ingest.

