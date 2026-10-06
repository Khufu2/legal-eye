begin;
create or replace function public.replace_private_document_text(p_document_id uuid,p_content_hash text,p_chunks jsonb) returns integer
language plpgsql security invoker set search_path='' as $$
declare d public.documents;n integer;begin
select * into d from public.documents where id=p_document_id for update;
if d.id is null or not private.is_org_member(d.organization_id) or (d.uploaded_by<>auth.uid() and private.org_role_for(d.organization_id) not in ('owner','admin','partner')) then raise exception 'Document processing access denied' using errcode='42501';end if;
if jsonb_typeof(p_chunks)<>'array' or jsonb_array_length(p_chunks) not between 1 and 1000 or p_content_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid extracted document';end if;
if exists(select 1 from jsonb_to_recordset(p_chunks) as x(content text) where nullif(btrim(content),'') is null or length(content)>8000) then raise exception 'Invalid source passage';end if;
if exists(select 1 from jsonb_to_recordset(p_chunks) as x(ocr_confidence real) where x.ocr_confidence not between 0 and 100) then raise exception 'Invalid OCR confidence';end if;
delete from public.document_chunks where document_id=d.id;
insert into public.document_chunks(document_id,page_number,content,reading_order,metadata) select d.id,x.page_number,x.content,x.reading_order,jsonb_strip_nulls(jsonb_build_object('engine',case when x.ocr_requires_verification then 'tesseract-ocr' else 'text-extraction' end,'structure_verified',false,'ocr_requires_verification',coalesce(x.ocr_requires_verification,false),'ocr_confidence',x.ocr_confidence)) from jsonb_to_recordset(p_chunks) as x(page_number integer,content text,reading_order integer,ocr_requires_verification boolean,ocr_confidence real);
get diagnostics n=row_count;
update public.documents set status='ready',content_hash=p_content_hash,updated_at=clock_timestamp(),metadata=metadata||jsonb_build_object('parser','text-extraction','parser_state','complete','ocr_verified',false,'ocr_requires_verification',exists(select 1 from jsonb_to_recordset(p_chunks) as c(ocr_requires_verification boolean) where c.ocr_requires_verification),'processed_at',clock_timestamp()) where id=d.id;
return n;end$$;
revoke all on function public.replace_private_document_text(uuid,text,jsonb) from public,anon;grant execute on function public.replace_private_document_text(uuid,text,jsonb) to authenticated;
drop function public.search_private_text(text,uuid,uuid,integer);
create function public.search_private_text(p_query text,p_organization_id uuid,p_matter_id uuid default null,p_limit integer default 12)
returns table(chunk_id bigint,document_id uuid,title text,page_number integer,clause_number text,paragraph_number text,content text,rank real,ocr_requires_verification boolean,ocr_confidence real)
language sql stable security invoker set search_path='' as $$
select c.id,d.id,d.title,c.page_number,c.clause_number,c.paragraph_number,c.content,ts_rank_cd(c.search_vector,websearch_to_tsquery('simple',left(p_query,2000)))::real,coalesce((c.metadata->>'ocr_requires_verification')::boolean,false),(c.metadata->>'ocr_confidence')::real
from public.document_chunks c join public.documents d on d.id=c.document_id
where d.organization_id=p_organization_id and d.status='ready' and (p_matter_id is null or d.matter_id=p_matter_id) and c.search_vector @@ websearch_to_tsquery('simple',left(p_query,2000))
order by 8 desc,c.id limit least(greatest(p_limit,1),60)$$;
revoke all on function public.search_private_text(text,uuid,uuid,integer) from public,anon;
grant execute on function public.search_private_text(text,uuid,uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
