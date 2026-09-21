-- Cross-firm RLS smoke test. Run as a privileged test operator; transaction always rolls back.
begin;

insert into public.organizations(id,name,slug,jurisdiction_codes)
values ('11111111-2222-4333-8444-555555555555','RLS Isolation Sentinel','rls-isolation-sentinel',array['TZ']);

insert into public.documents(id,organization_id,title,file_name,status,uploaded_by,metadata)
select
 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
 '11111111-2222-4333-8444-555555555555',
 'Cross-firm isolation sentinel',
 'sentinel.txt',
 'ready',
 om.user_id,
 '{"test_only":true}'::jsonb
from public.organization_members om
where om.is_active is true
limit 1;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',(select user_id::text from public.organization_members where is_active is true limit 1),
    'role','authenticated'
  )::text,
  true
);

do $$
declare leaked int;
begin
  select count(*) into leaked
  from public.documents
  where id='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  if leaked <> 0 then
    raise exception 'RLS LEAK: foreign-organization document visible';
  end if;
end $$;

rollback;
