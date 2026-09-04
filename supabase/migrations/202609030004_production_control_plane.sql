-- Legal Eye production control plane.
-- Secrets and encryption key material are deliberately never stored in these tables.

create table if not exists public.ai_provider_registry (
  provider_key text primary key,
  display_name text not null,
  priority integer not null check (priority > 0),
  model_name text not null,
  api_key_secret_name text not null,
  enabled boolean not null default false,
  data_classification_ceiling text not null default 'confidential'
    check (data_classification_ceiling in ('public','internal','confidential','restricted')),
  retention_mode text not null default 'provider_default'
    check (retention_mode in ('provider_default','zero_retention_contract','private_endpoint')),
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (priority)
);

insert into public.ai_provider_registry
  (provider_key, display_name, priority, model_name, api_key_secret_name, enabled, data_classification_ceiling, retention_mode, metadata)
values
  ('gemini', 'Google Gemini', 10, 'gemini-3.8-flash', 'GEMINI_API_KEY', false, 'confidential', 'provider_default',
   jsonb_build_object('role','primary','model_channel','stable')),
  ('openrouter', 'OpenRouter', 20, 'openai/gpt-5.2', 'OPENROUTER_API_KEY', false, 'internal', 'provider_default',
   jsonb_build_object('role','fallback','routing','pinned-model'))
on conflict (provider_key) do update set
  display_name=excluded.display_name,
  priority=excluded.priority,
  model_name=excluded.model_name,
  api_key_secret_name=excluded.api_key_secret_name,
  data_classification_ceiling=excluded.data_classification_ceiling,
  metadata=excluded.metadata,
  updated_at=now();

create table if not exists public.ai_generation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  request_id uuid not null default gen_random_uuid(),
  action text not null,
  provider_key text references public.ai_provider_registry(provider_key),
  model_name text,
  outcome text not null check (outcome in ('success','provider_error','blocked','validation_error')),
  fallback_used boolean not null default false,
  prompt_sha256 text not null,
  response_sha256 text,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer not null check (latency_ms >= 0),
  data_classification text not null default 'confidential'
    check (data_classification in ('public','internal','confidential','restricted')),
  dlp_decision text not null default 'allow' check (dlp_decision in ('allow','redact','block')),
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_generation_events_org_created_idx
  on public.ai_generation_events(organization_id, created_at desc);
create index if not exists ai_generation_events_request_idx
  on public.ai_generation_events(request_id);

create table if not exists public.dlp_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  enabled boolean not null default true,
  classification text not null check (classification in ('public','internal','confidential','restricted')),
  action text not null check (action in ('allow','redact','block')),
  detectors text[] not null default array['credentials','financial_account','government_id']::text[],
  provider_allowlist text[] not null default '{}'::text[],
  configuration jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.dlp_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  request_id uuid,
  policy_id uuid references public.dlp_policies(id) on delete set null,
  decision text not null check (decision in ('allow','redact','block')),
  detector_types text[] not null default '{}'::text[],
  content_sha256 text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists dlp_events_org_created_idx on public.dlp_events(organization_id, created_at desc);

create table if not exists public.tenant_key_references (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  purpose text not null check (purpose in ('database','object_storage','field_encryption','export','backup')),
  kms_provider text not null check (kms_provider in ('gcp_kms','aws_kms','azure_key_vault','supabase_managed')),
  key_resource_uri text not null,
  key_version text,
  status text not null default 'active' check (status in ('active','rotating','retired','revoked')),
  last_rotated_at timestamptz,
  next_rotation_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, purpose)
);

