create or replace function public.claim_ingestion_jobs(
  p_worker_id text,
  p_job_types text[],
  p_limit integer default 1,
  p_lease_seconds integer default 300
)
returns setof public.ingestion_jobs
language plpgsql
set search_path to ''
as $function$
begin
  if nullif(trim(p_worker_id), '') is null then
    raise exception 'worker id is required';
  end if;
  if coalesce(array_length(p_job_types, 1), 0) = 0 then
    raise exception 'at least one job type is required';
  end if;

  return query
  with candidates as (
    select j.id
    from public.ingestion_jobs j
    where j.job_type = any(p_job_types)
      and j.cancelled_at is null
      and j.dead_lettered_at is null
      and (
        (j.status = 'queued' and j.available_at <= now())
        or (j.status = 'running' and j.lease_expires_at < now())
      )
    order by coalesce(j.available_at, j.created_at), j.created_at
    limit least(greatest(p_limit, 1), 25)
    for update skip locked
  ), claimed as (
    update public.ingestion_jobs j
    set status = 'running',
        worker_id = p_worker_id,
        lease_token = gen_random_uuid(),
        leased_at = now(),
        lease_expires_at = now() + make_interval(secs => least(greatest(p_lease_seconds, 30), 3600)),
        heartbeat_at = now(),
        started_at = coalesce(j.started_at, now()),
        attempt_count = j.attempt_count + 1,
        error_message = null,
        last_error_code = null
    from candidates c
    where j.id = c.id
    returning j.*
  ), events as (
    insert into public.ingestion_job_events
      (ingestion_job_id, source_id, organization_id, worker_id, event_type, detail)
    select id, source_id, organization_id, p_worker_id, 'claimed',
      jsonb_build_object('attempt', attempt_count, 'lease_expires_at', lease_expires_at)
    from claimed
    returning ingestion_job_id
  )
  select claimed.* from claimed left join events on events.ingestion_job_id = claimed.id;
end;
$function$;
