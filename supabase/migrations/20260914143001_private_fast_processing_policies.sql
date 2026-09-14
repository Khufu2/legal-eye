drop policy if exists document_chunks_insert_fast_path on public.document_chunks;
create policy document_chunks_insert_fast_path
on public.document_chunks
for insert
to authenticated
with check (
  exists (
    select 1
    from public.documents d
    where d.id = document_chunks.document_id
      and private.can_view_document(d.id)
      and (
        d.uploaded_by = (select auth.uid())
        or private.org_role_for(d.organization_id) = any (
          array['owner'::public.org_role,'admin'::public.org_role,'partner'::public.org_role]
        )
      )
  )
);

drop policy if exists document_chunks_delete_fast_path on public.document_chunks;
create policy document_chunks_delete_fast_path
on public.document_chunks
for delete
to authenticated
using (
  exists (
    select 1
    from public.documents d
    where d.id = document_chunks.document_id
      and private.can_view_document(d.id)
      and (
        d.uploaded_by = (select auth.uid())
        or private.org_role_for(d.organization_id) = any (
          array['owner'::public.org_role,'admin'::public.org_role,'partner'::public.org_role]
        )
      )
  )
);
