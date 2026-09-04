-- Legal Eye: jurisdiction plug-ins, temporal legislation, licensing gates,
-- monitors and durable workflow graph. Unknown source rights always fail closed.

alter table public.source_registry
  add column if not exists cache_allowed boolean not null default false,
  add column if not exists permanent_storage_allowed boolean not null default false,
  add column if not exists redistribution_allowed boolean not null default false;

create table if not exists public.jurisdictions (
  code text primary key,
  name text not null,
  family text not null,
  parent_code text references public.jurisdictions(code),
  official_languages text[] not null default '{}',
  default_citation_parser text,
  active boolean not null default true,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.court_registry (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_code text not null references public.jurisdictions(code),
  name text not null,
  normalized_name text not null,
  level integer not null check (level > 0),
  parent_court_id uuid references public.court_registry(id),
  authority_rank numeric(6,3) not null default 0,
  valid_from date,
  valid_to date,
  official_source_url text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (jurisdiction_code, normalized_name)
);

create table if not exists public.citation_parser_registry (
  jurisdiction_code text primary key references public.jurisdictions(code),
  parser_key text not null,
  parser_version text not null,
  implementation_type text not null check (implementation_type in ('legal_eye','upstream_adapter','ruleset','pending')),
  upstream_component text,
  status text not null default 'planned' check (status in ('planned','testing','active','disabled')),
  fixture_count integer not null default 0,
  last_evaluated_at timestamptz,
  metadata jsonb not null default '{}'
);

create table if not exists public.citation_aliases (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_code text not null references public.jurisdictions(code),
  raw_citation text not null,
  normalized_citation text not null,
  authority_id uuid references public.authorities(id) on delete set null,
  confidence numeric(5,4) check (confidence between 0 and 1),
  verified boolean not null default false,
  verified_by uuid references auth.users(id),
  source text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (jurisdiction_code, raw_citation)
);

create table if not exists public.legislation_works (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_code text not null references public.jurisdictions(code),
  frbr_uri text not null unique,
  title text not null,
  short_title text,
  work_type text not null default 'act',
  number text,
  year integer,
  enacted_on date,
  repealed_on date,
  parent_work_id uuid references public.legislation_works(id),
  source_registry_id uuid references public.source_registry(id),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legislation_expressions (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.legislation_works(id) on delete cascade,
  expression_uri text not null unique,
  language_code text not null,
  expression_date date not null,
  effective_from date,
  effective_to date,
  version_label text,
  akn_xml text,
  rendered_html text,
  source_hash text,
  source_url text,
  is_official boolean not null default false,
  provenance jsonb not null default '{}',
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_from is null or effective_to >= effective_from),
  unique (work_id, language_code, expression_date)
);

create table if not exists public.legislation_amendments (
  id uuid primary key default gen_random_uuid(),
  amending_work_id uuid not null references public.legislation_works(id),
  amended_work_id uuid not null references public.legislation_works(id),
  commencement_date date,
  affected_provisions text[] not null default '{}',
  operation text not null default 'amend',
  source_span jsonb not null default '{}',
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  check (amending_work_id <> amended_work_id)
);

create table if not exists public.template_license_registry (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  template_id uuid references public.firm_templates(id) on delete cascade,
  template_key text not null,
  source_name text not null,
  source_url text,
  license_spdx text,
  license_url text,
  attribution_text text,
  jurisdiction_code text references public.jurisdictions(code),
  source_date date,
  source_version text,
  commercial_reuse_status text not null default 'review_required'
    check (commercial_reuse_status in ('approved','attribution_required','prohibited','review_required')),
  derivatives_allowed boolean not null default false,
  redistribution_allowed boolean not null default false,
  source_hash text not null,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique nulls not distinct (organization_id, template_key, source_hash)
);

create table if not exists public.monitors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete set null,
  name text not null,
  monitor_type text not null check (monitor_type in ('legislation','gazette','regulator','case','topic','jurisdiction')),
  jurisdiction_codes text[] not null default '{}',
  topic_query text,
  status text not null default 'active' check (status in ('draft','active','paused','archived')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monitor_sources (
  monitor_id uuid not null references public.monitors(id) on delete cascade,
  source_registry_id uuid not null references public.source_registry(id),
  primary key (monitor_id, source_registry_id)
);

create table if not exists public.monitor_events (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid not null references public.monitors(id) on delete cascade,
  source_registry_id uuid references public.source_registry(id),
  detected_at timestamptz not null default now(),
  published_at timestamptz,
  title text not null,
  source_url text,
  change_kind text,
  summary text,
  impact jsonb not null default '{}',
  affected_authority_ids uuid[] not null default '{}',
  fingerprint text not null,
  status text not null default 'new' check (status in ('new','triaged','assigned','resolved','dismissed')),
  assigned_to uuid references auth.users(id),
  evidence jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (monitor_id, fingerprint)
);

create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete set null,
  name text not null,
  description text,
  natural_language_spec text,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft','testing','active','archived')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_nodes (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  node_key text not null,
  node_type text not null check (node_type in ('trigger','skill','research','review','draft','decision','human_checkpoint','delivery')),
  position jsonb not null default '{}',
  configuration jsonb not null default '{}',
  retry_policy jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (workflow_id, node_key)
);

create table if not exists public.workflow_edges (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  source_node_id uuid not null references public.workflow_nodes(id) on delete cascade,
  target_node_id uuid not null references public.workflow_nodes(id) on delete cascade,
  condition jsonb not null default '{}',
  created_at timestamptz not null default now(),
  check (source_node_id <> target_node_id),
  unique (workflow_id, source_node_id, target_node_id)
);

create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','running','waiting_for_human','complete','failed','cancelled')),
  graph_version integer not null,
  current_node_key text,
  checkpoint jsonb not null default '{}',
  input jsonb not null default '{}',
  output jsonb,
  error jsonb,
  started_by uuid not null references auth.users(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists court_registry_jurisdiction_rank_idx on public.court_registry(jurisdiction_code, authority_rank desc);
create index if not exists citation_aliases_normalized_idx on public.citation_aliases(jurisdiction_code, normalized_citation);
create index if not exists legislation_works_lookup_idx on public.legislation_works(jurisdiction_code, year desc, title);
create index if not exists legislation_expressions_time_idx on public.legislation_expressions(work_id, effective_from desc, effective_to);
create index if not exists monitors_org_status_idx on public.monitors(organization_id, status);
create index if not exists monitor_events_feed_idx on public.monitor_events(monitor_id, detected_at desc);
create index if not exists workflows_org_status_idx on public.workflows(organization_id, status);
create index if not exists workflow_runs_org_status_idx on public.workflow_runs(organization_id, status, created_at desc);

alter table public.jurisdictions enable row level security;
alter table public.court_registry enable row level security;
alter table public.citation_parser_registry enable row level security;
alter table public.citation_aliases enable row level security;
alter table public.legislation_works enable row level security;
alter table public.legislation_expressions enable row level security;
alter table public.legislation_amendments enable row level security;
alter table public.template_license_registry enable row level security;
alter table public.monitors enable row level security;
alter table public.monitor_sources enable row level security;
alter table public.monitor_events enable row level security;
alter table public.workflows enable row level security;
alter table public.workflow_nodes enable row level security;
alter table public.workflow_edges enable row level security;
alter table public.workflow_runs enable row level security;

create policy jurisdictions_read on public.jurisdictions for select using (true);
create policy courts_read on public.court_registry for select using (true);
create policy citation_parsers_read on public.citation_parser_registry for select using (true);
create policy citation_aliases_read on public.citation_aliases for select using (true);
create policy legislation_works_read on public.legislation_works for select using (true);
create policy legislation_expressions_read on public.legislation_expressions for select using (true);
create policy legislation_amendments_read on public.legislation_amendments for select using (true);

create policy template_licenses_read on public.template_license_registry for select
  using (organization_id is null or private.is_org_member(organization_id));
create policy template_licenses_write on public.template_license_registry for all
  using (organization_id is not null and private.org_role_for(organization_id) = any (array['owner'::public.org_role,'admin'::public.org_role,'partner'::public.org_role]))
  with check (organization_id is not null and private.org_role_for(organization_id) = any (array['owner'::public.org_role,'admin'::public.org_role,'partner'::public.org_role]));

create policy monitors_access on public.monitors for all
  using (private.is_org_member(organization_id) and (matter_id is null or private.has_matter_access(matter_id)))
  with check (private.is_org_member(organization_id) and created_by = (select auth.uid()) and (matter_id is null or private.has_matter_access(matter_id)));
create policy monitor_sources_access on public.monitor_sources for all
  using (exists (select 1 from public.monitors m where m.id=monitor_id and private.is_org_member(m.organization_id) and (m.matter_id is null or private.has_matter_access(m.matter_id))))
  with check (exists (select 1 from public.monitors m where m.id=monitor_id and private.is_org_member(m.organization_id) and (m.matter_id is null or private.has_matter_access(m.matter_id))));
create policy monitor_events_access on public.monitor_events for all
  using (exists (select 1 from public.monitors m where m.id=monitor_id and private.is_org_member(m.organization_id) and (m.matter_id is null or private.has_matter_access(m.matter_id))))
  with check (exists (select 1 from public.monitors m where m.id=monitor_id and private.is_org_member(m.organization_id) and (m.matter_id is null or private.has_matter_access(m.matter_id))));

create policy workflows_access on public.workflows for all
  using (private.is_org_member(organization_id) and (matter_id is null or private.has_matter_access(matter_id)))
  with check (private.is_org_member(organization_id) and created_by = (select auth.uid()) and (matter_id is null or private.has_matter_access(matter_id)));
create policy workflow_nodes_access on public.workflow_nodes for all
  using (exists (select 1 from public.workflows w where w.id=workflow_id and private.is_org_member(w.organization_id) and (w.matter_id is null or private.has_matter_access(w.matter_id))))
  with check (exists (select 1 from public.workflows w where w.id=workflow_id and private.is_org_member(w.organization_id) and (w.matter_id is null or private.has_matter_access(w.matter_id))));
create policy workflow_edges_access on public.workflow_edges for all
  using (exists (select 1 from public.workflows w where w.id=workflow_id and private.is_org_member(w.organization_id) and (w.matter_id is null or private.has_matter_access(w.matter_id))))
  with check (exists (select 1 from public.workflows w where w.id=workflow_id and private.is_org_member(w.organization_id) and (w.matter_id is null or private.has_matter_access(w.matter_id))));
create policy workflow_runs_access on public.workflow_runs for all
  using (private.is_org_member(organization_id) and (matter_id is null or private.has_matter_access(matter_id)))
  with check (private.is_org_member(organization_id) and started_by = (select auth.uid()) and (matter_id is null or private.has_matter_access(matter_id)));

grant select on public.jurisdictions, public.court_registry, public.citation_parser_registry,
  public.citation_aliases, public.legislation_works, public.legislation_expressions,
  public.legislation_amendments to anon, authenticated;
grant select, insert, update, delete on public.template_license_registry, public.monitors,
  public.monitor_sources, public.monitor_events, public.workflows, public.workflow_nodes,
  public.workflow_edges, public.workflow_runs to authenticated;

insert into public.jurisdictions (code, name, family, parent_code, official_languages, default_citation_parser) values
  ('AFRICA','Africa','region',null,array['en','fr','pt','ar'],null),
  ('TZ','Tanzania','common-law','AFRICA',array['sw','en'],'tz'),
  ('ZZ','Zanzibar','common-law','TZ',array['sw','en'],'zz'),
  ('KE','Kenya','common-law','AFRICA',array['en','sw'],'ke'),
  ('UG','Uganda','common-law','AFRICA',array['en','sw'],'ug'),
  ('RW','Rwanda','mixed','AFRICA',array['rw','en','fr'],'rw'),
  ('ZM','Zambia','common-law','AFRICA',array['en'],'zm'),
  ('GH','Ghana','common-law','AFRICA',array['en'],'gh'),
  ('ZA','South Africa','mixed','AFRICA',array['en','af','zu','xh'],'za'),
  ('NG','Nigeria','common-law','AFRICA',array['en'],'ng'),
  ('ZW','Zimbabwe','common-law','AFRICA',array['en'],'zw'),
  ('MW','Malawi','common-law','AFRICA',array['en'],'mw'),
  ('NA','Namibia','mixed','AFRICA',array['en'],'na'),
  ('SL','Sierra Leone','common-law','AFRICA',array['en'],'sl'),
  ('SC','Seychelles','mixed','AFRICA',array['en','fr'],'sc'),
  ('MU','Mauritius','mixed','AFRICA',array['en','fr'],'mu'),
  ('LS','Lesotho','common-law','AFRICA',array['en','st'],'ls'),
  ('SZ','Eswatini','mixed','AFRICA',array['en','ss'],'sz'),
  ('OHADA','OHADA','civil-law','AFRICA',array['fr','en','pt','es'],'ohada'),
  ('AU-ORG','African Union','international','AFRICA',array['en','fr','pt','ar'],'african-regional'),
  ('UK','United Kingdom','common-law',null,array['en'],'uk'),
  ('US','United States','common-law',null,array['en'],'eyecite'),
  ('EU','European Union','supranational',null,array['en','fr','de'],'eu'),
  ('CA','Canada','common-law',null,array['en','fr'],'ca'),
  ('AU','Australia','common-law',null,array['en'],'au'),
  ('NZ','New Zealand','common-law',null,array['en','mi'],'nz'),
  ('IN','India','common-law',null,array['en','hi'],'in'),
  ('SG','Singapore','common-law',null,array['en','zh','ms','ta'],'sg'),
  ('HK','Hong Kong','common-law',null,array['zh','en'],'hk'),
  ('INT','International Law','international',null,array['en','fr','es','ar'],'international')
on conflict (code) do update set
  name=excluded.name, family=excluded.family, parent_code=excluded.parent_code,
  official_languages=excluded.official_languages, default_citation_parser=excluded.default_citation_parser,
  updated_at=now();

insert into public.citation_parser_registry (jurisdiction_code, parser_key, parser_version, implementation_type, upstream_component, status) values
  ('TZ','tz','0.1.0','legal_eye',null,'testing'), ('ZZ','zz','0.1.0','legal_eye',null,'planned'),
  ('KE','ke','0.1.0','legal_eye',null,'testing'), ('UG','ug','0.1.0','legal_eye',null,'planned'),
  ('RW','rw','0.1.0','legal_eye',null,'planned'), ('ZA','za','0.1.0','legal_eye',null,'planned'),
  ('GH','gh','0.1.0','legal_eye',null,'planned'), ('NG','ng','0.1.0','legal_eye',null,'planned'),
  ('US','eyecite','0.1.0','upstream_adapter','freelawproject/eyecite','testing'),
  ('UK','uk','0.1.0','legal_eye',null,'planned'), ('EU','eu','0.1.0','legal_eye',null,'planned'),
  ('OHADA','ohada','0.1.0','legal_eye',null,'planned')
on conflict (jurisdiction_code) do update set parser_key=excluded.parser_key, parser_version=excluded.parser_version,
  implementation_type=excluded.implementation_type, upstream_component=excluded.upstream_component, status=excluded.status;

-- Registry inventory only. Every newly listed source remains disabled for ingestion
-- until an operation-by-operation rights review changes its flags and policy state.
insert into public.source_registry (name, jurisdiction_code, content_types, policy_state, sync_enabled) values
  ('AfricanLII','AFRICA',array['case','legislation'],'review_required',false),
  ('Laws.Africa','AFRICA',array['legislation','akn'],'review_required',false),
  ('African Union','AU-ORG',array['treaty','regulation','policy'],'review_required',false),
  ('African Court on Human and Peoples Rights','AU-ORG',array['case'],'review_required',false),
  ('African Commission on Human and Peoples Rights','AU-ORG',array['decision','report'],'review_required',false),
  ('AfCFTA','AU-ORG',array['treaty','protocol','decision'],'review_required',false),
  ('Judiciary of Tanzania e-Maktaba','TZ',array['case'],'review_required',false),
  ('Tanzania Office of the Attorney General','TZ',array['legislation'],'review_required',false),
  ('TanzLII','TZ',array['case','legislation'],'review_required',false),
  ('Tanzania Government Gazette','TZ',array['gazette','notice','legislation'],'review_required',false),
  ('Bank of Tanzania','TZ',array['regulation','circular','notice'],'review_required',false),
  ('Tanzania Revenue Authority','TZ',array['guidance','notice'],'review_required',false),
  ('BRELA','TZ',array['notice','register'],'review_required',false),
  ('Fair Competition Commission Tanzania','TZ',array['decision','notice','guidance'],'review_required',false),
  ('TCRA','TZ',array['regulation','licence','notice'],'review_required',false),
  ('CMSA Tanzania','TZ',array['regulation','notice'],'review_required',false),
  ('PPRA Tanzania','TZ',array['regulation','decision','notice'],'review_required',false),
  ('EWURA','TZ',array['regulation','decision','notice'],'review_required',false),
  ('Mining Commission Tanzania','TZ',array['regulation','notice'],'review_required',false),
  ('Tanzania Investment Centre','TZ',array['guidance','notice'],'review_required',false),
  ('Personal Data Protection Commission Tanzania','TZ',array['regulation','decision','guidance'],'review_required',false),
  ('ZanzibarLII','ZZ',array['case','legislation'],'review_required',false),
  ('Zanzibar Official Gazette','ZZ',array['gazette','legislation'],'review_required',false),
  ('Zanzibar Judiciary','ZZ',array['case'],'review_required',false),
  ('Kenya Law','KE',array['case','legislation'],'review_required',false),
  ('Judiciary of Kenya','KE',array['case'],'review_required',false),
  ('Kenya Gazette','KE',array['gazette','notice'],'review_required',false),
  ('Kenya Revenue Authority','KE',array['guidance','notice'],'review_required',false),
  ('Central Bank of Kenya','KE',array['regulation','circular','notice'],'review_required',false),
  ('Competition Authority of Kenya','KE',array['decision','guidance','notice'],'review_required',false),
  ('Communications Authority of Kenya','KE',array['regulation','notice'],'review_required',false),
  ('Office of the Data Protection Commissioner Kenya','KE',array['decision','guidance','notice'],'review_required',false),
  ('ULII','UG',array['case','legislation'],'review_required',false),
  ('Judiciary of Uganda','UG',array['case'],'review_required',false),
  ('Uganda Gazette','UG',array['gazette','notice'],'review_required',false),
  ('Bank of Uganda','UG',array['regulation','circular','notice'],'review_required',false),
  ('Uganda Revenue Authority','UG',array['guidance','notice'],'review_required',false),
  ('RwandaLII','RW',array['case','legislation'],'review_required',false),
  ('Rwanda Official Gazette','RW',array['gazette','legislation'],'review_required',false),
  ('Judiciary of Rwanda','RW',array['case'],'review_required',false),
  ('National Bank of Rwanda','RW',array['regulation','circular','notice'],'review_required',false),
  ('Rwanda Revenue Authority','RW',array['guidance','notice'],'review_required',false),
  ('ZambiaLII','ZM',array['case','legislation'],'review_required',false),
  ('Judiciary of Zambia','ZM',array['case'],'review_required',false),
  ('National Assembly of Zambia','ZM',array['legislation'],'review_required',false),
  ('Zambia Gazette','ZM',array['gazette','notice'],'review_required',false),
  ('Zambia Revenue Authority','ZM',array['guidance','notice'],'review_required',false),
  ('Bank of Zambia','ZM',array['regulation','circular','notice'],'review_required',false),
  ('Competition and Consumer Protection Commission Zambia','ZM',array['decision','guidance'],'review_required',false),
  ('GhaLII','GH',array['case','legislation'],'review_required',false),
  ('Judicial Service of Ghana','GH',array['case'],'review_required',false),
  ('Parliament of Ghana','GH',array['legislation'],'review_required',false),
  ('Ghana Gazette','GH',array['gazette','notice'],'review_required',false),
  ('Ghana Revenue Authority','GH',array['guidance','notice'],'review_required',false),
  ('Bank of Ghana','GH',array['regulation','circular','notice'],'review_required',false),
  ('SEC Ghana','GH',array['regulation','decision','notice'],'review_required',false),
  ('Data Protection Commission Ghana','GH',array['decision','guidance','notice'],'review_required',false),
  ('LawLibrary South Africa','ZA',array['case','legislation'],'review_required',false),
  ('SAFLII','ZA',array['case'],'review_required',false),
  ('Constitutional Court of South Africa','ZA',array['case'],'review_required',false),
  ('Supreme Court of Appeal South Africa','ZA',array['case'],'review_required',false),
  ('South Africa Government Legislation','ZA',array['legislation'],'review_required',false),
  ('South Africa Government Gazette','ZA',array['gazette','notice'],'review_required',false),
  ('SARS','ZA',array['guidance','notice'],'review_required',false),
  ('South African Reserve Bank','ZA',array['regulation','circular','notice'],'review_required',false),
  ('FSCA South Africa','ZA',array['regulation','decision','notice'],'review_required',false),
  ('Competition Commission South Africa','ZA',array['decision','guidance'],'review_required',false),
  ('Information Regulator South Africa','ZA',array['decision','guidance','notice'],'review_required',false),
  ('Nigeria Official Legislation','NG',array['legislation'],'review_required',false),
  ('Supreme Court of Nigeria','NG',array['case'],'review_required',false),
  ('Court of Appeal of Nigeria','NG',array['case'],'review_required',false),
  ('Federal High Court Nigeria','NG',array['case'],'review_required',false),
  ('Federal Gazette Nigeria','NG',array['gazette','notice'],'review_required',false),
  ('Corporate Affairs Commission Nigeria','NG',array['notice','register'],'review_required',false),
  ('Federal Inland Revenue Service Nigeria','NG',array['guidance','notice'],'review_required',false),
  ('Central Bank of Nigeria','NG',array['regulation','circular','notice'],'review_required',false),
  ('SEC Nigeria','NG',array['regulation','decision','notice'],'review_required',false),
  ('FCCPC Nigeria','NG',array['decision','guidance','notice'],'review_required',false),
  ('Nigeria Data Protection Commission','NG',array['decision','guidance','notice'],'review_required',false),
  ('ZimLII','ZW',array['case','legislation'],'review_required',false),
  ('Judiciary of Zimbabwe','ZW',array['case'],'review_required',false),
  ('Parliament of Zimbabwe','ZW',array['legislation'],'review_required',false),
  ('Zimbabwe Gazette','ZW',array['gazette','notice'],'review_required',false),
  ('MalawiLII','MW',array['case','legislation'],'review_required',false),
  ('NamibLII','NA',array['case','legislation'],'review_required',false),
  ('SierraLII','SL',array['case','legislation'],'review_required',false),
  ('SeyLII','SC',array['case','legislation'],'review_required',false),
  ('MauritiusLII','MU',array['case','legislation'],'review_required',false),
  ('LesothoLII','LS',array['case','legislation'],'review_required',false),
  ('EswatiniLII','SZ',array['case','legislation'],'review_required',false),
  ('OHADA Treaty and Uniform Acts','OHADA',array['treaty','legislation'],'review_required',false),
  ('CCJA Jurisprudence','OHADA',array['case'],'review_required',false),
  ('UK Legislation','UK',array['legislation'],'review_required',false),
  ('UK National Archives Find Case Law','UK',array['case'],'review_required',false),
  ('UK Supreme Court','UK',array['case'],'review_required',false),
  ('CourtListener','US',array['case','docket'],'review_required',false),
  ('GovInfo','US',array['legislation','regulation','report'],'review_required',false),
  ('US Congress','US',array['legislation'],'review_required',false),
  ('US Supreme Court','US',array['case'],'review_required',false),
  ('EUR-Lex','EU',array['legislation','case','treaty'],'review_required',false),
  ('CURIA','EU',array['case'],'review_required',false),
  ('European Commission','EU',array['regulation','decision','guidance'],'review_required',false),
  ('European Parliament','EU',array['legislation','report'],'review_required',false),
  ('HUDOC','EU',array['case'],'review_required',false),
  ('Justice Laws Website Canada','CA',array['legislation'],'review_required',false),
  ('Supreme Court of Canada','CA',array['case'],'review_required',false),
  ('CanLII','CA',array['case','legislation'],'review_required',false),
  ('Federal Register of Legislation Australia','AU',array['legislation'],'review_required',false),
  ('High Court of Australia','AU',array['case'],'review_required',false),
  ('Federal Court of Australia','AU',array['case'],'review_required',false),
  ('AustLII','AU',array['case','legislation'],'review_required',false),
  ('New Zealand Legislation','NZ',array['legislation'],'review_required',false),
  ('Courts of New Zealand','NZ',array['case'],'review_required',false),
  ('NZLII','NZ',array['case','legislation'],'review_required',false),
  ('India Code','IN',array['legislation'],'review_required',false),
  ('Supreme Court of India','IN',array['case'],'review_required',false),
  ('eCourts India','IN',array['case','docket'],'review_required',false),
  ('Gazette of India','IN',array['gazette','notice'],'review_required',false),
  ('Singapore Statutes Online','SG',array['legislation'],'review_required',false),
  ('Supreme Court of Singapore','SG',array['case'],'review_required',false),
  ('Hong Kong e-Legislation','HK',array['legislation'],'review_required',false),
  ('Hong Kong Judiciary','HK',array['case'],'review_required',false),
  ('International Court of Justice','INT',array['case','treaty'],'review_required',false),
  ('International Criminal Court','INT',array['case'],'review_required',false),
  ('ICSID','INT',array['case','award'],'review_required',false),
  ('UNCITRAL','INT',array['treaty','model-law','case'],'review_required',false),
  ('World Trade Organization','INT',array['treaty','decision','report'],'review_required',false),
  ('WIPO Lex','INT',array['legislation','treaty','case'],'review_required',false),
  ('ILO NORMLEX','INT',array['treaty','report'],'review_required',false),
  ('UN Treaty Collection','INT',array['treaty'],'review_required',false),
  ('UN Official Documents','INT',array['resolution','report','treaty'],'review_required',false),
  ('Westlaw','INT',array['commercial'],'license_required',false),
  ('LexisNexis','INT',array['commercial'],'license_required',false),
  ('Practical Law','INT',array['commercial'],'license_required',false)
on conflict (name) do nothing;

