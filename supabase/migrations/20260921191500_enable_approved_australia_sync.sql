update public.source_registry
set sync_enabled = true
where adapter_key = 'australia_register'
  and policy_state = 'approved'
  and discovery_allowed is true
  and individual_retrieval_allowed is true
  and bulk_ingestion_allowed is true
  and permanent_storage_allowed is true
  and computational_analysis_allowed is true
  and commercial_display_allowed is true;
