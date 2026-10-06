begin;
create function public.lookup_firm_citator(p_organization_id uuid,p_citations text[],p_jurisdictions text[]) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;begin
 if not private.is_org_member(p_organization_id) then raise exception 'Firm access denied' using errcode='42501';end if;
 if coalesce(array_length(p_citations,1),0)>80 or exists(select 1 from unnest(p_citations) c where length(c)>250) then raise exception 'Too many citation candidates';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'target_citation',e.target_citation,'jurisdiction',e.jurisdiction,'treatment',e.treatment,'judgment_citation',e.judgment_citation,'court',e.court,'judgment_date',e.judgment_date,'evidence_quote',e.evidence_quote,'source_document_id',e.source_document_id,'source_chunk_id',e.source_chunk_id,'page_number',c.page_number,'reviewed_at',e.reviewed_at,'review_note',e.review_note,'verification_scope','firm-reviewed judgment evidence')),'[]'::jsonb) into result from public.citator_entries e join public.document_chunks c on c.id=e.source_chunk_id where e.organization_id=p_organization_id and e.status='verified' and e.jurisdiction=any(p_jurisdictions) and regexp_replace(lower(e.target_citation),'\s+','','g') in (select regexp_replace(lower(x),'\s+','','g') from unnest(p_citations) x);
 return jsonb_build_object('entries',result,'coverage','accessible firm-reviewed evidence only','absence_means','unknown','current_good_law_verified',false);
end$$;
revoke all on function public.lookup_firm_citator(uuid,text[],text[]) from public,anon;
grant execute on function public.lookup_firm_citator(uuid,text[],text[]) to authenticated;
notify pgrst,'reload schema';
commit;
