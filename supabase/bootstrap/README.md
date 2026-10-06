# Rebuild Locke on an empty Supabase project

1. Apply `001_core.sql`, then `002_core_functions.sql`.
2. Apply every file in `../migrations` in filename order.
3. Apply `003_integrity_and_processing.sql`, then subsequent numbered bootstrap files.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the app hosting environments and redeploy.
5. Configure Auth site URL/redirects and a custom SMTP service. Enable email verification; never disable verification to bypass delivery problems.
6. Keep `LEGAL_CORPUS_URL` and `LEGAL_CORPUS_SEARCH_TOKEN` server-only. Public source files and passages remain in Cloudflare. Do not restart the former bulk Supabase corpus writers.
7. Verify onboarding, tenant isolation, storage permissions, source extraction, versioning, AI workflows and portal revocation with disposable acceptance accounts.

For catalogue monitoring, run `scripts/cloudflare/catalog_metadata.py` against the verified corpus checkpoint and apply the emitted metadata-only batches. The 6 October deployment mirrors 5,561 Tanzanian records. `005_public_corpus_boundary.sql` disables historical workspace corpus writers. Public legal metadata may be mirrored for monitoring. Public document bodies, chunks and vector embeddings must remain outside the free-plan database. The app processes text-based PDF, DOCX, TXT and Markdown privately using the caller's JWT and an atomic invoker RPC. Apply `006_private_ocr_metadata.sql` after the corpus boundary migration. English scanned PDFs support bounded local OCR with source-verification flags; the expired Railway Docling service is not required or represented as running.

The historical migrations are retained for reproducibility. Their nominal timestamps precede the newly reconstructed foundation; always use the order above on a fresh project. No live user data or credentials are included in these files.

Apply `007_firm_citator.sql` and `008_citator_lookup.sql` for the judgment-evidence workflow and permission-scoped research lookup. `tests/citator-rls.sql` runs disposable transactional assertions and rolls back every fixture. This is a firm-reviewed evidence system, not a complete external good-law citator.
