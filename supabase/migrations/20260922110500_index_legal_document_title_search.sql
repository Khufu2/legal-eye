-- Speed exact/broad primary-law title retrieval in search_legal_evidence.
create index if not exists legal_documents_title_search_idx
on public.legal_documents
using gin (to_tsvector('simple', coalesce(title,'')));
