-- LOCKE internal go-to-market CRM. Separate from customer legal-work data.
-- No anonymous / ordinary authenticated access, no customer data in outreach tables.
create table if not exists public.crm_firms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 200),
  city text, country text not null default 'Tanzania',
  segment text, priority text not null default 'medium' check (priority in ('high','medium','strategic','low')),
  status text not null default 'researched' check (status in ('researched','qualified','permission_pending','ready_for_approval','invited','engaged','pilot_booked','pilot_active','converted','closed')),
  website text, source_url text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists crm_firms_name_city_unique on public.crm_firms (lower(name),lower(coalesce(city,'')));
create index if not exists crm_firms_status_priority_idx on public.crm_firms(status,priority);
create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete cascade,
  contact_name text, title text, email text not null check (position('@' in email)>1), phone text,
  email_source_url text not null, verification_level text not null default 'published_unverified',
  consent_status text not null default 'not_established' check (consent_status in ('not_established','opted_in','existing_relationship','opted_out')),
  consent_evidence text, do_not_contact boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint crm_contact_send_guard check (
    do_not_contact or (consent_status in ('opted_in','existing_relationship') and nullif(btrim(consent_evidence),'') is not null)
  ),
  constraint crm_contact_optout_guard check (consent_status <> 'opted_out' or do_not_contact)
);
create unique index if not exists crm_contacts_email_unique on public.crm_contacts(lower(email));
create index if not exists crm_contacts_firm_idx on public.crm_contacts(firm_id);
create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete cascade,
  contact_id uuid references public.crm_contacts(id) on delete set null,
  kind text not null check (kind in ('research','note','permission','draft','approval','email_sent','email_reply','meeting','pilot','slack_event','status_change')),
  detail text not null check (char_length(detail) between 1 and 10000),
  gmail_message_id text, actor_user_id uuid, occurred_at timestamptz not null default now()
);
create index if not exists crm_activities_firm_time_idx on public.crm_activities(firm_id,occurred_at desc);
create table if not exists public.crm_outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.crm_contacts(id) on delete cascade,
  subject text not null, body text not null,
  approval_status text not null default 'draft' check (approval_status in ('draft','pending_approval','approved','cancelled')),
  approved_by uuid, approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint crm_draft_approval_guard check ((approval_status <> 'approved') or (approved_by is not null and approved_at is not null))
);
create index if not exists crm_drafts_status_idx on public.crm_outreach_drafts(approval_status);
alter table public.crm_firms enable row level security;
alter table public.crm_contacts enable row level security;
alter table public.crm_activities enable row level security;
alter table public.crm_outreach_drafts enable row level security;
-- No RLS policies: all normal API users are denied even if a grant is changed later.
revoke all on public.crm_firms,public.crm_contacts,public.crm_activities,public.crm_outreach_drafts from public,anon,authenticated;
grant select,insert,update,delete on public.crm_firms,public.crm_contacts,public.crm_activities,public.crm_outreach_drafts to service_role;
comment on table public.crm_firms is 'Internal Locke sales prospects, never tenant legal-matter data.';
comment on table public.crm_contacts is 'Published contacts; permission to contact is NOT inferred from public listing.';
comment on table public.crm_outreach_drafts is 'Human-approved drafting queue; this table never sends email.';