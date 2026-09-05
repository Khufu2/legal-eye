-- The product owner confirmed direct permission to ingest the OAG catalogue on
-- 2026-09-05. Keep redistribution disabled and retain official attribution.
update public.source_registry
set
  policy_state = 'approved',
  base_url = 'https://oagmis.oag.go.tz',
  adapter_key = 'tz_oag',
  content_types = array[
    'acts',
    'revised_acts',
    'subsidiary_legislation',
    'annual_supplements',
    'bills',
    'guidelines',
    'parliamentary_resolutions',
    'international_instruments'
  ],
  discovery_allowed = true,
  individual_retrieval_allowed = true,
  cache_allowed = true,
  permanent_storage_allowed = true,
  commercial_display_allowed = true,
  bulk_ingestion_allowed = true,
  embedding_allowed = true,
  computational_analysis_allowed = true,
  redistribution_allowed = false,
  attribution_required = true,
  attribution_text = 'Source: Office of the Attorney General, United Republic of Tanzania.',
  license_name = 'Direct OAG permission asserted by Legal Eye product owner on 2026-09-05',
  sync_enabled = true,
  refresh_interval = interval '24 hours',
  last_legal_review = now(),
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'approval_basis', 'Direct permission asserted by authenticated Legal Eye product owner',
    'approval_recorded_at', now(),
    'approval_scope', array[
      'bulk_ingestion',
      'permanent_storage',
      'commercial_display',
      'embedding',
      'computational_analysis'
    ],
    'redistribution', false
  )
where name = 'Tanzania Office of the Attorney General';
