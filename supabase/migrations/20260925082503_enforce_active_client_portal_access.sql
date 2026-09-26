-- Keep firm matter permissions and revoke guest reads when a portal is archived.
create or replace function private.has_portal_access(p_portal_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.client_portals p where p.id=p_portal_id and (
      (private.is_org_member(p.organization_id) and (p.matter_id is null or private.has_matter_access(p.matter_id)))
      or (p.status='active' and exists (
        select 1 from public.portal_members pm where pm.portal_id=p.id and pm.user_id=auth.uid()
      ))
    )
  );
$$;
revoke all on function private.has_portal_access(uuid) from public, anon;
grant execute on function private.has_portal_access(uuid) to authenticated, service_role;

-- Restrictive policies also constrain older permissive conversation/run policies.
create policy portal_conversations_active on public.portal_conversations as restrictive for all to authenticated
using (private.has_portal_access(portal_id)) with check (private.has_portal_access(portal_id));
create policy portal_runs_active on public.portal_runs as restrictive for all to authenticated
using (private.has_portal_access(portal_id)) with check (private.has_portal_access(portal_id));
create policy portal_messages_active on public.portal_messages as restrictive for all to authenticated
using (exists(select 1 from public.portal_conversations c where c.id=conversation_id and private.has_portal_access(c.portal_id)))
with check (exists(select 1 from public.portal_conversations c where c.id=conversation_id and private.has_portal_access(c.portal_id)));

-- Publishing requires the resource to be readable by the publisher and in this firm.
-- Invoker context deliberately preserves resource/matter RLS.
create or replace function private.validate_portal_publication()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_org uuid; v_resource_org uuid;
begin
  select organization_id into v_org from public.client_portals where id=new.portal_id;
  case new.resource_type
    when 'document' then select organization_id into v_resource_org from public.documents where id=new.resource_id;
    when 'draft' then select organization_id into v_resource_org from public.drafts where id=new.resource_id;
    when 'review_table' then select organization_id into v_resource_org from public.review_tables where id=new.resource_id;
    when 'workflow' then select organization_id into v_resource_org from public.workflows where id=new.resource_id;
    else raise exception 'Unsupported portal resource';
  end case;
  if v_org is null or v_resource_org is distinct from v_org then
    raise exception 'Resource is unavailable or belongs to another firm' using errcode='42501';
  end if;
  return new;
end;
$$;
create trigger validate_portal_publication before insert or update on public.portal_resources
for each row execute function private.validate_portal_publication();
