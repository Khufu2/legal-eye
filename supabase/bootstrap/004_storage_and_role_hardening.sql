begin;
alter function public.search_legal_evidence(text,text[],integer) security invoker;
revoke execute on function public.search_legal_evidence(text,text[],integer) from anon;
alter function public.legal_corpus_overview() security invoker;
alter policy vault_read on storage.objects using(bucket_id='firm-vault' and exists(select 1 from public.documents d where d.storage_path=name and private.can_view_document(d.id)));
alter policy vault_update on storage.objects using(bucket_id='firm-vault' and exists(select 1 from public.documents d where d.storage_path=name and private.is_org_member(d.organization_id) and private.can_view_document(d.id) and (d.uploaded_by=auth.uid() or private.org_role_for(d.organization_id) in ('owner','admin','partner')))) with check(bucket_id='firm-vault' and private.is_org_member(private.vault_org(name)));
alter policy vault_delete on storage.objects using(bucket_id='firm-vault' and exists(select 1 from public.documents d where d.storage_path=name and private.is_org_member(d.organization_id) and private.can_view_document(d.id) and (d.uploaded_by=auth.uid() or private.org_role_for(d.organization_id) in ('owner','admin','partner'))));
alter policy vault_insert on storage.objects with check(bucket_id='firm-vault' and private.org_role_for(private.vault_org(name)) in ('owner','admin','partner','associate','paralegal'));
create function private.can_write_org(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$select coalesce(private.org_role_for(p_org)::text,'') in ('owner','admin','partner','associate','paralegal')$$;
revoke all on function private.can_write_org(uuid) from public,anon;grant execute on function private.can_write_org(uuid) to authenticated,service_role;
do $$declare t text;begin
foreach t in array array['matters','documents','drafts','research_sessions','firm_templates','workflow_skills','review_tables','checklists','agent_runs','review_projects','comments','client_portals','workflows','workflow_runs','monitors'] loop
execute format('create policy writer_insert on public.%I as restrictive for insert to authenticated with check(private.can_write_org(organization_id))',t);
execute format('create policy writer_update on public.%I as restrictive for update to authenticated using(private.can_write_org(organization_id)) with check(private.can_write_org(organization_id))',t);
execute format('create policy writer_delete on public.%I as restrictive for delete to authenticated using(private.can_write_org(organization_id))',t);
end loop;end$$;
notify pgrst,'reload schema';
commit;
