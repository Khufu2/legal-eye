revoke execute on function public.authority_status(uuid) from public;
revoke execute on function public.legal_corpus_overview() from public;
revoke execute on function public.legal_eye_audit_trigger() from public;
revoke execute on function public.redeem_portal_invite(uuid) from public;
revoke execute on function public.redeem_portal_invite_by_slug(text) from public;
revoke execute on function public.refresh_authority_index() from public;
revoke execute on function public.search_legal_evidence(text,text[],integer) from public;

grant execute on function public.authority_status(uuid) to authenticated, service_role;
grant execute on function public.legal_corpus_overview() to authenticated, service_role;
grant execute on function public.redeem_portal_invite(uuid) to authenticated, service_role;
grant execute on function public.redeem_portal_invite_by_slug(text) to authenticated, service_role;
grant execute on function public.search_legal_evidence(text,text[],integer) to authenticated, service_role;
grant execute on function public.legal_eye_audit_trigger() to service_role;
grant execute on function public.refresh_authority_index() to service_role;
