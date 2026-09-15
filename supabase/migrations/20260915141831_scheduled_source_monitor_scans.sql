alter table public.monitors add column if not exists last_scanned_at timestamptz;
create or replace function public.scan_legal_monitor(p_monitor_id uuid) returns integer
language plpgsql security invoker set search_path=public,pg_catalog as $$
declare m public.monitors; found_count integer;
begin
 select * into m from public.monitors where id=p_monitor_id and status='active' for update;
 if not found then raise exception 'Active monitor unavailable'; end if;
 insert into public.monitor_events(monitor_id,source_registry_id,title,source_url,published_at,change_kind,summary,fingerprint,status,evidence)
 select m.id,d.source_id,d.title,d.canonical_url,d.published_at,'source_update',coalesce(d.citation,'Source catalogue update; legal impact requires review.'),m.id::text||':'||d.id::text||':'||coalesce(d.content_hash,''),'new',jsonb_build_object('legal_document_id',d.id,'content_hash',d.content_hash,'source_updated_at',d.updated_at)
 from public.legal_documents d join public.source_registry s on s.id=d.source_id
 where s.policy_state='approved' and s.commercial_display_allowed
 and (cardinality(m.jurisdiction_codes)=0 or d.jurisdiction_code=any(m.jurisdiction_codes))
 and (m.last_scanned_at is null or d.updated_at>=m.last_scanned_at)
 and (nullif(trim(m.topic_query),'') is null or to_tsvector('english',d.title||' '||coalesce(d.citation,'')) @@ websearch_to_tsquery('english',m.topic_query))
 and not exists(select 1 from public.monitor_events e where e.monitor_id=m.id and e.fingerprint=m.id::text||':'||d.id::text||':'||coalesce(d.content_hash,''))
 order by d.updated_at asc limit 100 on conflict(monitor_id,fingerprint) do nothing;
 get diagnostics found_count=row_count;
 if found_count<100 then update public.monitors set last_scanned_at=now() where id=m.id;end if;
 return found_count;
end;$$;
revoke all on function public.scan_legal_monitor(uuid) from public;
grant execute on function public.scan_legal_monitor(uuid) to authenticated;
create or replace function private.scan_active_legal_monitors() returns void
language plpgsql security definer set search_path=public,pg_catalog as $$
declare monitor_id uuid;
begin
 for monitor_id in select id from public.monitors where status='active' loop
  perform public.scan_legal_monitor(monitor_id);
 end loop;
end;$$;
revoke all on function private.scan_active_legal_monitors() from public,anon,authenticated;
create extension if not exists pg_cron;
select cron.schedule('legal-eye-source-monitors','*/15 * * * *','select private.scan_active_legal_monitors()');
