from pathlib import Path

page = Path("app/page.tsx")
text = page.read_text()
old_process = '''const process=await fetch(SUPABASE_URL+"/functions/v1/legal-process-document",{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+identity.access_token,"content-type":"application/json"},body:JSON.stringify({document_id:rows[0].id})});'''
new_process = '''const process=await fetch("/api/process-document",{method:"POST",headers:{Authorization:"Bearer "+identity.access_token,"content-type":"application/json"},body:JSON.stringify({document_id:rows[0].id,organization_id:identity.organization_id})});'''
if old_process not in text:
    raise SystemExit("Vault processing call was not found")
text = text.replace(old_process, new_process, 1)
old_toast = '''toast.success("Document secured",{description:job.status==="queued"?"Parsing is queued until the private Docling worker is connected.":"Private parsing has started."});refresh();'''
new_toast = '''toast.success("Document secured",{description:job.status==="complete"?"Searchable text is ready in Supabase.":"Stored in Supabase. Hybrid processing is queued: Docling first, lightweight extraction fallback."});refresh();'''
if old_toast not in text:
    raise SystemExit("Vault processing toast was not found")
text = text.replace(old_toast, new_toast, 1)
text = text.replace('["Parser","Queued processing"]', '["Parser","Docling + lightweight fallback"]', 1)
page.write_text(text)

worker = Path("services/docling/worker.py")
text = worker.read_text()
old_delete = 'api.delete("document_chunks", f"source_artifact_id=eq.{encoded(artifact_id)}")'
new_delete = 'api.delete("document_chunks", f"document_id=eq.{encoded(document[\"id\"])}")'
if old_delete not in text:
    raise SystemExit("Private chunk cleanup line was not found")
text = text.replace(old_delete, new_delete, 1)
worker.write_text(text)

invalid_workflow = Path(".github/workflows/hybrid-processing-patch.yml")
if invalid_workflow.exists():
    invalid_workflow.unlink()
