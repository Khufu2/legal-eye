-- Verify publication integrity even when the publisher can read both firms.
-- All synthetic accounts and work product are rolled back.
begin;
set local statement_timeout='15s';
select set_config('locke.pub_user',gen_random_uuid()::text,true);
select set_config('locke.pub_org',gen_random_uuid()::text,true);
select set_config('locke.pub_foreign_org',gen_random_uuid()::text,true);
select set_config('locke.pub_portal',gen_random_uuid()::text,true);
select set_config('locke.pub_draft',gen_random_uuid()::text,true);
select set_config('locke.pub_foreign_draft',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
 (current_setting('locke.pub_user')::uuid,current_setting('locke.pub_user')||'@example.invalid',now(),false);
insert into public.organizations(id,name,slug) values
 (current_setting('locke.pub_org')::uuid,'Publication test firm',current_setting('locke.pub_org')),
 (current_setting('locke.pub_foreign_org')::uuid,'Foreign publication test firm',current_setting('locke.pub_foreign_org'));
insert into public.organization_members(organization_id,user_id,role,is_active) values
 (current_setting('locke.pub_org')::uuid,current_setting('locke.pub_user')::uuid,'owner',true),
 (current_setting('locke.pub_foreign_org')::uuid,current_setting('locke.pub_user')::uuid,'owner',true);
insert into public.client_portals(id,organization_id,name,slug,status,created_by) values
 (current_setting('locke.pub_portal')::uuid,current_setting('locke.pub_org')::uuid,'Publication test',current_setting('locke.pub_portal'),'active',current_setting('locke.pub_user')::uuid);
insert into public.drafts(id,organization_id,title,document_type,created_by,content) values
 (current_setting('locke.pub_draft')::uuid,current_setting('locke.pub_org')::uuid,'Own synthetic draft','memorandum',current_setting('locke.pub_user')::uuid,'{"text":"Synthetic own firm text"}'),
 (current_setting('locke.pub_foreign_draft')::uuid,current_setting('locke.pub_foreign_org')::uuid,'Foreign synthetic draft','memorandum',current_setting('locke.pub_user')::uuid,'{"text":"Synthetic other firm text"}');
select set_config('request.jwt.claims',json_build_object('sub',current_setting('locke.pub_user'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.portal_resources(portal_id,resource_type,resource_id,created_by) values
 (current_setting('locke.pub_portal')::uuid,'draft',current_setting('locke.pub_draft')::uuid,auth.uid());
do $$ begin
 if not exists(select 1 from public.drafts where id=current_setting('locke.pub_foreign_draft')::uuid) then
  raise exception 'INVALID TEST: foreign draft is not readable by the publisher';
 end if;
 begin
  insert into public.portal_resources(portal_id,resource_type,resource_id,created_by) values
   (current_setting('locke.pub_portal')::uuid,'draft',current_setting('locke.pub_foreign_draft')::uuid,auth.uid());
  raise exception 'FAIL: readable foreign-firm draft can be published';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.portal_resources(portal_id,resource_type,resource_id,created_by) values
   (current_setting('locke.pub_portal')::uuid,'draft',gen_random_uuid(),auth.uid());
  raise exception 'FAIL: nonexistent draft can be published';
 exception when insufficient_privilege then null; end;
 begin
  update public.portal_resources set resource_id=current_setting('locke.pub_foreign_draft')::uuid
   where portal_id=current_setting('locke.pub_portal')::uuid;
  raise exception 'FAIL: existing publication can be reassigned to a foreign draft';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: same-firm publication; foreign, nonexistent and reassigned resources denied; fixtures rolled back' as result;
