-- The capability gate is used internally by RLS and the ingestion service. It is not a public RPC.
revoke all on function public.source_capability_allowed(uuid,text) from public, anon, authenticated;
grant execute on function public.source_capability_allowed(uuid,text) to service_role;

