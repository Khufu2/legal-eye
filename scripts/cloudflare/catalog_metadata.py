"""Emit metadata-only SQL for monitoring; never copy source bodies or passages."""
import argparse,json,pathlib,sqlite3,uuid
p=argparse.ArgumentParser();p.add_argument('database');p.add_argument('output');p.add_argument('--jurisdiction',default='TZ');args=p.parse_args()
names={'TZ':'Tanzania Office of the Attorney General','UK':'UK Legislation','EU':'EUR-Lex','CA':'Justice Laws Website Canada','AU':'Federal Register of Legislation Australia'}
def quote(v):return 'NULL' if v is None else "'"+str(v).replace("'","''")+"'"
conn=sqlite3.connect(args.database);rows=conn.execute('select record from documents where jurisdiction=?',(args.jurisdiction,));out=pathlib.Path(args.output);out.mkdir(parents=True,exist_ok=True);batch=[];count=0;index=0
for row in rows:
 r=json.loads(row[0]);uid=str(uuid.uuid5(uuid.NAMESPACE_URL,r['jurisdiction_code']+':'+r['external_id']));source='(select id from public.source_registry where name='+quote(names[r['jurisdiction_code']])+')'
 vals=[quote(uid),source,quote(r['external_id']),quote(r['title']),quote(r.get('citation')),quote(r['jurisdiction_code']),quote(r.get('document_type','legislation')),quote(r.get('canonical_url')),quote(r.get('published_at') or None),quote(r.get('content_sha256')),quote(json.dumps({'corpus_provider':'cloudflare','snapshot':'rebuild-20261005T170949','retrieved_at':r.get('retrieved_at'),'currentness_verified':False}))+'::jsonb']
 batch.append('('+','.join(vals)+')');count+=1
 if len(batch)==100:
  (out/f'{index:03d}.sql').write_text('insert into public.legal_documents(id,source_id,canonical_source_id,title,citation,jurisdiction_code,document_type,canonical_url,published_at,content_hash,metadata) values '+','.join(batch)+' on conflict(id) do update set title=excluded.title,citation=excluded.citation,metadata=excluded.metadata;');index+=1;batch=[]
if batch:(out/f'{index:03d}.sql').write_text('insert into public.legal_documents(id,source_id,canonical_source_id,title,citation,jurisdiction_code,document_type,canonical_url,published_at,content_hash,metadata) values '+','.join(batch)+' on conflict(id) do update set title=excluded.title,citation=excluded.citation,metadata=excluded.metadata;')
print(json.dumps({'documents':count,'batches':index+bool(batch),'jurisdiction':args.jurisdiction}))
