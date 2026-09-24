begin;
select set_config('locke.test_owner',gen_random_uuid()::text,true);
select set_config('locke.test_invited',gen_random_uuid()::text,true);
select set_config('locke.test_foreign',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at,is_anonymous)
select id::uuid,id||'@example.invalid',now(),false from (values
  (current_setting('locke.test_owner')),(current_setting('locke.test_invited')),(current_setting('locke.test_foreign'))
) fixture(id);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('locke.test_owner'),'role','authenticated')::text,true);
set local role authenticated;
select set_config('locke.test_org',public.create_organization_with_owner('Invitation sentinel','invite-test-'||gen_random_uuid()::text)::text,true);
select set_config('locke.test_token',public.create_workspace_invite(current_setting('locke.test_org')::uuid,current_setting('locke.test_invited')||'@example.invalid','associate')::text,true);

select set_config('request.jwt.claims',json_build_object('sub',current_setting('locke.test_foreign'),'role','authenticated')::text,true);
do $$ begin
  begin
    perform public.accept_workspace_invite(current_setting('locke.test_token')::uuid);
    raise exception 'FAIL: wrong email accepted invite';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claims',json_build_object('sub',current_setting('locke.test_invited'),'role','authenticated')::text,true);
do $$ declare v_org uuid; begin
  v_org:=public.accept_workspace_invite(current_setting('locke.test_token')::uuid);
  if v_org<>current_setting('locke.test_org')::uuid or public.accept_workspace_invite(current_setting('locke.test_token')::uuid)<>v_org then raise exception 'FAIL: acceptance or retry'; end if;
  if not exists(select 1 from public.organization_members where organization_id=v_org and user_id=auth.uid() and role='associate' and is_active) then raise exception 'FAIL: invited role missing'; end if;
  begin
    perform public.create_workspace_invite(v_org,'other@example.invalid','admin');
    raise exception 'FAIL: associate can invite an admin';
  exception when insufficient_privilege then null; end;
  begin
    update public.organization_members set role='owner' where organization_id=v_org and user_id=auth.uid();
    raise exception 'FAIL: direct role escalation allowed';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claims',json_build_object('sub',current_setting('locke.test_owner'),'role','authenticated')::text,true);
do $$ declare v_org uuid:=current_setting('locke.test_org')::uuid; v_id uuid; begin
  begin
    perform public.set_workspace_member_access(v_org,auth.uid(),'associate',true);
    raise exception 'FAIL: last owner demotion allowed';
  exception when check_violation then null; end;
  perform set_config('locke.test_revoked_token',public.create_workspace_invite(v_org,current_setting('locke.test_foreign')||'@example.invalid','viewer')::text,true);
  select id into v_id from public.workspace_invites where organization_id=v_org and email=current_setting('locke.test_foreign')||'@example.invalid';
  perform public.revoke_workspace_invite(v_id);
  perform public.set_workspace_member_access(v_org,current_setting('locke.test_invited')::uuid,'associate',false);
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('locke.test_foreign'),'role','authenticated')::text,true);
do $$ begin
  begin
    perform public.accept_workspace_invite(current_setting('locke.test_revoked_token')::uuid);
    raise exception 'FAIL: revoked invitation accepted';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('locke.test_invited'),'role','authenticated')::text,true);
do $$ begin
  if exists(select 1 from public.organizations where id=current_setting('locke.test_org')::uuid) then raise exception 'FAIL: suspended user retains firm visibility'; end if;
  begin
    perform public.accept_workspace_invite(current_setting('locke.test_token')::uuid);
    raise exception 'FAIL: old invitation reactivated suspended member';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: email-bound invitations, retry, role escalation blocked, last owner retained, revocation, suspended access; all fixtures rolled back' as result;
