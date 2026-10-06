-- Disposable fixtures and assertions. The transaction always rolls back.
begin;
insert into auth.users(id,email) values ('77777777-0000-4000-8000-000000000001','citator-owner@example.invalid'),('77777777-0000-4000-8000-000000000002','citator-associate@example.invalid'),('77777777-0000-4000-8000-000000000003','citator-outsider@example.invalid');
insert into public.organizations(id,name,slug) values('77777777-0000-4000-8000-000000000010','Citator test','citator-transaction-test');
insert into public.organization_members(organization_id,user_id,role) values('77777777-0000-4000-8000-000000000010','77777777-0000-4000-8000-000000000001','owner'),('77777777-0000-4000-8000-000000000010','77777777-0000-4000-8000-000000000002','associate');
insert into public.documents(id,organization_id,title,status,uploaded_by) values('77777777-0000-4000-8000-000000000020','77777777-0000-4000-8000-000000000010','Synthetic judgment','ready','77777777-0000-4000-8000-000000000001');
insert into public.document_chunks(document_id,content,page_number) values('77777777-0000-4000-8000-000000000020','This synthetic passage states that the earlier decision was distinguished because the material facts were different.',1);
set local role authenticated;
select set_config('request.jwt.claim.sub','77777777-0000-4000-8000-000000000002',true);
insert into public.citator_entries(id,organization_id,source_document_id,source_chunk_id,target_citation,jurisdiction,treatment,judgment_citation,court,judgment_date,evidence_quote) select '77777777-0000-4000-8000-000000000030','77777777-0000-4000-8000-000000000010','77777777-0000-4000-8000-000000000020',id,'[2000] TEST 1','TZ','distinguished','[2001] TEST 2','Synthetic Court','2001-01-01','the earlier decision was distinguished because the material facts were different.' from public.document_chunks where document_id='77777777-0000-4000-8000-000000000020';
do $$begin
 begin update public.citator_entries set status='verified',review_note='Reviewed the full synthetic judgment and confirmed treatment.' where id='77777777-0000-4000-8000-000000000030';raise exception 'Associate verification was improperly allowed';exception when insufficient_privilege then null;end;
 begin update public.citator_entries set evidence_quote='This invented quotation does not exist in the underlying source judgment.' where id='77777777-0000-4000-8000-000000000030';exception when raise_exception then if sqlerrm not like 'Quote must match%' then raise;end if;end;
 if (select evidence_quote like 'This invented%' from public.citator_entries where id='77777777-0000-4000-8000-000000000030') then raise exception 'Invented quotation accepted';end if;
end$$;
select set_config('request.jwt.claim.sub','77777777-0000-4000-8000-000000000001',true);
update public.citator_entries set status='verified',reviewed_by='77777777-0000-4000-8000-000000000002',review_note='Reviewed the full synthetic judgment and confirmed treatment.' where id='77777777-0000-4000-8000-000000000030';
do $$begin
 if not exists(select 1 from public.citator_entries where id='77777777-0000-4000-8000-000000000030' and status='verified' and reviewed_by=auth.uid() and reviewed_at is not null) then raise exception 'Review identity integrity failed';end if;
 begin update public.citator_entries set treatment='overruled' where id='77777777-0000-4000-8000-000000000030';exception when raise_exception then if sqlerrm not like 'Withdraw verified%' then raise;end if;end;
 if exists(select 1 from public.citator_entries where id='77777777-0000-4000-8000-000000000030' and treatment='overruled') then raise exception 'Verified evidence was rewritten';end if;
end$$;
do $$declare result jsonb;begin result:=public.lookup_firm_citator('77777777-0000-4000-8000-000000000010',array['[2000] TEST 1'],array['TZ']);if jsonb_array_length(result->'entries')<>1 or (result->>'current_good_law_verified')::boolean then raise exception 'Citator lookup scope or uncertainty failed';end if;end$$;
select set_config('request.jwt.claim.sub','77777777-0000-4000-8000-000000000003',true);
do $$begin if exists(select 1 from public.citator_entries where organization_id='77777777-0000-4000-8000-000000000010') then raise exception 'Cross-firm evidence leaked';end if;end$$;
reset role;
select jsonb_build_object('citator_assertions','passed','quote_match',true,'reviewer_role',true,'review_identity',true,'verified_immutability',true,'cross_firm_boundary',true,'rollback',true) as result;
rollback;
