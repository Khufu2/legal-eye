# Railway deployment

Keep the Next.js application on Vercel. Railway only hosts the private processing
services; Supabase remains the system of record.

## 1. Malware scanner

- Source: this GitHub repository and production branch
- Root directory: `/services/scanner`
- Health check: `/health`
- Private networking only; do not generate a public domain
- Variables: `SCANNER_TOKEN=<a long random value>`

## 2. Docling worker

- Source: this GitHub repository and production branch
- Root directory: `/services/docling`
- Start command: `python worker.py --limit 5`
- Cron schedule: `*/5 * * * *` (UTC)
- Variables:
  - `SUPABASE_URL`
  - `SUPABASE_SECRET_KEY`
  - `MALWARE_SCANNER_URL=http://scanner.railway.internal:8080/scan`
  - `MALWARE_SCANNER_TOKEN=${{scanner.SCANNER_TOKEN}}`
  - `DOCLING_MAX_UPLOAD_BYTES=104857600`
  - `DOCLING_LEASE_SECONDS=900`

The worker is intentionally finite and exits after each batch, matching Railway's
cron execution model. Railway skips a scheduled run when the preceding run has not
finished, so jobs cannot stack uncontrollably.

