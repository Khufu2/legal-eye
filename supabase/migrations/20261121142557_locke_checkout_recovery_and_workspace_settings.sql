create or replace function public.locke_reserve_checkout(p_org uuid,p_digest text)
returns public.locke_billing_orders
language plpgsql security invoker set search_path = ''
as $$
declare order_row public.locke_billing_orders;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_org::text,0));

  -- Locke can retry for 23 hours. A Snippe mobile intent can remain payable
  -- for four hours after creation. Keep a buffer and retain the old row
  -- so a verified late completion can still be credited.
  update public.locke_billing_orders
    set status = 'expired'
    where organization_id = p_org and status = 'creating'
      and provider_reference is null and created_at <= now() - interval '30 hours';

  select * into order_row from public.locke_billing_orders
    where organization_id=p_org and status in ('creating','pending') for update;
  if found then return order_row; end if;

  insert into public.locke_billing_orders(organization_id,request_digest,amount,currency)
    values(p_org,p_digest,49000,'TZS') returning * into order_row;
  return order_row;
end;
$$;

create or replace function public.locke_rename_workspace(p_org uuid,p_name text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare new_name text := btrim(p_name);
begin
  if new_name is null or char_length(new_name) not between 2 and 100 then
    raise exception 'Enter a workspace name from 2 to 100 characters' using errcode = '22023';
  end if;

  perform 1 from public.organization_members
    where organization_id=p_org and user_id=auth.uid()
      and is_active is true and role in ('owner','admin') for share;
  if not found then
    raise exception 'Workspace owner or administrator required' using errcode = '42501';
  end if;

  update public.organizations set name=new_name, updated_at=now() where id=p_org;
  return new_name;
end;
$$;

revoke execute on function public.locke_rename_workspace(uuid,text) from public, anon;
grant execute on function public.locke_rename_workspace(uuid,text) to authenticated;