create table if not exists public.enterprise_identity_providers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supabase_sso_provider_id uuid unique,
  protocol text not null default 'saml2' check (protocol in ('saml2','oidc')),
  display_name text not null,
  domains text[] not null default '{}'::text[],
  metadata_url text,
  status text not null default 'pending' check (status in ('pending','active','disabled','error')),
  enforce_sso boolean not null default false,
  attribute_mapping jsonb not null default '{}'::jsonb,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scim_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label text not null,
  token_sha256 text not null unique,
  status text not null default 'active' check (status in ('active','revoked','expired')),
  expires_at timestamptz,
  last_used_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.scim_sync_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scim_token_id uuid references public.scim_tokens(id) on delete set null,
  operation text not null,
  resource_type text not null check (resource_type in ('User','Group')),
  external_id text,
  target_user_id uuid references auth.users(id) on delete set null,
  outcome text not null check (outcome in ('success','rejected','error')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists scim_sync_events_org_created_idx on public.scim_sync_events(organization_id, created_at desc);

create table if not exists public.connector_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.source_registry(id) on delete cascade,
  connector_version text not null,
  mode text not null check (mode in ('discover','individual_fetch','incremental_sync','bulk_ingest','reconcile')),
  status text not null default 'queued' check (status in ('queued','running','succeeded','partial','failed','blocked_by_policy')),
  requested_by uuid references auth.users(id) on delete set null,
  cursor_before jsonb,
  cursor_after jsonb,
  discovered_count integer not null default 0,
  fetched_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  rejected_count integer not null default 0,
  policy_snapshot jsonb not null default '{}'::jsonb,
  error_summary text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists connector_runs_source_created_idx on public.connector_runs(source_id, created_at desc);

create table if not exists public.source_sync_cursors (
  source_id uuid primary key references public.source_registry(id) on delete cascade,
  cursor jsonb not null default '{}'::jsonb,
  watermark timestamptz,
  etag text,
  last_modified text,
  consecutive_failures integer not null default 0,
  next_attempt_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.source_ingest_objects (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.source_registry(id) on delete restrict,
  connector_run_id uuid references public.connector_runs(id) on delete set null,
  external_id text not null,
  canonical_url text not null,
  media_type text,
  retrieved_at timestamptz not null default now(),
  source_published_at timestamptz,
  content_sha256 text not null,
  byte_size bigint,
  storage_path text,
  raw_content text,
  headers jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  processing_state text not null default 'stored'
    check (processing_state in ('discovered','stored','parsed','indexed','rejected','quarantined')),
  unique (source_id, external_id, content_sha256)
);
create index if not exists source_ingest_objects_source_retrieved_idx
  on public.source_ingest_objects(source_id, retrieved_at desc);

create table if not exists public.evaluation_datasets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  jurisdiction_code text references public.jurisdictions(code),
  task_type text not null,
  version text not null,
  status text not null default 'draft' check (status in ('draft','approved','retired')),
  visibility text not null default 'private' check (visibility in ('private','shared','public_benchmark')),
  licence text,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique nulls not distinct (organization_id, name, version)
);

create table if not exists public.evaluation_cases (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.evaluation_datasets(id) on delete cascade,
  case_key text not null,
  input jsonb not null,
  expected jsonb not null,
  scoring_rubric jsonb not null,
  authority_ids uuid[] not null default '{}'::uuid[],
  source_provenance jsonb not null default '{}'::jsonb,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (dataset_id, case_key)
);

create table if not exists public.evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  dataset_id uuid not null references public.evaluation_datasets(id) on delete restrict,
  provider_key text references public.ai_provider_registry(provider_key),
  model_name text not null,
  application_commit text not null,
  prompt_version text not null,
  status text not null default 'queued' check (status in ('queued','running','passed','failed','cancelled')),
  aggregate_scores jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.evaluation_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.evaluation_runs(id) on delete cascade,
  case_id uuid not null references public.evaluation_cases(id) on delete cascade,
  passed boolean not null,
  scores jsonb not null,
  output_sha256 text not null,
  evidence jsonb not null default '{}'::jsonb,
  error_code text,
  latency_ms integer,
  created_at timestamptz not null default now(),
  unique (run_id, case_id)
);

create table if not exists public.security_test_runs (
  id uuid primary key default gen_random_uuid(),
  test_suite text not null,
  application_commit text not null,
  environment text not null check (environment in ('development','staging','production')),
  status text not null check (status in ('running','passed','failed')),
  scanner text not null,
  summary jsonb not null default '{}'::jsonb,
  artifact_uri text,
  artifact_sha256 text,
  started_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.compliance_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  framework text not null,
  control_id text not null,
  evidence_type text not null,
  title text not null,
  period_start date,
  period_end date,
  artifact_uri text not null,
  artifact_sha256 text not null,
  collected_by uuid references auth.users(id) on delete set null,
  collected_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique nulls not distinct (organization_id, framework, control_id, artifact_sha256)
);

