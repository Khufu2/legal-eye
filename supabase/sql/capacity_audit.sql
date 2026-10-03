-- Read-only audit. Run sections separately after Postgres accepts connections.
-- Do not change RLS, vacuum full, delete rows, or export client contents here.
begin read only;
set local statement_timeout = '15s';
select now() observed_at, pg_database_size(current_database()) database_bytes;
select schemaname, relname, pg_total_relation_size(relid) total_bytes,
       pg_table_size(relid) table_including_toast_bytes,
       pg_indexes_size(relid) index_bytes, n_live_tup estimated_rows,
       n_dead_tup estimated_dead_rows, last_autovacuum, last_autoanalyze
from pg_stat_user_tables order by total_bytes desc limit 40;
select schemaname, relname, indexrelname, pg_relation_size(indexrelid) index_bytes,
       idx_scan from pg_stat_user_indexes order by index_bytes desc limit 40;
select b.id, b.public, count(o.id) objects,
       sum(coalesce(nullif(o.metadata->>'size','')::bigint,0)) recorded_bytes
from storage.buckets b left join storage.objects o on o.bucket_id=b.id
group by b.id,b.public order by recorded_bytes desc nulls last;
select n.nspname schema, c.relname table_name, c.relrowsecurity rls_enabled,
       c.relforcerowsecurity rls_forced
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','storage','auth') and c.relkind='r'
order by schema,table_name;
select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies where schemaname in ('public','storage') order by tablename,policyname;
select table_schema,table_name,column_name,data_type,udt_name
from information_schema.columns
where table_schema='public' and (data_type in ('text','jsonb') or udt_name='vector')
order by table_name,column_name;
commit;

-- Optional bounded full scans: run separately; timing out is not a zero count.
begin read only;
set local statement_timeout = '30s';
select count(*) chunks, count(embedding) embedded_chunks,
       sum(pg_column_size(embedding)) embedding_bytes,
       sum(octet_length(content)) utf8_content_bytes
from public.legal_document_chunks;
select count(*) documents, sum(octet_length(raw_text)) raw_text_bytes
from public.legal_documents;
select count(*) ingest_objects, sum(octet_length(raw_content)) raw_content_bytes,
       max(octet_length(raw_content)) max_raw_object_bytes
from public.source_ingest_objects;
select status,count(*) from public.ingestion_jobs group by status;
select source_id,canonical_url,count(*) duplicate_count
from public.legal_documents where canonical_url is not null
group by source_id,canonical_url having count(*)>1 order by duplicate_count desc limit 30;
commit;

-- Storage inventory export for scripts/cloudflare/copy_storage.py.
-- Export JSON array locally with restrictive permissions; never commit it.
-- Inventory is a snapshot: repeat and verify updates before switching reads.
-- select jsonb_agg(jsonb_build_object('id',id,'bucket_id',bucket_id,'name',name,
--   'updated_at',updated_at,'size',metadata->>'size',
--   'mimetype',metadata->>'mimetype')) from storage.objects;
-- Monthly egress, API, Auth and function usage must also be read from dashboard
-- billing/usage; pg_stat_database is not a monthly HTTP-egress meter.
