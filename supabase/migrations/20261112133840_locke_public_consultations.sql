create table public.locke_public_advocates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(name) between 3 and 120),
  firm text not null check (length(firm) between 2 and 120),
  roll text not null unique check (roll ~ '^[A-Z0-9/-]{1,30}$'),
  city text not null check (length(city) between 2 and 60),
  areas text[] not null check (cardinality(areas) between 1 and 8 and areas <@ array['employment','land','family','business','disputes','estate','privacy','criminal']::text[]),
  state text not null default 'pending' check (state in ('pending','verified','withdrawn')),
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  check (state <> 'verified' or checked_at is not null)
);
create index locke_public_advocate_org on public.locke_public_advocates(organization_id);
create table public.locke_consultation_requests (
  id uuid primary key default gen_random_uuid(),
  advocate_id uuid not null references public.locke_public_advocates(id) on delete cascade,
  area text not null,
  name text not null check (length(name) between 2 and 100),
  email text not null check (length(email) between 5 and 254),
  locale text not null check (locale in ('en','sw')),
  requester_hash text not null,
  status text not null default 'new' check (status in ('new','contacted','closed')),
  created_at timestamptz not null default now()
);
create index locke_consultation_advocate_date on public.locke_consultation_requests(advocate_id,created_at desc);
create index locke_consultation_requester_date on public.locke_consultation_requests(requester_hash,created_at desc);
create index locke_consultation_purge_date on public.locke_consultation_requests(created_at);
alter table public.locke_public_advocates enable row level security;
alter table public.locke_consultation_requests enable row level security;
revoke all on public.locke_public_advocates,public.locke_consultation_requests from public,anon,authenticated;
grant select,insert,update on public.locke_public_advocates,public.locke_consultation_requests to service_role;

create function public.locke_request_consultation(p_advocate uuid,p_area text,p_name text,p_email text,p_locale text,p_requester text)
returns text language plpgsql security invoker set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('locke-consult:' || p_requester,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('locke-email:' || p_email,0));
  perform 1 from public.locke_public_advocates
    where id=p_advocate and state='verified' and checked_at>now()-interval '90 days' and p_area=any(areas) for share;
  if not found then
    return 'unavailable';
  end if;
  if exists (select 1 from public.locke_consultation_requests where advocate_id=p_advocate and email=p_email and area=p_area and created_at>now()-interval '24 hours') then
    return 'received';
  end if;
  if (select count(*) from public.locke_consultation_requests where requester_hash=p_requester and created_at>now()-interval '1 hour')>=8
    or (select count(*) from public.locke_consultation_requests where email=p_email and created_at>now()-interval '1 day')>=4 then
    return 'limited';
  end if;
  insert into public.locke_consultation_requests(advocate_id,area,name,email,locale,requester_hash)
    values(p_advocate,p_area,p_name,p_email,p_locale,p_requester);
  return 'received';
end $$;

create function public.locke_submit_advocate(p_org uuid,p_name text,p_firm text,p_roll text,p_city text,p_areas text[])
returns uuid language plpgsql security invoker set search_path='' as $$
declare listing uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('locke-listing:' || p_org::text,0));
  if (select count(*) from public.locke_public_advocates where organization_id=p_org and state<>'withdrawn')>=20
    and not exists (select 1 from public.locke_public_advocates where roll=p_roll and organization_id=p_org and state<>'withdrawn') then
    raise exception 'Listing limit reached';
  end if;
  insert into public.locke_public_advocates(organization_id,name,firm,roll,city,areas)
    values(p_org,p_name,p_firm,p_roll,p_city,p_areas)
  on conflict (roll) do update set name=excluded.name,firm=excluded.firm,city=excluded.city,areas=excluded.areas,
    state='pending',checked_at=null
  where locke_public_advocates.organization_id=p_org
    and ((locke_public_advocates.name,locke_public_advocates.firm,locke_public_advocates.city,locke_public_advocates.areas)
      is distinct from (excluded.name,excluded.firm,excluded.city,excluded.areas)
      or locke_public_advocates.state='withdrawn' or locke_public_advocates.checked_at<=now()-interval '90 days')
  returning id into listing;
  if listing is null then
    select id into listing from public.locke_public_advocates where roll=p_roll and organization_id=p_org;
  end if;
  if listing is null then raise exception 'Roll number is already registered'; end if;
  return listing;
end $$;

create function public.locke_manage_consultation(p_org uuid,p_id uuid,p_status text)
returns boolean language sql security invoker set search_path='' as $$
  with changed as (
    update public.locke_consultation_requests r set status=p_status
    from public.locke_public_advocates a
    where a.id=r.advocate_id and a.organization_id=p_org and r.id=p_id
      and r.created_at>now()-interval '90 days'
      and (r.status=p_status or (r.status='new' and p_status='contacted') or (r.status in ('new','contacted') and p_status='closed'))
    returning r.id
  ) select exists(select 1 from changed);
$$;

create function public.locke_withdraw_advocate(p_org uuid,p_id uuid)
returns boolean language sql security invoker set search_path='' as $$
  with changed as (
    update public.locke_public_advocates set state='withdrawn',checked_at=null where organization_id=p_org and id=p_id returning id
  ) select exists(select 1 from changed);
$$;

revoke execute on function public.locke_request_consultation(uuid,text,text,text,text,text),
  public.locke_submit_advocate(uuid,text,text,text,text,text[]),
  public.locke_manage_consultation(uuid,uuid,text),public.locke_withdraw_advocate(uuid,uuid) from public,anon,authenticated;
grant execute on function public.locke_request_consultation(uuid,text,text,text,text,text),
  public.locke_submit_advocate(uuid,text,text,text,text,text[]),
  public.locke_manage_consultation(uuid,uuid,text),public.locke_withdraw_advocate(uuid,uuid) to service_role;

select cron.schedule('locke-expire-consultation-requests','19 2 * * *',
  $$delete from public.locke_consultation_requests where created_at < now() - interval '90 days'$$);
