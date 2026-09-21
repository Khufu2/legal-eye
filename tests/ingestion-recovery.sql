-- Rollback-safe ingestion recovery smoke test.
begin;

insert into public.ingestion_jobs(
  id,job_type,status,attempt_count,max_attempts,available_at,started_at,
  leased_at,lease_expires_at,worker_id,lease_token,payload
) values (
  'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff',
  'recovery_sentinel',
  'running',
  1,
  5,
  now()-interval '10 minutes',
  now()-interval '10 minutes',
  now()-interval '10 minutes',
  now()-interval '5 minutes',
  'dead-worker',
  gen_random_uuid(),
  '{"test_only":true}'::jsonb
);

do $$
declare r public.ingestion_jobs%rowtype;
begin
  select * into r
  from public.claim_ingestion_jobs('recovery-worker',array['recovery_sentinel'],1,60)
  limit 1;

  if r.id is null then raise exception 'RECOVERY FAILURE: expired lease was not reclaimed'; end if;
  if r.worker_id <> 'recovery-worker' then raise exception 'RECOVERY FAILURE: worker was not replaced'; end if;
  if r.attempt_count <> 2 then raise exception 'RECOVERY FAILURE: attempt count did not increment'; end if;
  if r.lease_expires_at <= now() then raise exception 'RECOVERY FAILURE: lease was not renewed'; end if;
end $$;

rollback;
