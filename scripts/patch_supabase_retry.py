from pathlib import Path
path = Path('services/docling/worker.py')
text = path.read_text()
old = 'attempts = 3 if method.upper() in {"GET", "HEAD"} else 1'
new = 'attempts = 3 if method.upper() in {"GET", "HEAD", "PATCH", "DELETE", "PUT"} else 1'
if old not in text:
    raise SystemExit('retry policy target not found')
path.write_text(text.replace(old, new, 1))
print('enabled transient retries for idempotent Supabase mutations')
