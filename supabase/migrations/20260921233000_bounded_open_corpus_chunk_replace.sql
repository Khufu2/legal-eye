-- Replace one open-corpus document's derived search passages inside one bounded transaction.
-- PostgREST's authenticator role has an 8s statement timeout; large GIN-index maintenance
-- can exceed that even for valid source refreshes. This RPC gets a function-local budget and
-- is executable only by service_role.
create or replace function public.replace_open_corpus_chunks(
  p_document_id uuid,
  p_chunks jsonb
)
returns integer
language plpgsql
security invoker
set statement_timeout = '75s'
set lock_timeout = '10s'
as $$
declare
  v_count integer;
begin
  if p_document_id is null then
    raise exception 'document id is required';
  end if;
  if p_chunks is null or jsonb_typeof(p_chunks) <> 'array' then
    raise exception 'chunks must be a JSON array';
  end if;

  delete from public.legal_document_chunks
  where legal_document_id = p_document_id;

  insert into public.legal_document_chunks(
    legal_document_id,
    source_node_ref,
    node_type,
    reading_order,
    content,
    token_count,
    language_code,
    extraction_confidence,
    metadata
  )
  select
    p_document_id,
    x.source_node_ref,
    coalesce(x.node_type,'text'),
    x.reading_order,
    x.content,
    x.token_count,
    coalesce(x.language_code,'en'),
    coalesce(x.extraction_confidence,0.97),
    coalesce(x.metadata,'{}'::jsonb)
  from jsonb_to_recordset(p_chunks) as x(
    source_node_ref text,
    node_type text,
    reading_order integer,
    content text,
    token_count integer,
    language_code text,
    extraction_confidence numeric,
    metadata jsonb
  )
  where nullif(btrim(x.content),'') is not null
  order by x.reading_order;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.replace_open_corpus_chunks(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.replace_open_corpus_chunks(uuid,jsonb) to service_role;
