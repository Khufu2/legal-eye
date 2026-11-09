-- LOCKE internal acquisition CRM. Isolated from client matter and legal-work schemas.
-- Activation: provision authorized auth.users IDs through a privileged migration or SQL editor,
-- never through the public application. No staff row => no access.
create table if not exists public.crm_staff (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'operator' check (role in ('owner','operator','viewer')),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.crm_leads (
 id uuid primary key default gen_random_uuid(),
 firm_name text not null check (char_length(firm_name) between 2 and 200),
 city text,
 segment text,
 priority text not null default 'medium' check (priority in ('high','medium','strategic')),
 contact_name text,
 contact_role text,
 public_email text,
 public_phone text,
 website text,
 source_url text,
 source_checked_at timestamptz,
 email_permission text not null default 'not_established' check (email_permission in ('not_established','permitted','opted_out')),
 permission_evidence text,
 stage text not null default 'researched' check (stage in ('researched','qualified','permission_pending','ready_for_approval','invited','engaged','pilot_booked','pilot_active','converted','closed')),
 outreach_approved_at timestamptz,
 outreach_approved_by uuid references auth.users(id),
 owner_user_id uuid references auth.users(id),
 next_action text,
 next_action_at timestamptz,
 notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(firm_name, public_email)
);
create table if not exists public.crm_events (
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null references public.crm_leads(id) on delete cascade,
 actor_user_id uuid not null references auth.users(id),
 event_type text not null check (event_type in ('note','status_change','reply_logged','meeting','email_draft','email_sent','unsubscribe','import')),
 detail text,
 external_message_id text,
 created_at timestamptz not null default now()
);
create index if not exists crm_leads_stage_idx on public.crm_leads(stage,priority);
create index if not exists crm_leads_next_action_idx on public.crm_leads(next_action_at) where next_action_at is not null;
create index if not exists crm_events_lead_idx on public.crm_events(lead_id,created_at desc);
alter table public.crm_staff enable row level security;
alter table public.crm_leads enable row level security;
alter table public.crm_events enable row level security;
revoke all on public.crm_staff,public.crm_leads,public.crm_events from anon;
revoke all on public.crm_staff,public.crm_leads,public.crm_events from authenticated;
grant select on public.crm_staff to authenticated;
grant select,insert,update on public.crm_leads to authenticated;
grant select,insert on public.crm_events to authenticated;
create policy "crm staff may read own membership" on public.crm_staff for select to authenticated using (user_id=(select auth.uid()));
create policy "crm staff read leads" on public.crm_leads for select to authenticated using (
 exists(select 1 from public.crm_staff s where s.user_id=(select auth.uid()) and s.active)
);
create policy "crm operators insert leads" on public.crm_leads for insert to authenticated with check (
 exists(select 1 from public.crm_staff s where s.user_id=(select auth.uid()) and s.active and s.role in ('owner','operator'))
 and (email_permission <> 'permitted' or nullif(btrim(coalesce(permission_evidence,'')),'') is not null)
 and (stage not in ('ready_for_approval','invited') or (outreach_approved_at is not null and outreach_approved_by is not null and email_permission='permitted'))
);
create policy "crm operators update leads" on public.crm_leads for update to authenticated
 using (exists(select 1 from public.crm_staff s where s.user_id=(select auth.uid()) and s.active and s.role in ('owner','operator')))
 with check (
 exists(select 1 from public.crm_staff s where s.user_id=(select auth.uid()) and s.active and s.role in ('owner','operator'))
 and (email_permission <> 'permitted' or nullif(btrim(coalesce(permission_evidence,'')),'') is not null)
 and (stage not in ('ready_for_approval','invited') or (outreach_approved_at is not null and outreach_approved_by is not null and email_permission='permitted'))
 );
create policy "crm staff read events" on public.crm_events for select to authenticated using (
 exists(select 1 from public.crm_staff s where s.user_id=(select auth.uid()) and s.active)
);
create policy "crm operators create attributable events" on public.crm_events for insert to authenticated with check (
 actor_user_id=(select auth.uid()) and
 exists(select 1 from public.crm_staff s where s.user_id=(select auth.uid()) and s.active and s.role in ('owner','operator'))
);
comment on table public.crm_leads is 'Internal marketing CRM, independent of customer legal matters. Public contact does not imply outreach permission.';
