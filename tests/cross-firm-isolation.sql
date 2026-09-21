-- Rollback-safe cross-firm isolation smoke test.
-- Requires at least one active organization member. It creates a temporary foreign
-- organization and proves that the existing member cannot see its document or agent run.
begin;

do $$
declare
  v_user uuid;
begin
  select user_id into v_user
  from public.organization_members
  where is_active is true
  order by created_at
  limit 1;

  if v_user is null then
    raise exception 'ISOLATION TEST INVALID: no active organization member exists';
  end if;

  perform set_config(
    'locke.test_user_id',
    v_user::text,
    true
  );
end $$;

insert into public.organizations(id,name,slug,jurisdiction_codes)
values ('11111111-2222-4333-8444-555555555555','RLS Isolation Sentinel','rls-isolation-sentinel',array['TZ']);

insert into public.documents(id,organization_id,title,file_name,status,uploaded_by,metadata)
values (
 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
 '11111111-2222-4333-8444-555555555555',
 'Cross-firm isolation sentinel',
 'sentinel.txt',
 'ready',
 current_setting('locke.test_user_id')::uuid,
 '{"test_only":true}'::jsonb
);

insert into public.agent_runs(id,organization_id,created_by,objective,status,plan,result)
values (
 'dddddddd-eeee-4fff-8000-111111111111',
 '11111111-2222-4333-8444-555555555555',
 current_setting('locke.test_user_id')::uuid,
 'Foreign firm sentinel agent run',
 'needs_review',
 '[]'::jsonb,
 '{"test_only":true}'::jsonb
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',current_setting('locke.test_user_id'),
    'role','authenticated'
  )::text,
  true
);

set local role authenticated;

do $$
declare
  leaked_docs int;
  leaked_runs int;
begin
  select count(*) into leaked_docs
  from public.documents
  where id='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

  select count(*) into leaked_runs
  from public.agent_runs
  where id='dddddddd-eeee-4fff-8000-111111111111';

  if leaked_docs <> 0 then
    raise exception 'RLS LEAK: foreign-organization document visible';
  end if;
  if leaked_runs <> 0 then
    raise exception 'RLS LEAK: foreign-organization agent run visible';
  end if;
end $$;

rollback;
