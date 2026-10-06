begin;
create table public.citator_entries (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 source_document_id uuid not null references public.documents(id) on delete cascade,
 source_chunk_id bigint not null references public.document_chunks(id) on delete cascade,
 target_citation text not null check(length(btrim(target_citation)) between 3 and 250),
 jurisdiction text not null check(jurisdiction in ('TZ','UK','EU','CA','AU','OTHER')),
 treatment text not null check(treatment in ('followed','applied','distinguished','overruled','reversed','not_followed','questioned')),
 judgment_citation text not null check(length(btrim(judgment_citation)) between 3 and 250),
 court text not null check(length(btrim(court)) between 2 and 250), judgment_date date not null,
 evidence_quote text not null check(length(btrim(evidence_quote)) between 30 and 4000),
 status text not null default 'pending' check(status in ('pending','verified','withdrawn')),
 submitted_by uuid not null default auth.uid() references auth.users(id),
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz, review_note text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.citator_entries enable row level security;
create index citator_org_citation on public.citator_entries(organization_id,lower(target_citation));
create index citator_chunk on public.citator_entries(source_chunk_id);
create index citator_document on public.citator_entries(source_document_id);
create policy citator_read on public.citator_entries for select to authenticated using(private.is_org_member(organization_id) and private.can_view_document(source_document_id));
create policy citator_submit on public.citator_entries for insert to authenticated with check(private.is_org_member(organization_id) and private.org_role_for(organization_id)<>'viewer' and private.can_view_document(source_document_id));
create policy citator_review on public.citator_entries for update to authenticated using(private.is_org_member(organization_id) and private.can_view_document(source_document_id) and (submitted_by=auth.uid() or private.org_role_for(organization_id) in ('owner','admin','partner'))) with check(private.is_org_member(organization_id) and private.can_view_document(source_document_id));
grant select,insert,update on public.citator_entries to authenticated;
create function private.validate_citator_entry() returns trigger language plpgsql security invoker set search_path='' as $$
declare source_org uuid; passage text;begin
 if auth.uid() is null or private.org_role_for(new.organization_id) is null or private.org_role_for(new.organization_id)='viewer' then raise exception 'Citator write access denied' using errcode='42501';end if;
 select d.organization_id,c.content into source_org,passage from public.document_chunks c join public.documents d on d.id=c.document_id where c.id=new.source_chunk_id and d.id=new.source_document_id;
 if source_org is distinct from new.organization_id or passage is null then raise exception 'Judgment passage is unavailable in this firm' using errcode='42501';end if;
 if strpos(lower(regexp_replace(passage,'\s+',' ','g')),lower(regexp_replace(btrim(new.evidence_quote),'\s+',' ','g')))=0 then raise exception 'Quote must match the selected judgment passage';end if;
 if tg_op='INSERT' then new.submitted_by:=auth.uid(); if new.status<>'pending' then raise exception 'Submit evidence before reviewing it';end if;
 else
  if new.organization_id<>old.organization_id or new.submitted_by<>old.submitted_by or new.created_at<>old.created_at then raise exception 'Citator ownership cannot change' using errcode='42501';end if;
  if old.status='verified' and (new.source_document_id<>old.source_document_id or new.source_chunk_id<>old.source_chunk_id or new.target_citation<>old.target_citation or new.jurisdiction<>old.jurisdiction or new.treatment<>old.treatment or new.judgment_citation<>old.judgment_citation or new.court<>old.court or new.judgment_date<>old.judgment_date or new.evidence_quote<>old.evidence_quote) then raise exception 'Withdraw verified evidence and submit a new entry before changing it';end if;
 end if;
 if new.status in ('verified','withdrawn') then
  if private.org_role_for(new.organization_id) not in ('owner','admin','partner') then raise exception 'Only firm reviewers can verify or withdraw treatment' using errcode='42501';end if;
  if length(btrim(coalesce(new.review_note,'')))<20 then raise exception 'Add a review note confirming judgment context and treatment';end if;
  new.reviewed_by:=auth.uid();new.reviewed_at:=clock_timestamp();
 else new.reviewed_by:=null;new.reviewed_at:=null;new.review_note:=null;end if;
 new.updated_at:=clock_timestamp();return new;
end$$;
revoke all on function private.validate_citator_entry() from public,anon,authenticated;
create trigger citator_integrity before insert or update on public.citator_entries for each row execute function private.validate_citator_entry();
create trigger citator_audit after insert or update or delete on public.citator_entries for each row execute function private.audit_workspace_change();
notify pgrst,'reload schema';
commit;
