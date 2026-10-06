begin;
insert into auth.users(id,email) values ('88888888-0000-4000-8000-000000000001','checklist-owner@example.invalid'),('88888888-0000-4000-8000-000000000002','checklist-outsider@example.invalid');
insert into public.organizations(id,name,slug) values ('88888888-0000-4000-8000-000000000010','Checklist test A','checklist-rollback-a'),('88888888-0000-4000-8000-000000000011','Checklist test B','checklist-rollback-b');
insert into public.organization_members(organization_id,user_id,role) values ('88888888-0000-4000-8000-000000000010','88888888-0000-4000-8000-000000000001','owner'),('88888888-0000-4000-8000-000000000011','88888888-0000-4000-8000-000000000002','owner');
insert into public.documents(id,organization_id,title,status,uploaded_by) values ('88888888-0000-4000-8000-000000000020','88888888-0000-4000-8000-000000000010','Own source','ready','88888888-0000-4000-8000-000000000001'),('88888888-0000-4000-8000-000000000021','88888888-0000-4000-8000-000000000011','Other source','ready','88888888-0000-4000-8000-000000000002');
insert into public.checklists(id,organization_id,name,created_by) values ('88888888-0000-4000-8000-000000000030','88888888-0000-4000-8000-000000000010','Source test','88888888-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','88888888-0000-4000-8000-000000000001',true);
insert into public.checklist_items(checklist_id,title,source_document_id) values ('88888888-0000-4000-8000-000000000030','Valid same-firm source','88888888-0000-4000-8000-000000000020');
do $$begin
 if not exists(select 1 from public.checklist_items where checklist_id='88888888-0000-4000-8000-000000000030' and source_document_id='88888888-0000-4000-8000-000000000020') then raise exception 'Valid checklist source was not saved'; end if;
 begin
  insert into public.checklist_items(checklist_id,title,source_document_id) values ('88888888-0000-4000-8000-000000000030','Forbidden other-firm source','88888888-0000-4000-8000-000000000021');
  raise exception 'Cross-firm checklist source was allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
select jsonb_build_object('same_firm_source','passed','cross_firm_source','rejected','rollback',true) as result;
rollback;
