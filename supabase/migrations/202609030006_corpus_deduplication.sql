create unique index if not exists legal_documents_source_external_unique
  on public.legal_documents(source_id,canonical_source_id)
  where canonical_source_id is not null;

create index if not exists legal_documents_jurisdiction_published_idx
  on public.legal_documents(jurisdiction_code,published_at desc);

create index if not exists source_ingest_objects_external_idx
  on public.source_ingest_objects(source_id,external_id);
