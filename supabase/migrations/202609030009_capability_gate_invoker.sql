-- RLS policies call this function as the requesting role. The source policy fields are already
-- readable, so elevated privileges are unnecessary and would make an exposed RPC misleading.
create or replace function public.source_capability_allowed(p_source_id uuid, p_capability text)
returns boolean
language sql stable security invoker
set search_path='public','pg_catalog'
as $$
  select case p_capability
    when 'discover' then s.discovery_allowed
    when 'individual_fetch' then s.individual_retrieval_allowed
    when 'cache' then s.cache_allowed
    when 'permanent_store' then s.permanent_storage_allowed
    when 'commercial_display' then s.commercial_display_allowed
    when 'bulk_ingest' then s.bulk_ingestion_allowed
    when 'embed' then s.embedding_allowed
    when 'compute' then s.computational_analysis_allowed
    when 'redistribute' then s.redistribution_allowed
    else false end
  from public.source_registry s
  where s.id=p_source_id and s.policy_state='approved';
$$;

revoke all on function public.source_capability_allowed(uuid,text) from public, anon;
grant execute on function public.source_capability_allowed(uuid,text) to authenticated, service_role;