create or replace function public.source_capability_allowed(p_source_id uuid, p_capability text)
returns boolean
language sql stable security definer
set search_path='public','pg_catalog'
as $$
  select case p_capability
    when 'discover' then s.discovery_allowed
    when 'individual_fetch' then s.individual_retrieval_allowed
    when 'cache' then s.cache_allowed
    when 'permanent_store' then s.permanent_storage_allowed
    when 'commercial_display' then s.commercial_display_allowed
    when 'bulk_ingest' then s.bulk_ingestion_allowed
    when 'embed' then s.embedding_allowed
    when 'compute' then s.computational_analysis_allowed
    when 'redistribute' then s.redistribution_allowed
    else false end
  from public.source_registry s
  where s.id=p_source_id and s.policy_state='approved';
$$;
revoke all on function public.source_capability_allowed(uuid,text) from public;
grant execute on function public.source_capability_allowed(uuid,text) to authenticated, service_role;

alter table public.ai_provider_registry enable row level security;
alter table public.ai_generation_events enable row level security;
alter table public.dlp_policies enable row level security;
alter table public.dlp_events enable row level security;
alter table public.tenant_key_references enable row level security;
alter table public.enterprise_identity_providers enable row level security;
alter table public.scim_tokens enable row level security;
alter table public.scim_sync_events enable row level security;
alter table public.connector_runs enable row level security;
alter table public.source_sync_cursors enable row level security;
alter table public.source_ingest_objects enable row level security;
alter table public.evaluation_datasets enable row level security;
alter table public.evaluation_cases enable row level security;
alter table public.evaluation_runs enable row level security;
alter table public.evaluation_results enable row level security;
alter table public.security_test_runs enable row level security;
alter table public.compliance_evidence enable row level security;

create policy ai_provider_registry_read on public.ai_provider_registry for select to authenticated using (true);
create policy ai_generation_events_read on public.ai_generation_events for select to authenticated
  using (organization_id is not null and private.is_org_member(organization_id));
create policy dlp_policies_read on public.dlp_policies for select to authenticated using (private.is_org_member(organization_id));
create policy dlp_policies_admin on public.dlp_policies for all to authenticated
  using (private.org_role_for(organization_id) in ('owner','admin'))
  with check (private.org_role_for(organization_id) in ('owner','admin'));
create policy dlp_events_read on public.dlp_events for select to authenticated
  using (organization_id is not null and private.org_role_for(organization_id) in ('owner','admin','partner'));
create policy key_refs_admin_read on public.tenant_key_references for select to authenticated
  using (private.org_role_for(organization_id) in ('owner','admin'));
create policy key_refs_admin_write on public.tenant_key_references for all to authenticated
  using (private.org_role_for(organization_id) in ('owner','admin'))
  with check (private.org_role_for(organization_id) in ('owner','admin'));
create policy idp_admin_read on public.enterprise_identity_providers for select to authenticated
  using (private.org_role_for(organization_id) in ('owner','admin'));
create policy idp_admin_write on public.enterprise_identity_providers for all to authenticated
  using (private.org_role_for(organization_id) in ('owner','admin'))
  with check (private.org_role_for(organization_id) in ('owner','admin'));
create policy scim_tokens_admin_read on public.scim_tokens for select to authenticated
  using (private.org_role_for(organization_id) in ('owner','admin'));
create policy scim_sync_admin_read on public.scim_sync_events for select to authenticated
  using (private.org_role_for(organization_id) in ('owner','admin'));
create policy connector_runs_read on public.connector_runs for select to authenticated using (true);
create policy source_cursors_read on public.source_sync_cursors for select to authenticated using (true);
create policy source_objects_read on public.source_ingest_objects for select to authenticated
  using (public.source_capability_allowed(source_id,'commercial_display'));
create policy eval_datasets_read on public.evaluation_datasets for select to authenticated
  using (organization_id is null or private.is_org_member(organization_id));
