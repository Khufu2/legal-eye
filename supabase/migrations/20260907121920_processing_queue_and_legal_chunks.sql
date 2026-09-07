-- Durable ingestion leases and public, source-span-preserving legal text.
-- The worker RPCs are SECURITY INVOKER and executable only by service_role.

create extension if not exists vector with schema extensions;

alter table public.ingestion_jobs
  add column if not exists idempotency_key text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists max_attempts integer not null default 5,
  add column if not exists available_at timestamptz not null default now(),
  add column if not exists worker_id text,
  add column if not exists lease_token uuid,
  add column if not exists leased_at timestamptz,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists heartbeat_at timestamptz,
  add column if not exists last_error_code text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists dead_lettered_at timestamptz;

create unique index if not exists ingestion_jobs_idempotency_key_unique
  on public.ingestion_jobs(idempotency_key);

create index if not exists ingestion_jobs_claimable_idx
  on public.ingestion_jobs(available_at, created_at)
  where status = 'queued' and cancelled_at is null and dead_lettered_at is null;

create index if not exists ingestion_jobs_expired_lease_idx
  on public.ingestion_jobs(lease_expires_at)
  where status = 'running' and lease_expires_at is not null;

create table if not exists public.legal_document_artifacts (
  id uuid primary key default gen_random_uuid(),
  legal_document_id uuid not null references public.legal_documents(id) on delete cascade,
  source_object_id uuid references public.source_ingest_objects(id) on delete set null,
  ingestion_job_id uuid references public.ingestion_jobs(id) on delete set null,
  artifact_type text not null check (artifact_type in ('docling_json','derived_markdown','ocr_layer','source_manifest')),
  schema_version text not null,
  engine_name text not null,
  engine_version text not null,
  content_hash text not null,
  source_content_hash text,
  storage_path text not null,
  byte_size bigint not null check (byte_size >= 0),
  confidence jsonb not null default '{}'::jsonb,
  ocr_provenance jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  is_canonical boolean not null default false,
  created_at timestamptz not null default now(),
  unique (legal_document_id, artifact_type, content_hash)
);

create unique index if not exists legal_document_artifacts_one_canonical_idx
  on public.legal_document_artifacts(legal_document_id)
  where is_canonical;
create index if not exists legal_document_artifacts_source_object_idx
  on public.legal_document_artifacts(source_object_id);
create index if not exists legal_document_artifacts_job_idx
  on public.legal_document_artifacts(ingestion_job_id);

create table if not exists public.legal_document_chunks (
  id uuid primary key default gen_random_uuid(),
  legal_document_id uuid not null references public.legal_documents(id) on delete cascade,
  artifact_id uuid not null references public.legal_document_artifacts(id) on delete cascade,
  source_node_ref text not null,
  parent_node_ref text,
  node_type text not null default 'text',
  reading_order integer not null,
  page_number integer,
  bounding_boxes jsonb not null default '[]'::jsonb,
  start_offset integer,
  end_offset integer,
  content text not null check (length(content) > 0),
  language_code text,
  extraction_confidence numeric(5,4) check (extraction_confidence between 0 and 1),
  ocr_provenance jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  search_vector tsvector generated always as (to_tsvector('simple', content)) stored,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  unique (artifact_id, source_node_ref)
);

create index if not exists legal_document_chunks_document_order_idx
  on public.legal_document_chunks(legal_document_id, reading_order);
create index if not exists legal_document_chunks_artifact_idx
  on public.legal_document_chunks(artifact_id);
create index if not exists legal_document_chunks_search_idx
  on public.legal_document_chunks using gin(search_vector);
create index if not exists legal_document_chunks_embedding_idx
  on public.legal_document_chunks using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

