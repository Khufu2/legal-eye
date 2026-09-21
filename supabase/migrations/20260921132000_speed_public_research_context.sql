-- Speed up adjacent-page context expansion after a public legal passage is matched.
-- The research RPC filters by document/artifact and then scans a narrow page range.
create index if not exists legal_document_chunks_context_window_idx
on public.legal_document_chunks (legal_document_id, artifact_id, page_number, reading_order, id);
