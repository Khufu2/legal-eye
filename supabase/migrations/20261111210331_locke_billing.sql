create table public.locke_billing_access (
  organization_id uuid primary key references public.organizations(id) on delete restrict,
  trial_ends_at timestamptz,
  paid_until timestamptz
);
create table public.locke_billing_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  request_digest text not null,
  amount integer not null check (amount = 49000),
  currency text not null check (currency = 'TZS'),
  status text not null default 'creating' check (status in ('creating','pending','completed','failed','voided','expired')),
  provider_reference text unique,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index locke_billing_single_open_order on public.locke_billing_orders(organization_id)
  where status in ('creating','pending');
create index locke_billing_order_history on public.locke_billing_orders(organization_id,created_at desc);
alter table public.locke_billing_access enable row level security;
alter table public.locke_billing_orders enable row level security;
revoke all on public.locke_billing_access, public.locke_billing_orders from public, anon, authenticated;
grant select, insert, update on public.locke_billing_access, public.locke_billing_orders to service_role;

create function public.locke_reserve_checkout(p_org uuid,p_digest text)
returns public.locke_billing_orders
language plpgsql security invoker set search_path = ''
as $$
declare order_row public.locke_billing_orders;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_org::text,0));
  select * into order_row from public.locke_billing_orders
    where organization_id=p_org and status in ('creating','pending') for update;
  if found then return order_row; end if;
  insert into public.locke_billing_orders(organization_id, request_digest, amount, currency)
    values(p_org,p_digest,49000,'TZS') returning * into order_row;
  return order_row;
end;
$$;

create function public.locke_start_trial(p_org uuid)
returns void language sql security invoker set search_path = ''
as $$
  insert into public.locke_billing_access(organization_id,trial_ends_at)
  values(p_org,now()+interval '14 days') on conflict (organization_id) do nothing;
$$;

create function public.locke_reconcile_checkout(
  p_order uuid,p_ref text,p_status text,p_amount integer,p_currency text
) returns public.locke_billing_orders
language plpgsql security invoker set search_path = ''
as $$
declare order_row public.locke_billing_orders;
begin
  select * into order_row from public.locke_billing_orders where id=p_order for update;
  if not found or order_row.amount<>p_amount or order_row.currency<>p_currency
    or (order_row.provider_reference is not null and order_row.provider_reference<>p_ref)
    or p_ref is null or p_status not in ('pending','completed','failed','voided','expired') then
    raise exception 'Payment does not match checkout';
  end if;
  if order_row.status='completed' or (p_status<>'completed' and order_row.status in ('failed','voided','expired')) then
    return order_row;
  end if;
  update public.locke_billing_orders set provider_reference=p_ref,status=p_status,
    completed_at=case when p_status='completed' then now() else null end
    where id=p_order returning * into order_row;
  if p_status='completed' then
    insert into public.locke_billing_access as access (organization_id,paid_until)
      values(order_row.organization_id,now()+interval '30 days')
      on conflict (organization_id) do update
      set paid_until=greatest(now(),access.paid_until,access.trial_ends_at)+interval '30 days';
  end if;
  return order_row;
end;
$$;

revoke execute on function public.locke_reserve_checkout(uuid,text),
  public.locke_start_trial(uuid), public.locke_reconcile_checkout(uuid,text,text,integer,text) from public, anon, authenticated;
grant execute on function public.locke_reserve_checkout(uuid,text),
  public.locke_start_trial(uuid), public.locke_reconcile_checkout(uuid,text,text,integer,text) to service_role;
