create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.org_role not null default 'associate',
  token_hash text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  revoked_at timestamptz,
  check (role <> 'owner'),
  check (email = lower(btrim(email)))
);
create index workspace_invites_org_idx on public.workspace_invites(organization_id,created_at desc);
alter table public.workspace_invites enable row level security;
create policy workspace_invites_admin_read on public.workspace_invites for select to authenticated
  using (private.org_role_for(organization_id) in ('owner','admin'));
grant select on public.workspace_invites to authenticated;
grant all on public.workspace_invites to service_role;
revoke insert,update,delete on public.organization_members from authenticated;

create function public.create_workspace_invite(p_organization_id uuid,p_email text,p_role public.org_role default 'associate')
returns uuid language plpgsql security definer set search_path='' as $$
declare v_role public.org_role; v_token uuid:=gen_random_uuid(); begin
  v_role:=private.org_role_for(p_organization_id);
  if v_role is null or v_role not in ('owner','admin') then
    raise exception 'Only firm owners and admins can invite members' using errcode='42501';
  end if;
  if p_role is null or p_role='owner' or (v_role='admin' and p_role='admin') then
    raise exception 'This role cannot be assigned by invitation' using errcode='42501';
  end if;
  if p_email is null or char_length(btrim(p_email))>254 or btrim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid work email' using errcode='22023';
  end if;
  -- A fresh invitation supersedes previous pending links for this recipient.
  update public.workspace_invites set revoked_at=now()
  where organization_id=p_organization_id and email=lower(btrim(p_email)) and accepted_at is null and revoked_at is null;
  insert into public.workspace_invites(organization_id,email,role,token_hash,created_by)
  values(p_organization_id,lower(btrim(p_email)),p_role,encode(extensions.digest(v_token::text,'sha256'),'hex'),auth.uid());
  return v_token;
end $$;

create function public.accept_workspace_invite(p_token uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_invite public.workspace_invites; v_email text; begin
  select lower(email) into v_email from auth.users
  where id=auth.uid() and email_confirmed_at is not null and not coalesce(is_anonymous,false);
  if v_email is null then raise exception 'Sign in with a verified email first' using errcode='42501'; end if;
  select * into v_invite from public.workspace_invites
  where token_hash=encode(extensions.digest(p_token::text,'sha256'),'hex') for update;
  if v_invite.id is null or v_invite.email<>v_email or v_invite.revoked_at is not null or v_invite.expires_at<=now() then
    raise exception 'This invitation is unavailable or belongs to another email' using errcode='42501';
  end if;
  if v_invite.accepted_at is not null then
    if v_invite.accepted_by=auth.uid() and private.is_org_member(v_invite.organization_id) then return v_invite.organization_id; end if;
    raise exception 'This invitation has already been used' using errcode='42501';
  end if;
  if exists(select 1 from public.organization_members where organization_id=v_invite.organization_id and user_id=auth.uid() and not is_active) then
    raise exception 'Your firm access is suspended. Contact the firm administrator.' using errcode='42501';
  end if;
  insert into public.organization_members(organization_id,user_id,role)
  values(v_invite.organization_id,auth.uid(),v_invite.role) on conflict(organization_id,user_id) do nothing;
  update public.workspace_invites set accepted_at=now(),accepted_by=auth.uid() where id=v_invite.id;
  return v_invite.organization_id;
end $$;

create function public.revoke_workspace_invite(p_invite_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.workspace_invites set revoked_at=now()
  where id=p_invite_id and private.org_role_for(organization_id) in ('owner','admin') and accepted_at is null;
  if not found then raise exception 'Invitation is unavailable' using errcode='42501'; end if;
end $$;

create function public.list_workspace_members(p_organization_id uuid)
returns table(user_id uuid,email text,role public.org_role,is_active boolean,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  if coalesce(private.org_role_for(p_organization_id)::text,'') not in ('owner','admin') then
    raise exception 'Firm administrator access required' using errcode='42501';
  end if;
  return query select m.user_id,u.email::text,m.role,m.is_active,m.created_at
  from public.organization_members m join auth.users u on u.id=m.user_id
  where m.organization_id=p_organization_id order by m.created_at;
end $$;

create function public.set_workspace_member_access(p_organization_id uuid,p_user_id uuid,p_role public.org_role,p_active boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor public.org_role; v_target public.org_role; begin
  -- Serialize owner changes so concurrent requests cannot remove every owner.
  perform 1 from public.organizations where id=p_organization_id for update;
  v_actor:=private.org_role_for(p_organization_id);
  select role into v_target from public.organization_members where organization_id=p_organization_id and user_id=p_user_id;
  if v_actor is null or v_target is null or v_actor not in ('owner','admin') or p_role is null or p_active is null then
    raise exception 'Firm administrator access required' using errcode='42501';
  end if;
  if v_actor='admin' and (v_target in ('owner','admin') or p_role in ('owner','admin')) then
    raise exception 'Only owners can manage administrator access' using errcode='42501';
  end if;
  if v_target='owner' and (p_role<>'owner' or not p_active) and not exists (
    select 1 from public.organization_members where organization_id=p_organization_id and user_id<>p_user_id and role='owner' and is_active
  ) then raise exception 'Keep at least one active firm owner' using errcode='23514'; end if;
  update public.organization_members set role=p_role,is_active=p_active where organization_id=p_organization_id and user_id=p_user_id;
end $$;

revoke all on function public.create_workspace_invite(uuid,text,public.org_role),public.accept_workspace_invite(uuid),public.revoke_workspace_invite(uuid),public.list_workspace_members(uuid),public.set_workspace_member_access(uuid,uuid,public.org_role,boolean) from public,anon;
grant execute on function public.create_workspace_invite(uuid,text,public.org_role),public.accept_workspace_invite(uuid),public.revoke_workspace_invite(uuid),public.list_workspace_members(uuid),public.set_workspace_member_access(uuid,uuid,public.org_role,boolean) to authenticated,service_role;