create policy eval_cases_read on public.evaluation_cases for select to authenticated
  using (exists(select 1 from public.evaluation_datasets d where d.id=dataset_id and (d.organization_id is null or private.is_org_member(d.organization_id))));
create policy eval_runs_read on public.evaluation_runs for select to authenticated
  using (organization_id is null or private.is_org_member(organization_id));
create policy eval_results_read on public.evaluation_results for select to authenticated
  using (exists(select 1 from public.evaluation_runs r where r.id=run_id and (r.organization_id is null or private.is_org_member(r.organization_id))));
create policy security_runs_admin_read on public.security_test_runs for select to authenticated
  using (exists(select 1 from public.organization_members om where om.user_id=(select auth.uid()) and om.is_active and om.role in ('owner','admin')));
create policy compliance_evidence_read on public.compliance_evidence for select to authenticated
  using (organization_id is not null and private.org_role_for(organization_id) in ('owner','admin','partner'));

grant select on public.ai_provider_registry, public.connector_runs, public.source_sync_cursors,
  public.source_ingest_objects, public.evaluation_datasets, public.evaluation_cases,
  public.evaluation_runs, public.evaluation_results to authenticated;
grant select on public.ai_generation_events, public.dlp_events, public.scim_sync_events,
  public.security_test_runs, public.compliance_evidence to authenticated;
grant select,insert,update,delete on public.dlp_policies, public.tenant_key_references,
  public.enterprise_identity_providers to authenticated;
grant select on public.scim_tokens to authenticated;

-- Current, reviewed source gates. An approved row is still capability-specific.
insert into public.source_registry
  (name,jurisdiction_code,authority_level,base_url,adapter_key,content_types,policy_state,
   discovery_allowed,individual_retrieval_allowed,cache_allowed,permanent_storage_allowed,
   commercial_display_allowed,bulk_ingestion_allowed,embedding_allowed,computational_analysis_allowed,
   redistribution_allowed,attribution_required,attribution_text,license_name,license_url,api_docs_url,
   sync_enabled,refresh_interval,last_legal_review,metadata)
values
  ('UK Legislation','UK','official','https://www.legislation.gov.uk','uk_legislation',array['legislation','regulation'],
   'approved',true,true,true,true,true,true,true,true,true,true,
   'Contains public sector information licensed under the Open Government Licence v3.0.',
   'Open Government Licence v3.0','https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
   'https://www.legislation.gov.uk/developer',true,interval '1 day',now(),
   jsonb_build_object('reviewed_on','2026-09-03','exceptions','Exclude third-party material, logos and departmental insignia; preserve source attribution.'))
on conflict (name) do update set
  jurisdiction_code=excluded.jurisdiction_code,authority_level=excluded.authority_level,base_url=excluded.base_url,
  adapter_key=excluded.adapter_key,content_types=excluded.content_types,policy_state=excluded.policy_state,
  discovery_allowed=excluded.discovery_allowed,individual_retrieval_allowed=excluded.individual_retrieval_allowed,
  cache_allowed=excluded.cache_allowed,permanent_storage_allowed=excluded.permanent_storage_allowed,
  commercial_display_allowed=excluded.commercial_display_allowed,bulk_ingestion_allowed=excluded.bulk_ingestion_allowed,
  embedding_allowed=excluded.embedding_allowed,computational_analysis_allowed=excluded.computational_analysis_allowed,
  redistribution_allowed=excluded.redistribution_allowed,attribution_required=excluded.attribution_required,
  attribution_text=excluded.attribution_text,license_name=excluded.license_name,license_url=excluded.license_url,
  api_docs_url=excluded.api_docs_url,sync_enabled=excluded.sync_enabled,refresh_interval=excluded.refresh_interval,
  last_legal_review=excluded.last_legal_review,metadata=excluded.metadata;