create table if not exists public.ingestion_job_events (
  id bigint generated always as identity primary key,
  ingestion_job_id uuid not null references public.ingestion_jobs(id) on delete cascade,
  source_id uuid references public.source_registry(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  worker_id text,
  event_type text not null check (event_type in ('queued','claimed','heartbeat','completed','retry_scheduled','dead_lettered','cancelled')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ingestion_job_events_job_created_idx
  on public.ingestion_job_events(ingestion_job_id, created_at desc);
create index if not exists ingestion_job_events_org_created_idx
  on public.ingestion_job_events(organization_id, created_at desc)
  where organization_id is not null;

alter table public.legal_document_artifacts enable row level security;
alter table public.legal_document_chunks enable row level security;
alter table public.ingestion_job_events enable row level security;

create policy legal_document_artifacts_public_read
  on public.legal_document_artifacts for select to anon, authenticated
  using (
    exists (
      select 1
      from public.legal_documents d
      join public.source_registry s on s.id = d.source_id
      where d.id = legal_document_id
        and s.policy_state = 'approved'
        and s.commercial_display_allowed
    )
  );

create policy legal_document_chunks_public_read
  on public.legal_document_chunks for select to anon, authenticated
  using (
    exists (
      select 1
      from public.legal_documents d
      join public.source_registry s on s.id = d.source_id
      where d.id = legal_document_id
        and s.policy_state = 'approved'
        and s.commercial_display_allowed
    )
  );

create policy ingestion_job_events_org_read
  on public.ingestion_job_events for select to authenticated
  using (
    ingestion_job_events.organization_id is not null
    and (select private.is_org_member(ingestion_job_events.organization_id))
  );

grant select on public.legal_document_artifacts, public.legal_document_chunks to anon, authenticated;
grant select, insert, update, delete on public.legal_document_artifacts, public.legal_document_chunks to service_role;
grant select, insert on public.ingestion_job_events to service_role;
grant usage, select on sequence public.ingestion_job_events_id_seq to service_role;
grant select, insert, update on public.ingestion_jobs to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'legal-corpus-artifacts',
  'legal-corpus-artifacts',
  false,
  104857600,
  array['application/json','text/markdown','text/plain']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.claim_ingestion_jobs(
  p_worker_id text,
  p_job_types text[],
  p_limit integer default 1,
  p_lease_seconds integer default 300
)
returns setof public.ingestion_jobs
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if nullif(trim(p_worker_id), '') is null then
    raise exception 'worker id is required';
  end if;
  if coalesce(array_length(p_job_types, 1), 0) = 0 then
    raise exception 'at least one job type is required';
  end if;

  return query
  with candidates as (
    select j.id
    from public.ingestion_jobs j
    where j.job_type = any(p_job_types)
      and j.cancelled_at is null
      and j.dead_lettered_at is null
      and (
        (j.status = 'queued' and j.available_at <= now())
        or (j.status = 'running' and j.lease_expires_at < now())
      )
    order by coalesce(j.available_at, j.created_at), j.created_at
    limit least(greatest(p_limit, 1), 10)
    for update skip locked
  ), claimed as (
    update public.ingestion_jobs j
    set status = 'running',
        worker_id = p_worker_id,
        lease_token = gen_random_uuid(),
        leased_at = now(),
        lease_expires_at = now() + make_interval(secs => least(greatest(p_lease_seconds, 30), 3600)),
        heartbeat_at = now(),
        started_at = coalesce(j.started_at, now()),
        attempt_count = j.attempt_count + 1,
        error_message = null,
        last_error_code = null
    from candidates c
    where j.id = c.id
    returning j.*
  ), events as (
    insert into public.ingestion_job_events
      (ingestion_job_id, source_id, organization_id, worker_id, event_type, detail)
    select id, source_id, organization_id, p_worker_id, 'claimed',
      jsonb_build_object('attempt', attempt_count, 'lease_expires_at', lease_expires_at)
    from claimed
    returning ingestion_job_id
  )
  select claimed.* from claimed left join events on events.ingestion_job_id = claimed.id;
end;
$$;

create or replace function public.heartbeat_ingestion_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_extend_seconds integer default 300
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_count integer;
begin
  update public.ingestion_jobs
  set heartbeat_at = now(),
      lease_expires_at = now() + make_interval(secs => least(greatest(p_extend_seconds, 30), 3600))
  where id = p_job_id and lease_token = p_lease_token and status = 'running'
    and cancelled_at is null and dead_lettered_at is null;
  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

create or replace function public.complete_ingestion_job(
  p_job_id uuid,
  p_lease_token uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  completed public.ingestion_jobs%rowtype;
begin
  update public.ingestion_jobs
  set status = 'complete', progress = 1, completed_at = now(),
      lease_token = null, lease_expires_at = null, heartbeat_at = now()
  where id = p_job_id and lease_token = p_lease_token and status = 'running'
  returning * into completed;
  if completed.id is null then return false; end if;
  insert into public.ingestion_job_events
    (ingestion_job_id, source_id, organization_id, worker_id, event_type)
  values (completed.id, completed.source_id, completed.organization_id, completed.worker_id, 'completed');
  return true;
end;
$$;

create or replace function public.fail_ingestion_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_error_code text,
  p_error_message text,
  p_retryable boolean default true
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  failed public.ingestion_jobs%rowtype;
  next_status text;
  event_name text;
begin
  select * into failed
  from public.ingestion_jobs
  where id = p_job_id and lease_token = p_lease_token and status = 'running'
  for update;
  if failed.id is null then return 'lease_lost'; end if;

  if p_retryable and failed.attempt_count < failed.max_attempts then
    next_status := 'queued';
    event_name := 'retry_scheduled';
  else
    next_status := 'failed';
    event_name := 'dead_lettered';
  end if;

  update public.ingestion_jobs
  set status = next_status,
      available_at = case when next_status = 'queued'
        then now() + make_interval(secs => least(3600, 30 * (2 ^ greatest(failed.attempt_count - 1, 0))::integer))
        else available_at end,
      error_message = left(coalesce(p_error_message, 'processing failed'), 2000),
      last_error_code = left(coalesce(p_error_code, 'processing_error'), 120),
      dead_lettered_at = case when next_status = 'failed' then now() else null end,
      lease_token = null, lease_expires_at = null, heartbeat_at = now(),
      completed_at = case when next_status = 'failed' then now() else null end
  where id = failed.id;

  insert into public.ingestion_job_events
    (ingestion_job_id, source_id, organization_id, worker_id, event_type, detail)
  values (
    failed.id, failed.source_id, failed.organization_id, failed.worker_id, event_name,
    jsonb_build_object('attempt', failed.attempt_count, 'max_attempts', failed.max_attempts,
      'error_code', left(coalesce(p_error_code, 'processing_error'), 120))
  );
  return next_status;
end;
$$;

revoke all on function public.claim_ingestion_jobs(text,text[],integer,integer) from public, anon, authenticated;
revoke all on function public.heartbeat_ingestion_job(uuid,uuid,integer) from public, anon, authenticated;
revoke all on function public.complete_ingestion_job(uuid,uuid) from public, anon, authenticated;
revoke all on function public.fail_ingestion_job(uuid,uuid,text,text,boolean) from public, anon, authenticated;
grant execute on function public.claim_ingestion_jobs(text,text[],integer,integer) to service_role;
grant execute on function public.heartbeat_ingestion_job(uuid,uuid,integer) to service_role;
grant execute on function public.complete_ingestion_job(uuid,uuid) to service_role;
grant execute on function public.fail_ingestion_job(uuid,uuid,text,text,boolean) to service_role;
