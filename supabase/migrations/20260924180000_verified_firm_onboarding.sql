-- First-member bootstrap cannot use invoker RLS: the organization is not
-- visible until its first membership exists. Keep both writes atomic and expose
-- only this narrowly scoped operation, bound to the verified caller.
create or replace function public.create_organization_with_owner(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
begin
  if v_user is null or not exists (
    select 1 from auth.users u
    where u.id = v_user and u.email_confirmed_at is not null
      and coalesce(u.is_anonymous, false) = false
  ) then
    raise exception 'A verified email account is required' using errcode = '42501';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 then
    raise exception 'Firm name must contain 1 to 120 characters' using errcode = '22023';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{2,79}$' then
    raise exception 'Invalid workspace slug' using errcode = '22023';
  end if;

  -- A retry after a lost response may return only this caller's active workspace.
  select o.id into v_org
  from public.organizations o
  join public.organization_members m on m.organization_id = o.id
  where o.slug = p_slug and o.created_by = v_user
    and m.user_id = v_user and m.role = 'owner' and m.is_active;
  if v_org is not null then return v_org; end if;

  insert into public.organizations(name, slug, created_by)
  values (btrim(p_name), p_slug, v_user) returning id into v_org;
  insert into public.organization_members(organization_id, user_id, role)
  values (v_org, v_user, 'owner');
  return v_org;
end;
$$;

revoke all on function public.create_organization_with_owner(text,text) from public, anon;
grant execute on function public.create_organization_with_owner(text,text) to authenticated, service_role;
