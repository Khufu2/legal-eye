from pathlib import Path
p=Path('services/docling/worker.py')
s=p.read_text()
s=s.replace('''    if parsed.scheme != "https" or parsed.hostname not in allowed_hosts:\n        raise PipelineError("source_host_mismatch", "Structured source URL failed source policy", False)''','''    if parsed.scheme not in {"http", "https"} or parsed.hostname not in allowed_hosts:\n        raise PipelineError("source_host_mismatch", "Structured source URL failed source policy", False)''',1)
s=s.replace('''    if final.scheme != "https" or final.hostname not in allowed_hosts:\n        raise PipelineError("source_host_mismatch", "Structured source redirected outside approved official hosts", False)''','''    if final.scheme not in {"http", "https"} or final.hostname not in allowed_hosts:\n        raise PipelineError("source_host_mismatch", "Structured source redirected outside approved official hosts", False)''',1)
s=s.replace('''    if work_uri.startswith("http://"):\n        work_uri = "https://" + work_uri.removeprefix("http://")\n    raw, content_type, resolved_url = fetch_official_structured(\n        work_uri,''','''    # CELLAR publishes canonical resource URIs over HTTP and performs controlled\n    # content-negotiation redirects. Preserve that official URI instead of forcing HTTPS.\n    separator = "&" if "?" in work_uri else "?"\n    request_uri = f"{work_uri}{separator}language=eng"\n    raw, content_type, resolved_url = fetch_official_structured(\n        request_uri,''',1)
p.write_text(s)
print('CELLAR canonical URI negotiation fixed')
