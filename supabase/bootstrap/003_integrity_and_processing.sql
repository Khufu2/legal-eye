begin;
create function public.replace_private_document_text(p_document_id uuid,p_content_hash text,p_chunks jsonb) returns integer
language plpgsql security invoker set search_path='' as $$
declare d public.documents;n integer;begin
select * into d from public.documents where id=p_document_id for update;
if d.id is null or not private.is_org_member(d.organization_id) or (d.uploaded_by<>auth.uid() and private.org_role_for(d.organization_id) not in ('owner','admin','partner')) then raise exception 'Document processing access denied' using errcode='42501';end if;
if jsonb_typeof(p_chunks)<>'array' or jsonb_array_length(p_chunks) not between 1 and 1000 or p_content_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid extracted document';end if;
if exists(select 1 from jsonb_to_recordset(p_chunks) as x(content text) where nullif(btrim(content),'') is null or length(content)>8000) then raise exception 'Invalid source passage';end if;
delete from public.document_chunks where document_id=d.id;
insert into public.document_chunks(document_id,page_number,content,reading_order,metadata) select d.id,x.page_number,x.content,x.reading_order,jsonb_build_object('engine','text-extraction','structure_verified',false) from jsonb_to_recordset(p_chunks) as x(page_number integer,content text,reading_order integer);
get diagnostics n=row_count;
update public.documents set status='ready',content_hash=p_content_hash,updated_at=clock_timestamp(),metadata=metadata||jsonb_build_object('parser','text-extraction','parser_state','complete','ocr_verified',false,'processed_at',clock_timestamp()) where id=d.id;
return n;end$$;
revoke all on function public.replace_private_document_text(uuid,text,jsonb) from public,anon;grant execute on function public.replace_private_document_text(uuid,text,jsonb) to authenticated;
create function private.validate_workspace_link() returns trigger language plpgsql security invoker set search_path='' as $$
declare row_data jsonb:=to_jsonb(new);old_data jsonb;org uuid;matter uuid;linked_org uuid;begin
org:=(row_data->>'organization_id')::uuid;
if tg_op='UPDATE' then old_data:=to_jsonb(old);if old_data->>'organization_id' is distinct from row_data->>'organization_id' then raise exception 'Workspace ownership cannot be reassigned' using errcode='42501';end if;end if;
if auth.uid() is not null and private.org_role_for(org)='viewer' then raise exception 'Read-only workspace account' using errcode='42501';end if;
matter:=(row_data->>'matter_id')::uuid;
if matter is not null then select organization_id into linked_org from public.matters where id=matter;if linked_org is distinct from org then raise exception 'Matter belongs to another workspace' using errcode='42501';end if;end if;
if row_data->>'document_id' is not null then select organization_id into linked_org from public.documents where id=(row_data->>'document_id')::uuid;if linked_org is distinct from org then raise exception 'Document belongs to another workspace' using errcode='42501';end if;end if;
if row_data->>'workflow_id' is not null then select organization_id into linked_org from public.workflows where id=(row_data->>'workflow_id')::uuid;if linked_org is distinct from org then raise exception 'Workflow belongs to another workspace' using errcode='42501';end if;end if;
return new;end$$;
create function private.audit_workspace_change() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb;begin r:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
insert into public.audit_logs(organization_id,actor_id,action,object_type,object_id,metadata) values((r->>'organization_id')::uuid,auth.uid(),lower(tg_op),tg_table_name,(r->>'id')::uuid,jsonb_build_object('operation',tg_op));
return case when tg_op='DELETE' then old else new end;end$$;
revoke all on function private.validate_workspace_link(),private.audit_workspace_change() from public,anon,authenticated;
do $$declare t text;begin
foreach t in array array['matters','documents','drafts','research_sessions','firm_templates','workflow_skills','review_tables','checklists','agent_runs','review_projects','comments','client_portals','workflows','workflow_runs','monitors'] loop
execute format('create trigger workspace_link_check before insert or update on public.%I for each row execute function private.validate_workspace_link()',t);
execute format('create trigger workspace_change_audit after insert or update or delete on public.%I for each row execute function private.audit_workspace_change()',t);
end loop;end$$;
-- Guests may read only explicitly published resources; they cannot mutate firm resources.
create policy workflow_portal_read on public.workflows for select to authenticated using(private.shared_resource('workflow',id));
create policy workflow_nodes_portal_read on public.workflow_nodes for select to authenticated using(private.shared_resource('workflow',workflow_id));
-- Material integrity: a table row may reference only a document in that table's firm.
create function private.validate_review_row() returns trigger language plpgsql security invoker set search_path='' as $$declare o uuid;d uuid;begin
if new.document_id is not null then select organization_id into o from public.review_tables where id=new.review_table_id;select organization_id into d from public.documents where id=new.document_id;if o is null or o is distinct from d then raise exception 'Document is unavailable or belongs to another workspace' using errcode='42501';end if;end if;return new;end$$;
create trigger review_row_link_check before insert or update on public.review_table_rows for each row execute function private.validate_review_row();
revoke all on function private.validate_review_row() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
