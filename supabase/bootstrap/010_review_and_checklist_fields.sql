alter table public.review_table_rows add column if not exists reviewed_by uuid references auth.users(id) on delete set null, add column if not exists reviewed_at timestamptz;
alter table public.checklist_items add column if not exists source_document_id uuid references public.documents(id) on delete set null;
create or replace function private.validate_checklist_source() returns trigger language plpgsql security invoker set search_path='' as $$
declare checklist_org uuid; source_org uuid;
begin
 if new.source_document_id is not null then
  select organization_id into checklist_org from public.checklists where id=new.checklist_id;
  select organization_id into source_org from public.documents where id=new.source_document_id;
  if checklist_org is null or checklist_org is distinct from source_org then raise exception 'Checklist source is unavailable or belongs to another workspace' using errcode='42501'; end if;
 end if;
 return new;
end $$;
revoke all on function private.validate_checklist_source() from public,anon,authenticated;
drop trigger if exists checklist_source_link_check on public.checklist_items;
create trigger checklist_source_link_check before insert or update on public.checklist_items for each row execute function private.validate_checklist_source();
notify pgrst,'reload schema';
