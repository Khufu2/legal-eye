-- Harden advanced-workspace policies and SECURITY DEFINER RPC exposure.
alter policy monitors_access on public.monitors to authenticated;
alter policy workflows_access on public.workflows to authenticated;
alter policy workflow_runs_access on public.workflow_runs to authenticated;

revoke execute on function public.authority_status(uuid) from anon;
revoke execute on function public.legal_corpus_overview() from anon;
revoke execute on function public.legal_eye_audit_trigger() from anon, authenticated;
revoke execute on function public.redeem_portal_invite(uuid) from anon;
revoke execute on function public.redeem_portal_invite_by_slug(text) from anon;
revoke execute on function public.refresh_authority_index() from anon, authenticated;
revoke execute on function public.search_legal_evidence(text,text[],integer) from anon;

grant execute on function public.legal_eye_audit_trigger() to service_role;
grant execute on function public.refresh_authority_index() to service_role;
