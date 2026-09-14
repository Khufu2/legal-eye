with latest as (
  select distinct on (source_id,external_id)
    source_id,
    external_id,
    raw_content::jsonb as raw
  from public.source_ingest_objects
  where raw_content is not null
    and left(ltrim(raw_content),1)='{'
  order by source_id,external_id,retrieved_at desc
), paths as (
  select
    ld.id,
    regexp_replace(ltrim(kv.value,'/'), '/+', '/', 'g') as storage_path
  from public.legal_documents ld
  join latest l
    on l.source_id=ld.source_id
   and l.external_id=ld.canonical_source_id
  join public.source_registry sr
    on sr.id=ld.source_id
   and sr.adapter_key='tz_oag'
  cross join lateral (
    select e.value
    from jsonb_each_text(l.raw) e(key,value)
    where e.value is not null
      and btrim(e.value)<>''
      and lower(e.key) ~ '(doc|file).*path'
      and e.value not like '%..%'
    order by
      case
        when lower(e.key)='documentpath' then 0
        when lower(e.key)='actdocpath' then 1
        when lower(e.key)='billdocpath' then 2
        else 9
      end,
      e.key
    limit 1
  ) kv
)
update public.legal_documents ld
set metadata = coalesce(ld.metadata,'{}'::jsonb) || jsonb_build_object(
  'official_storage_host','oagmis.oag.go.tz',
  'official_storage_path',paths.storage_path
)
from paths
where ld.id=paths.id;
