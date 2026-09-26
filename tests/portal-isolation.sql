begin;
set local statement_timeout='15s';
select set_config('locke.portal_test_user',gen_random_uuid()::text,true);
select set_config('locke.portal_test_org',gen_random_uuid()::text,true);
select set_config('locke.portal_test_portal',gen_random_uuid()::text,true);
select set_config('locke.portal_test_draft',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
(current_setting('locke.portal_test_user')::uuid,current_setting('locke.portal_test_user')||'@example.invalid',now(),false);
insert into public.organizations(id,name,slug) values(current_setting('locke.portal_test_org')::uuid,'Portal test firm',current_setting('locke.portal_test_org'));
insert into public.client_portals(id,organization_id,name,slug,status,created_by) values
(current_setting('locke.portal_test_portal')::uuid,current_setting('locke.portal_test_org')::uuid,'Portal test',current_setting('locke.portal_test_portal'),'active',current_setting('locke.portal_test_user')::uuid);
insert into public.portal_members(portal_id,user_id,role) values(current_setting('locke.portal_test_portal')::uuid,current_setting('locke.portal_test_user')::uuid,'guest');
insert into public.drafts(id,organization_id,title,created_by,content) values(current_setting('locke.portal_test_draft')::uuid,current_setting('locke.portal_test_org')::uuid,'Published sentinel',current_setting('locke.portal_test_user')::uuid,'{"text":"Published text only"}');
insert into public.portal_resources(portal_id,resource_type,resource_id,created_by) values(current_setting('locke.portal_test_portal')::uuid,'draft',current_setting('locke.portal_test_draft')::uuid,current_setting('locke.portal_test_user')::uuid);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('locke.portal_test_user'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.drafts where id=current_setting('locke.portal_test_draft')::uuid) then raise exception 'FAIL: published draft unavailable'; end if;
 begin
  insert into public.portal_resources(portal_id,resource_type,resource_id,created_by) values(current_setting('locke.portal_test_portal')::uuid,'draft',gen_random_uuid(),auth.uid());
  raise exception 'FAIL: guest can publish';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.client_portals set status='archived' where id=current_setting('locke.portal_test_portal')::uuid;
set local role authenticated;
do $$ begin
 if private.has_portal_access(current_setting('locke.portal_test_portal')::uuid) then raise exception 'FAIL: archived portal still accessible'; end if;
 if exists(select 1 from public.drafts where id=current_setting('locke.portal_test_draft')::uuid) then raise exception 'FAIL: archived published draft visible'; end if;
 if exists(select 1 from public.portal_resources where portal_id=current_setting('locke.portal_test_portal')::uuid) then raise exception 'FAIL: archived resources visible'; end if;
end $$;
reset role;
rollback;
select 'PASS: published draft access, guest publication denial, archive revocation; all synthetic fixtures rolled back' as result;
