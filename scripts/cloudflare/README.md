# Copy-only R2 migration runner

This runner does not integrate R2 into LOCKE or switch production traffic. It
performs only copy and complete-byte verification after provider access and a
reviewed inventory are available. See the October 1 capacity audit for blockers.

Create a dedicated **private** R2 Standard bucket. Disable its public domain and
public custom domains; use a bucket-scoped operator credential. Obtain a fresh
`storage.objects` JSON array using the query in `supabase/sql/capacity_audit.sql`.
Keep inventory and journals in ignored `work/`, never in git. The inventory must
contain bucket_id/name; include id, size, mimetype and updated_at to retain
identity, MIME type and a useful snapshot for reconciliation.

Install `requirements.txt` in an operator virtual environment. Supply the six
environment variables listed in the audit through a secure environment, not
shell history or frontend configuration. Validate without network access first:

```sh
python scripts/cloudflare/copy_storage.py work/inventory.json --journal work/r2-verified.jsonl
```

After destination privacy and expected copy/verification operation costs are
reviewed, add `--execute`. The runner rejects redirects and foreign/non-HTTPS
Supabase URLs, bounds every object to 256 MiB by default, and never mutates source
data. It does not delete partial targets or overwrite pre-existing objects.
On interruption, rerun with the same inventory: existing copies are downloaded
and compared again. Journals are append-only and may contain repeated receipts;
reconcile by target_key plus SHA-256, not by counting journal lines.

A receipt proves the bytes downloaded during that run matched the target, not
that the source cannot subsequently change. Before cutover, export a fresh
inventory and reconcile added/changed/deleted objects; a conflicting target
requires deliberate versioned-key handling, never overwriting by this tool.
Implement caller-RLS authorization and short-lived private access, update all
uploads, processing and artifact/download/delete paths, verify application
flows, switch selected traffic, and monitor before considering old-data removal.

Run local safety checks:

```sh
python -m unittest discover -s tests -p test_cloudflare_copy.py -v
```
