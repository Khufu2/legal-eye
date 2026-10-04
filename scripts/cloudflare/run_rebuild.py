"""One resumable public-source rebuild, with verified R2 checkpoints.

Run on the existing open-corpus service. Never accesses Supabase or private files.
Periodic publication is explicitly partial until source reconciliation succeeds.
"""
import concurrent.futures, json, pathlib, time
from ingest_sources import Rebuild, restore_checkpoint

endpoint='https://locke-corpus.ivogeraldladjr.workers.dev'
pathlib.Path('work').mkdir(mode=0o700,exist_ok=True)
database='work/cloudflare-corpus.sqlite'
if not pathlib.Path(database).exists():restore_checkpoint(endpoint,database)
runner=Rebuild(endpoint,'unused-environment-token',database)

def rebuild(j):
 try:
  getattr(runner,{'TZ':'tanzania','CA':'canada','AU':'australia','UK':'uk','EU':'eu'}[j])(3)
  return {'jurisdiction':j,'discovery_finished':True}
 except Exception as error:
  return {'jurisdiction':j,'discovery_finished':False,'error':type(error).__name__+': '+str(error)[:150]}

with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
 futures=[pool.submit(rebuild,j) for j in ['TZ','CA','AU','UK','EU']]
 last_checkpoint=time.monotonic();last_publish=last_checkpoint
 while any(not future.done() for future in futures):
  time.sleep(15)
  try:
   if time.monotonic()-last_checkpoint>=300:
    runner.checkpoint();last_checkpoint=time.monotonic()
   if time.monotonic()-last_publish>=900:
    runner.publish();last_publish=time.monotonic()
  except Exception as error:
   print(json.dumps({'maintenance_failed':type(error).__name__,'message':str(error)[:150]}),flush=True)
 for future in futures:print(json.dumps(future.result()),flush=True)
runner.checkpoint();runner.publish()
with runner.lock:
 print(json.dumps({'verified':dict(runner.db.execute('SELECT jurisdiction,count(*) FROM documents GROUP BY jurisdiction')),'discovered':dict(runner.db.execute('SELECT jurisdiction,count(*) FROM discovery GROUP BY jurisdiction'))}),flush=True)
