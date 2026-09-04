grant select on public.source_registry,public.legal_documents to anon;

create policy source_registry_public_read on public.source_registry
  for select to anon using (true);

create policy legal_documents_public_read on public.legal_documents
  for select to anon using (
    source_id is not null
    and exists (
      select 1 from public.source_registry s
      where s.id=legal_documents.source_id
        and s.policy_state='approved'
        and s.commercial_display_allowed
    )
  );
