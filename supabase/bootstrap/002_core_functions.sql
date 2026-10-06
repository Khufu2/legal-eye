begin;
alter table public.comments add column edited_at timestamptz;
create function public.search_private_text(p_query text,p_organization_id uuid,p_matter_id uuid default null,p_limit integer default 12)
returns table(chunk_id bigint,document_id uuid,title text,page_number integer,clause_number text,paragraph_number text,content text,rank real)
language sql stable security invoker set search_path='' as $$
select c.id,d.id,d.title,c.page_number,c.clause_number,c.paragraph_number,c.content,ts_rank_cd(c.search_vector,websearch_to_tsquery('simple',left(p_query,2000)))::real
from public.document_chunks c join public.documents d on d.id=c.document_id
where d.organization_id=p_organization_id and d.status='ready' and (p_matter_id is null or d.matter_id=p_matter_id) and c.search_vector @@ websearch_to_tsquery('simple',left(p_query,2000))
order by 8 desc,c.id limit least(greatest(p_limit,1),60)$$;
create function public.authority_status(p_authority_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select jsonb_build_object('authority_id',id,'status',coalesce(status,'unknown'),'verified_treatment',false,'metadata',metadata) from public.authorities where id=p_authority_id$$;
-- Treatment is not inferred from the absence of recorded citation edges.
create function public.refresh_authority_index() returns bigint language sql security invoker set search_path='' as $$with inserted as (insert into public.authorities(legal_document_id,title,citation,jurisdiction_code,status) select d.id,d.title,d.citation,d.jurisdiction_code,'unknown' from public.legal_documents d where not exists(select 1 from public.authorities a where a.legal_document_id=d.id) returning id) select count(*) from inserted$$;
create function public.legal_eye_audit_trigger() returns trigger language plpgsql security invoker set search_path='' as $$begin return case when tg_op='DELETE' then old else new end;end$$;
create function public.redeem_portal_invite(p_invite_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare i public.portal_invites; e text;
begin
select lower(email) into e from auth.users where id=auth.uid() and email_confirmed_at is not null and not coalesce(is_anonymous,false);
if e is null then raise exception 'Verified email required' using errcode='42501';end if;
select * into i from public.portal_invites where id=p_invite_id and lower(email)=e and expires_at>now() for update;
if not found or not exists(select 1 from public.client_portals where id=i.portal_id and status='active') then return false;end if;
insert into public.portal_members(portal_id,user_id,role) values(i.portal_id,auth.uid(),i.role) on conflict(portal_id,user_id) do nothing;
update public.portal_invites set accepted_at=coalesce(accepted_at,now()) where id=i.id;
return true;end$$;
create function public.redeem_portal_invite_by_slug(p_slug text) returns boolean language plpgsql security definer set search_path='' as $$declare i uuid;begin
select pi.id into i from public.portal_invites pi join public.client_portals p on p.id=pi.portal_id join auth.users u on u.id=auth.uid() where p.slug=p_slug and p.status='active' and lower(pi.email)=lower(u.email) and pi.expires_at>now();
if i is null then return false;end if;return public.redeem_portal_invite(i);end$$;
revoke all on function public.search_private_text(text,uuid,uuid,integer),public.authority_status(uuid),public.refresh_authority_index(),public.legal_eye_audit_trigger(),public.redeem_portal_invite(uuid),public.redeem_portal_invite_by_slug(text) from public,anon;
grant execute on function public.search_private_text(text,uuid,uuid,integer),public.authority_status(uuid),public.redeem_portal_invite(uuid),public.redeem_portal_invite_by_slug(text) to authenticated,service_role;
grant execute on function public.refresh_authority_index(),public.legal_eye_audit_trigger() to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('firm-vault','firm-vault',false,20971520,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain','text/markdown','application/octet-stream']) on conflict(id) do update set public=false;
create function private.vault_org(p_name text) returns uuid language plpgsql immutable set search_path='' as $$begin return split_part(p_name,'/',1)::uuid;exception when invalid_text_representation then return null;end$$;
revoke all on function private.vault_org(text) from public,anon;grant execute on function private.vault_org(text) to authenticated,service_role;
create policy vault_read on storage.objects for select to authenticated using(bucket_id='firm-vault' and (private.is_org_member(private.vault_org(name)) or exists(select 1 from public.documents d where d.storage_path=name and private.can_view_document(d.id))));
create policy vault_insert on storage.objects for insert to authenticated with check(bucket_id='firm-vault' and private.is_org_member(private.vault_org(name)));
create policy vault_update on storage.objects for update to authenticated using(bucket_id='firm-vault' and private.is_org_member(private.vault_org(name))) with check(bucket_id='firm-vault' and private.is_org_member(private.vault_org(name)));
create policy vault_delete on storage.objects for delete to authenticated using(bucket_id='firm-vault' and private.is_org_member(private.vault_org(name)));
commit;
