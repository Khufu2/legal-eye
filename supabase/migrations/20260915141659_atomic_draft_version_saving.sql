create or replace function public.save_draft_version(p_organization_id uuid,p_title text,p_text text,p_draft_id uuid default null,p_expected_updated_at timestamptz default null)
returns jsonb language plpgsql security invoker set search_path=public,pg_catalog as $$
declare d public.drafts; next_version integer;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if length(trim(p_title))=0 or length(p_text)>500000 then raise exception 'Invalid draft title or document length'; end if;
 if p_draft_id is null then
  insert into public.drafts(organization_id,created_by,title,document_type,jurisdiction_codes,content,status) values(p_organization_id,auth.uid(),trim(p_title),'legal_document',array['TZ'],jsonb_build_object('text',p_text),'draft') returning * into d;
 else
  select * into d from public.drafts where id=p_draft_id and organization_id=p_organization_id for update;
  if not found then raise exception 'Document unavailable'; end if;
  if p_expected_updated_at is null or d.updated_at is distinct from p_expected_updated_at then raise exception 'This document changed in another session. Reopen it before saving to avoid overwriting those changes.';end if;
  update public.drafts set title=trim(p_title),content=jsonb_build_object('text',p_text),updated_at=clock_timestamp() where id=d.id returning * into d;
 end if;
 select coalesce(max(version_number),0)+1 into next_version from public.draft_versions where draft_id=d.id;
 insert into public.draft_versions(draft_id,version_number,content,created_by) values(d.id,next_version,d.content,auth.uid());
 return jsonb_build_object('draft',to_jsonb(d),'version',next_version);
end;$$;
revoke all on function public.save_draft_version(uuid,text,text,uuid,timestamptz) from public;
grant execute on function public.save_draft_version(uuid,text,text,uuid,timestamptz) to authenticated;
