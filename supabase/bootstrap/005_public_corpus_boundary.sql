begin;
-- Public bodies and passages are served from Cloudflare, not the workspace DB.
update public.source_registry set sync_enabled=false;
alter policy legal_documents_public_read on public.legal_documents to anon,authenticated;
notify pgrst,'reload schema';
commit;
