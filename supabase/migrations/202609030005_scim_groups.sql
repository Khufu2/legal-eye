create table if not exists public.scim_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  external_id text,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (organization_id, external_id),
  unique (organization_id, display_name)
);

create table if not exists public.scim_group_members (
  group_id uuid not null references public.scim_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id,user_id)
);

alter table public.scim_groups enable row level security;
alter table public.scim_group_members enable row level security;

create policy scim_groups_admin_read on public.scim_groups for select to authenticated
  using (private.org_role_for(organization_id) in ('owner','admin'));
create policy scim_group_members_admin_read on public.scim_group_members for select to authenticated
  using (exists(select 1 from public.scim_groups g where g.id=group_id and private.org_role_for(g.organization_id) in ('owner','admin')));

grant select on public.scim_groups,public.scim_group_members to authenticated;
