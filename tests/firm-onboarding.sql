-- Synthetic identities and organizations exist only inside this transaction.
-- No email is sent and no existing account is changed.
begin;
select set_config('locke.test_verified', gen_random_uuid()::text, true);
select set_config('locke.test_unverified', gen_random_uuid()::text, true);
insert into auth.users(id,email,email_confirmed_at,is_anonymous)
values (current_setting('locke.test_verified')::uuid,current_setting('locke.test_verified')||'@example.invalid',now(),false),
       (current_setting('locke.test_unverified')::uuid,current_setting('locke.test_unverified')||'@example.invalid',null,false);

select set_config('request.jwt.claims',json_build_object('sub',current_setting('locke.test_unverified'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
  begin
    perform public.create_organization_with_owner('Unverified sentinel','onboarding-unverified-sentinel');
    raise exception 'FAIL: unverified user created a firm';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claims',json_build_object('sub',current_setting('locke.test_verified'),'role','authenticated')::text,true);
do $$ declare v_org uuid; v_retry uuid; v_slug text := 'test-'||gen_random_uuid()::text; begin
  v_org := public.create_organization_with_owner('Synthetic onboarding sentinel',v_slug);
  v_retry := public.create_organization_with_owner('Synthetic onboarding sentinel',v_slug);
  if v_org <> v_retry then raise exception 'FAIL: retry created a duplicate firm'; end if;
  if not exists (select 1 from public.organizations where id=v_org) then
    raise exception 'FAIL: new firm is not visible to owner';
  end if;
  if not exists (select 1 from public.organization_members where organization_id=v_org and user_id=auth.uid() and role='owner' and is_active) then
    raise exception 'FAIL: active owner membership is missing';
  end if;
  perform set_config('locke.test_org',v_org::text,true);
end $$;

select set_config('request.jwt.claims',json_build_object('sub',current_setting('locke.test_unverified'),'role','authenticated')::text,true);
do $$ begin
  if exists (select 1 from public.organizations where id=current_setting('locke.test_org')::uuid)
    or exists (select 1 from public.organization_members where organization_id=current_setting('locke.test_org')::uuid) then
    raise exception 'FAIL: foreign firm visible';
  end if;
  begin
    insert into public.organization_members(organization_id,user_id,role)
    values(current_setting('locke.test_org')::uuid,auth.uid(),'owner');
    raise exception 'FAIL: foreign user joined as owner';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon','public.create_organization_with_owner(text,text)','execute') then
    raise exception 'FAIL: anonymous role can execute provisioning';
  end if;
end $$;
rollback;
select 'PASS: verified provisioning, idempotent retry, unverified rejection, cross-firm isolation, anonymous ACL; all fixtures rolled back' as result;
