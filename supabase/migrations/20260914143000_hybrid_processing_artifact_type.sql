alter table public.document_ingestion_artifacts
  drop constraint if exists document_ingestion_artifacts_artifact_type_check;

alter table public.document_ingestion_artifacts
  add constraint document_ingestion_artifacts_artifact_type_check
  check (
    artifact_type = any (
      array[
        'docling_json'::text,
        'lightweight_json'::text,
        'derived_markdown'::text,
        'ocr_layer'::text,
        'page_image'::text,
        'source_manifest'::text
      ]
    )
  );

alter table public.legal_document_artifacts
  drop constraint if exists legal_document_artifacts_artifact_type_check;

alter table public.legal_document_artifacts
  add constraint legal_document_artifacts_artifact_type_check
  check (
    artifact_type = any (
      array[
        'docling_json'::text,
        'lightweight_json'::text,
        'derived_markdown'::text,
        'ocr_layer'::text,
        'source_manifest'::text
      ]
    )
  );
