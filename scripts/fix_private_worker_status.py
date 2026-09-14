from pathlib import Path

path = Path("services/docling/worker.py")
text = path.read_text()
old = '        "status": "indexed",\n        "content_hash": source_hash,'
new = '        "status": "ready",\n        "content_hash": source_hash,'
count = text.count(old)
if count != 1:
    raise SystemExit(f"Expected one private indexed status assignment, found {count}")
path.write_text(text.replace(old, new, 1))
