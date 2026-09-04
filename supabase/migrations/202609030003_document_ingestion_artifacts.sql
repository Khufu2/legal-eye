create table if not exists public.document_ingestion_artifacts (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  ingestion_job_id uuid references public.ingestion_jobs(id) on delete set null,
  artifact_type text not null check (artifact_type in ('docling_json','derived_markdown','ocr_layer','page_image','source_manifest')),
  schema_version text not null,
  engine_name text not null,
  engine_version text not null,
  content_hash text not null,
  storage_path text not null,
  byte_size bigint,
  confidence jsonb not null default '{}',
  provenance jsonb not null default '{}',
  is_canonical boolean not null default false,
  created_at timestamptz not null default now(),
  unique (document_id, artifact_type, content_hash)
);

alter table public.document_ingestion_artifacts enable row level security;
create policy document_ingestion_artifacts_read on public.document_ingestion_artifacts for select to authenticated
  using (private.can_view_document(document_id));
grant select on public.document_ingestion_artifacts to authenticated;

create index if not exists document_ingestion_artifacts_document_idx on public.document_ingestion_artifacts(document_id);
create index if not exists document_ingestion_artifacts_job_idx on public.document_ingestion_artifacts(ingestion_job_id);
create unique index if not exists document_ingestion_one_canonical_idx
  on public.document_ingestion_artifacts(document_id)
  where is_canonical;

alter table public.document_chunks
  add column if not exists source_artifact_id uuid references public.document_ingestion_artifacts(id) on delete set null,
  add column if not exists source_node_ref text,
  add column if not exists bounding_boxes jsonb not null default '[]',
  add column if not exists reading_order integer,
  add column if not exists extraction_confidence numeric(5,4),
  add column if not exists ocr_provenance jsonb not null default '{}';

create index if not exists document_chunks_source_artifact_idx on public.document_chunks(source_artifact_id);
create index if not exists document_chunks_reading_order_idx on public.document_chunks(document_id, reading_order);

