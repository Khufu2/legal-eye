-- Include a bounded title-only path so primary Acts/Codes remain discoverable even
-- when the first relevant passage does not repeat the document title. Title matches contribute
-- at most the first two chunks per document and therefore cannot flood the candidate set.
create or replace function public.search_legal_evidence(
  p_query text,
  p_jurisdictions text[] default null,
  p_limit integer default 24
)
returns table(
  chunk_id bigint,legal_document_id uuid,title text,citation text,court text,
  jurisdiction_code text,paragraph_number text,page_number integer,content text,
  rank real,canonical_url text,current_status text,effective_from date,effective_to date
)
language sql stable security definer
set search_path=public,pg_catalog
as $$
with q as (
  select websearch_to_tsquery('simple',left(coalesce(p_query,''),2000)) query
),
eligible as materialized (
  select c.id,c.legal_document_id,c.search_vector,c.reading_order,d.title,d.citation,d.court,
         d.jurisdiction_code,d.canonical_url,d.current_status,d.effective_from,d.effective_to,
         d.document_type,
         (to_tsvector('simple',coalesce(d.title,'')) @@ q.query) title_match
  from public.legal_document_chunks c
  join public.legal_documents d on d.id=c.legal_document_id
  join public.source_registry s on s.id=d.source_id
  cross join q
  where (p_jurisdictions is null or d.jurisdiction_code=any(p_jurisdictions))
    and s.policy_state='approved'
    and s.commercial_display_allowed
    and (
      c.search_vector @@ q.query
      or (
        to_tsvector('simple',coalesce(d.title,'')) @@ q.query
        and coalesce(c.reading_order,0) <= 1
      )
    )
),
candidates as materialized (
  select m.id chunk_id,m.legal_document_id,m.title,m.citation,m.court,m.jurisdiction_code,
         (
           ts_rank_cd(m.search_vector,q.query)
           + case when m.title_match then 0.22 else 0 end
           + case when lower(coalesce(m.document_type,'')) in
               ('act','revised_act','constitution','code','primary_legislation') then 0.16 else 0 end
         )::real rank,
         m.canonical_url,m.current_status,m.effective_from,m.effective_to
  from eligible m cross join q
  order by rank desc,m.id
  limit 400
),
diverse as (
  select *,row_number() over(partition by legal_document_id order by rank desc,chunk_id) passage_order
  from candidates
),
chosen as (
  select * from diverse
  where passage_order<=3
  order by rank desc,chunk_id
  limit greatest(1,least(coalesce(p_limit,24),60))
)
select r.chunk_id,r.legal_document_id,r.title,r.citation,r.court,r.jurisdiction_code,
       c.paragraph_number,c.page_number,coalesce(context.content,c.content),r.rank,
       r.canonical_url,r.current_status,r.effective_from,r.effective_to
from chosen r
join public.legal_document_chunks c on c.id=r.chunk_id
left join lateral (
  select string_agg(
    '[Source PDF page ' || n.page_number || ']' || E'\n' || n.content,
    E'\n\n' order by n.page_number,n.reading_order nulls last,n.id
  ) content
  from (
    select x.*
    from public.legal_document_chunks x
    where x.legal_document_id=c.legal_document_id
      and x.artifact_id is not distinct from c.artifact_id
      and x.page_number between c.page_number-1 and c.page_number+1
    order by x.page_number,x.reading_order nulls last,x.id
    limit 12
  ) n
) context on c.page_number is not null
order by r.rank desc,r.chunk_id;
$$;

revoke all on function public.search_legal_evidence(text,text[],integer) from public;
grant execute on function public.search_legal_evidence(text,text[],integer) to anon,authenticated;
alter function public.search_legal_evidence(text,text[],integer) set statement_timeout='30s';
notify pgrst, 'reload schema';
