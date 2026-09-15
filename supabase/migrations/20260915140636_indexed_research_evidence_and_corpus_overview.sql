-- Indexed, source-governed retrieval. SECURITY INVOKER preserves row policies.
create or replace function public.search_legal_evidence(p_query text, p_jurisdictions text[] default null, p_limit integer default 24)
returns table(chunk_id bigint,legal_document_id uuid,title text,citation text,court text,jurisdiction_code text,paragraph_number text,page_number integer,content text,rank real,canonical_url text,current_status text,effective_from date,effective_to date)
language sql stable security invoker set search_path=public,pg_catalog as $$
with q as (select websearch_to_tsquery('simple',left(coalesce(p_query,''),2000)) query),
candidates as materialized (
 select c.id chunk_id,d.id legal_document_id,d.title,d.citation,d.court,d.jurisdiction_code,c.paragraph_number,c.page_number,c.content,
 ts_rank_cd(c.search_vector,q.query)::real rank,d.canonical_url,d.current_status,d.effective_from,d.effective_to
 from public.legal_document_chunks c join public.legal_documents d on d.id=c.legal_document_id
 join public.source_registry s on s.id=d.source_id cross join q
 where c.search_vector @@ q.query and (p_jurisdictions is null or d.jurisdiction_code=any(p_jurisdictions))
 and s.policy_state='approved' and s.commercial_display_allowed
 order by rank desc,c.id limit 400
), diverse as (select *,row_number() over(partition by legal_document_id order by rank desc,chunk_id) passage_order from candidates)
select chunk_id,legal_document_id,title,citation,court,jurisdiction_code,paragraph_number,page_number,content,rank,canonical_url,current_status,effective_from,effective_to
from diverse where passage_order<=3 order by rank desc,chunk_id limit greatest(1,least(coalesce(p_limit,24),60));
$$;
revoke all on function public.search_legal_evidence(text,text[],integer) from public;
grant execute on function public.search_legal_evidence(text,text[],integer) to anon,authenticated;

create or replace function public.legal_corpus_overview() returns jsonb
language sql stable security invoker set search_path=public,pg_catalog as $$
with approved as materialized(select d.id,d.jurisdiction_code,d.source_id from public.legal_documents d join public.source_registry s on s.id=d.source_id where s.policy_state='approved' and s.commercial_display_allowed),
counts as(select jurisdiction_code,count(*) n from approved group by jurisdiction_code),
passages as(select count(*) n,count(distinct c.legal_document_id) searchable_documents from public.legal_document_chunks c join approved a on a.id=c.legal_document_id)
select jsonb_build_object('sources',(select count(distinct source_id) from approved),'documents',(select count(*) from approved),'jurisdictions',(select jsonb_object_agg(jurisdiction_code,n) from counts),'chunks',passages.n,'searchable_documents',passages.searchable_documents,'as_of',now()) from passages;
$$;
revoke all on function public.legal_corpus_overview() from public;
grant execute on function public.legal_corpus_overview() to anon,authenticated;