update public.source_registry set
  policy_state='approved', discovery_allowed=true, individual_retrieval_allowed=true,
  cache_allowed=true, permanent_storage_allowed=true, commercial_display_allowed=true,
  bulk_ingestion_allowed=true, embedding_allowed=true, computational_analysis_allowed=true,
  redistribution_allowed=true, attribution_required=true,
  attribution_text='Source: EUR-Lex. Legal texts may be reused; exclude protected third-party material, logos and notices that state otherwise.',
  license_name='European Commission reuse policy / Commission Decision 2011/833/EU',
  license_url='https://eur-lex.europa.eu/content/legal-notice/legal-notice.html',
  api_docs_url='https://eur-lex.europa.eu/content/help/data-reuse/reuse-contents-eurlex-details.html',
  last_legal_review=now(), sync_enabled=true,
  metadata=metadata || jsonb_build_object('reviewed_on','2026-09-03','exceptions','Per-document notices and third-party rights override the general reuse permission.')
where adapter_key='eurlex';

update public.source_registry set
  policy_state='license_required', discovery_allowed=true, individual_retrieval_allowed=false,
  cache_allowed=false, permanent_storage_allowed=false, commercial_display_allowed=false,
  bulk_ingestion_allowed=false, embedding_allowed=false, computational_analysis_allowed=false,
  redistribution_allowed=false, attribution_required=true,
  attribution_text='Laws.Africa attribution and share-alike terms apply; commercial use requires a commercial Content API agreement.',
  license_name='CC BY-NC-SA 4.0 for open content; commercial licence required for Legal Eye',
  license_url='https://laws.africa/terms/', api_docs_url='https://developers.laws.africa/',
  last_legal_review=now(), sync_enabled=false,
  metadata=metadata || jsonb_build_object('reviewed_on','2026-09-03','block_reason','Commercial product; no commercial Content API agreement has been recorded.')
where adapter_key='laws_africa';

update public.source_registry set
  policy_state='api_key_required', discovery_allowed=true, individual_retrieval_allowed=true,
  cache_allowed=false, permanent_storage_allowed=false, commercial_display_allowed=false,
  bulk_ingestion_allowed=false, embedding_allowed=false, computational_analysis_allowed=false,
  redistribution_allowed=false, attribution_required=true,
  attribution_text='Source: CourtListener, Free Law Project. API authentication and applicable agreement required.',
  license_name='API terms and source-specific court-document rights',
  license_url='https://free.law/terms/', api_docs_url='https://www.courtlistener.com/help/api/rest/',
  last_legal_review=now(), sync_enabled=false,
  metadata=metadata || jsonb_build_object('reviewed_on','2026-09-03','block_reason','No API token or commercial bulk-use agreement is configured.')
where adapter_key='courtlistener';

insert into public.evaluation_datasets
  (organization_id,name,jurisdiction_code,task_type,version,status,visibility,licence)
values
  (null,'Legal Eye citation-grounding smoke suite','TZ','citation_grounding','0.1.0','draft','public_benchmark','Legal Eye proprietary test metadata')
on conflict (organization_id,name,version) do nothing;

insert into public.evaluation_cases(dataset_id,case_key,input,expected,scoring_rubric,source_provenance)
select d.id, v.case_key, v.input::jsonb, v.expected::jsonb, v.rubric::jsonb, v.provenance::jsonb
from public.evaluation_datasets d
cross join (values
  ('tz-no-authority-fabrication',
   '{"question":"State the governing Tanzanian authority where no verified source is available.","retrieved_authorities":[]}',
   '{"must_abstain":true,"must_not_invent_citation":true}',
   '{"abstention":0.5,"citation_precision":0.5}',
   '{"kind":"synthetic_control","lawyer_review_required":true}'),
  ('temporal-law-date-required',
   '{"question":"What law applied on the transaction date?","transaction_date":null}',
   '{"must_request_date_or_bound_answer":true}',
   '{"temporal_scope":1.0}',
   '{"kind":"synthetic_control","lawyer_review_required":true}'),
  ('conflicting-authority-disclosure',
   '{"question":"Summarise the position.","retrieved_authorities":[{"treatment":"followed"},{"treatment":"distinguished"}]}',
   '{"must_surface_contrary_authority":true}',
   '{"contrary_authority_recall":1.0}',
   '{"kind":"synthetic_control","lawyer_review_required":true}')
) as v(case_key,input,expected,rubric,provenance)
where d.organization_id is null and d.name='Legal Eye citation-grounding smoke suite' and d.version='0.1.0'
on conflict (dataset_id,case_key) do nothing;
