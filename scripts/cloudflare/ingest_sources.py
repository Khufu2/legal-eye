"""Rebuild approved public corpora directly in private R2; no Supabase access.

Uses source allowlists, bounded downloads, page-preserving PDF extraction,
immutable hashes, complete-byte remote verification, resumable local receipts,
and generation-based lexical indexes. This is not a private document processor.
"""
from __future__ import annotations
import argparse, collections, concurrent.futures, gzip, hashlib, importlib.util, json, math, os, pathlib, re, shutil, sqlite3, subprocess, tempfile, threading, time
from datetime import datetime, timezone
from urllib.parse import quote, urlparse
import httpx

ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('open_corpus',ROOT/'services/open-corpus/worker.py')
upstream=importlib.util.module_from_spec(spec);spec.loader.exec_module(upstream)
MAX_BYTES=32*1024*1024
COLLECTIONS=[('acts','acts-ajax','act'),('revised_acts','revised-acts-ajax','revised_act'),('subsidiary_legislation','legislation-ajax','subsidiary_legislation'),('annual_supplements','annual-supplements-ajax','annual_supplement'),('bills','bills-ajax','bill'),('guidelines','guidelines-ajax','guideline'),('parliamentary_resolutions','bills-specific-resolutions','parliamentary_resolution'),('international_instruments','bills-international-resolutions','international_instrument')]
STOP=set('the and for with from that this shall which under what does how are law legal tanzania tanzanian act section please was were have has any not may all such than their been being'.split())
def now():return datetime.now(timezone.utc).isoformat()
def digest(b):return hashlib.sha256(b).hexdigest()
def tokens(s):return [x for x in re.findall(r'[^\W_]{3,}',s.lower(),re.UNICODE) if x not in STOP]
def prefix(word):
 h=0
 for c in word:h=(h*31+ord(c))&0xffffffff
 return f'{h%256:02x}'

class Rebuild:
 def __init__(self,endpoint,secret_file,database):
  if not endpoint.startswith('https://locke-corpus.') or urlparse(endpoint).hostname!='locke-corpus.ivogeraldladjr.workers.dev':raise ValueError('Unexpected gateway')
  self.endpoint=endpoint.rstrip('/');self.secret=os.environ.get('LOCKE_CORPUS_INGEST_TOKEN') or json.loads(pathlib.Path(secret_file).read_text())['ingest_token']
  self.client=httpx.Client(timeout=httpx.Timeout(120,connect=15),headers={'user-agent':'LOCKE/0.7 governed-corpus-rebuild'})
  self.db=sqlite3.connect(database,check_same_thread=False,timeout=60);self.lock=threading.Lock()
  self.db.executescript('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY,jurisdiction TEXT,external_id TEXT,hash TEXT,object_key TEXT,title TEXT,chunk_count INTEGER,record TEXT); CREATE TABLE IF NOT EXISTS errors (jurisdiction TEXT,external_id TEXT,error TEXT,at TEXT); CREATE TABLE IF NOT EXISTS discovery (jurisdiction TEXT,external_id TEXT,record TEXT,PRIMARY KEY(jurisdiction,external_id));')
 def call(self,path,method='POST',**kwargs):
  for attempt in range(3):
   r=self.client.request(method,self.endpoint+path,headers={'authorization':'Bearer '+self.secret},**kwargs)
   if r.status_code in (429,502,503,504) and attempt<2:time.sleep(1+attempt);continue
   r.raise_for_status();return r.json()
  raise RuntimeError('Gateway unavailable')
 def fetch(self,url,allowed):
  parsed=urlparse(url)
  if (parsed.scheme!='https' and not(parsed.scheme=='http' and parsed.hostname=='publications.europa.eu')) or parsed.hostname not in allowed or parsed.username or parsed.password:raise ValueError('Unapproved fetch destination')
  for attempt in range(3):
   headers={'accept':'application/xhtml+xml, application/xml;q=0.9, text/html;q=0.8','accept-language':'eng'} if '/resource/celex/' in url else {}
   with self.client.stream('GET',url,headers=headers,follow_redirects=False) as r:
    if r.is_redirect:
     target=str(r.headers.get('location',''))
     from urllib.parse import urljoin
     return self.fetch(urljoin(url,target),allowed)
    if r.status_code in (429,502,503,504) and attempt<2:time.sleep(1+attempt);continue
    r.raise_for_status();body=bytearray()
    for b in r.iter_bytes():
     body.extend(b)
     if len(body)>MAX_BYTES:raise ValueError('Source exceeds 32 MiB limit')
    return bytes(body),r.headers.get('content-type','application/octet-stream')
  raise RuntimeError('Source unavailable')
 def discover(self,j,external,record):
  with self.lock:self.db.execute('INSERT OR REPLACE INTO discovery VALUES (?,?,?)',(j,external,json.dumps(record)));self.db.commit()
 def ingest(self,doc,raw,mime):
  doc={**doc,'content_sha256':digest(raw),'retrieved_at':now(),'parser_version':'pdftotext-layout-v1' if raw.startswith(b'%PDF') else 'structured-text-v1'}
  if raw.startswith(b'%PDF'):
   with tempfile.TemporaryDirectory() as d:
    p=pathlib.Path(d)/'source.pdf';p.write_bytes(raw)
    result=subprocess.run(['pdftotext','-layout',str(p),'-'],capture_output=True,timeout=90,check=True)
    pages=result.stdout.decode('utf-8',errors='strict').split('\f')
    if sum(len(x.strip()) for x in pages)<120:
     info=subprocess.run(['pdfinfo',str(p)],capture_output=True,text=True,timeout=15,check=True)
     count=int(re.search(r'^Pages:\s+(\d+)',info.stdout,re.M).group(1))
     if count>250:raise ValueError('Scanned document exceeds bounded OCR page limit')
     pages=[];ocr_started=time.monotonic()
     for page in range(1,count+1):
      if time.monotonic()-ocr_started>180:raise ValueError('Scanned document exceeded OCR time budget; retained for retry')
      image=pathlib.Path(d)/'page'
      subprocess.run(['pdftoppm','-f',str(page),'-l',str(page),'-r','130','-singlefile','-png',str(p),str(image)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=45,check=True)
      ocr=subprocess.run(['tesseract',str(image)+'.png','stdout','-l','eng','--psm','3'],capture_output=True,timeout=60,check=True)
      pages.append(ocr.stdout.decode('utf-8'));pathlib.Path(str(image)+'.png').unlink(missing_ok=True)
     doc['parser_version']='tesseract-eng-130dpi-v1';doc['ocr_requires_verification']=True
   chunks=[]
   for page,text in enumerate(pages,1):
    for i,piece in enumerate(upstream.chunk_text(text)):
     chunks.append({'content':piece,'page_number':page,'source_node_ref':f'page/{page}/text/{i}'})
  else:
   text=raw.decode('utf-8',errors='strict')
   if not doc.get('title','').strip():doc['title']=upstream.title_from_markup(text,'Legislation '+doc['external_id'])
   if doc['jurisdiction_code']=='AU' and 'Table of contents' in upstream.strip_markup(text) and not re.search(r'\b(Short title|Appropriation|Be it enacted|[Ss]ection [1-9])\b',upstream.strip_markup(text)):
    raise ValueError('Website shell is not legislative text')
   if '<!ENTITY' in text.upper():raise ValueError('XML entities rejected')
   chunks=[{'content':piece,'page_number':None,'source_node_ref':f'text/{i}'} for i,piece in enumerate(upstream.chunk_text(upstream.strip_markup(text)))]
  if not chunks or sum(len(x['content']) for x in chunks)<120:raise ValueError('No usable source text; OCR required')
  doc['chunks']=chunks
  receipt=self.call('/ingest',data={'document':json.dumps(doc,ensure_ascii=False)},files={'raw':('source',raw,mime.split(';')[0])})
  if not receipt.get('verified') or receipt.get('content_sha256')!=doc['content_sha256']:raise ValueError('Remote verification mismatch')
  with self.lock:
   self.db.execute('INSERT OR REPLACE INTO documents VALUES (?,?,?,?,?,?,?,?)',(receipt['id'],doc['jurisdiction_code'],doc['external_id'],doc['content_sha256'],receipt['document_key'],doc['title'],len(chunks),json.dumps(doc,ensure_ascii=False)))
   self.db.commit()
  return receipt
 def run_one(self,doc,allowed):
  try:
   with self.lock:done=self.db.execute('SELECT title FROM documents WHERE jurisdiction=? AND external_id=?',(doc['jurisdiction_code'],doc['external_id'])).fetchone()
   if done and done[0].strip():return
   raw,mime=self.fetch(doc.get('source_url',doc['canonical_url']),allowed);self.ingest(doc,raw,mime)
  except Exception as e:
   with self.lock:self.db.execute('INSERT INTO errors VALUES (?,?,?,?)',(doc['jurisdiction_code'],doc['external_id'],type(e).__name__+': '+str(e)[:160],now()));self.db.commit()
 def batch(self,docs,allowed,workers):
  with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:list(pool.map(lambda d:self.run_one(d,allowed),docs))
  with self.lock:counts=dict(self.db.execute('SELECT jurisdiction,count(*) FROM documents GROUP BY jurisdiction'));errors=self.db.execute('SELECT count(*) FROM errors').fetchone()[0]
  print(json.dumps({'verified_documents':counts,'failed_attempts':errors}),flush=True)
 def tanzania(self,workers):
  for collection,endpoint,doctype in COLLECTIONS:
   raw,_=self.fetch('https://oagmis.oag.go.tz/portal/'+endpoint,{'oagmis.oag.go.tz'});rows=json.loads(raw).get('data',[]);docs=[]
   for item in rows:
    if item.get('published') is False:continue
    external=f'oag:{collection}:{item["id"]}'
    self.discover('TZ',external,item)
    path=next((v for k,v in item.items() if re.search(r'(doc|file).*path|path.*(doc|file)',k,re.I) and isinstance(v,str) and v),None)
    if not path or '..' in path:continue
    url='https://oagmis.oag.go.tz/storage/'+'/'.join(quote(x,safe='-._~') for x in path.strip('/').split('/') if x)
    chapter=item.get('chapterNumber');date=item.get('publicationDate')
    title=item.get('shortTitle') or item.get('title') or item.get('longTitle') or f'OAG {collection} {item["id"]}'
    detail={'subsidiary_legislation':'legislation','parliamentary_resolutions':'specific-resolutions','international_instruments':'international-resolutions'}.get(collection,collection.replace('_','-'))
    docs.append({'external_id':external,'jurisdiction_code':'TZ','title':title,'citation':f'Cap. {chapter}' if chapter else item.get('enactmentNo'),'document_type':doctype,'canonical_url':f'https://oagmis.oag.go.tz/portal/{detail}/{item["id"]}','source_url':url,'published_at':date,'effective_from':item.get('commencementDate')})
   # Prioritize core practice statutes before the complete catalogue.
   docs.sort(key=lambda d:(not bool(re.search('employment|labour|companies|contract|land act|evidence|personal data|arbitration|civil procedure|penal code|constitution',d['title'],re.I)),d['title']))
   for i in range(0,len(docs),100):self.batch(docs[i:i+100],{'oagmis.oag.go.tz'},workers)
 def canada(self,workers):
  _,entries=upstream.canada_entries(self.client)
  for i in range(0,len(entries),100):
   docs=[]
   for item in entries[i:i+100]:
    path=item['path'];url='https://raw.githubusercontent.com/justicecanada/laws-lois-xml/main/'+path;external='justicecanada:'+path
    self.discover('CA',external,item)
    docs.append({'external_id':external,'jurisdiction_code':'CA','title':f'Canada federal {pathlib.PurePosixPath(path).stem}','citation':None,'document_type':'act' if '/acts/' in '/'+path else 'regulation','canonical_url':url,'published_at':None})
   def one(doc):
    try:
     with self.lock:done=self.db.execute('SELECT 1 FROM documents WHERE jurisdiction=? AND external_id=?',('CA',doc['external_id'])).fetchone()
     if done:return
     raw,mime=self.fetch(doc['canonical_url'],{'raw.githubusercontent.com'});doc['title']=upstream.title_from_markup(raw.decode('utf-8'),doc['title']);self.ingest(doc,raw,mime)
    except Exception as e:
     with self.lock:self.db.execute('INSERT INTO errors VALUES (?,?,?,?)',('CA',doc['external_id'],type(e).__name__+': '+str(e)[:160],now()));self.db.commit()
   with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:list(pool.map(one,docs))
   print(json.dumps({'jurisdiction':'CA','discovered_offset':i+len(docs),'source_total':len(entries)}),flush=True)
 def australia(self,workers):
  offset=0
  while True:
   r=self.client.get('https://api.prod.legislation.gov.au/v1/titles',params={'$top':'100','$skip':str(offset),'$filter':'isInForce eq true'});r.raise_for_status();payload=r.json();entries=payload.get('value') if isinstance(payload,dict) else payload
   if not entries:break
   docs=[]
   for item in entries:
    ident=upstream.pick(item,'RegisterId','Id','TitleId');title=upstream.pick(item,'Name','Title','ShortTitle','DisplayName')
    if not ident or not title:continue
    external='australia:'+str(ident);self.discover('AU',external,item)
    source_url=f"https://api.prod.legislation.gov.au/v1/documents/find(titleid='{ident}',asat={now()[:10]},type='Primary',format='Pdf',uniqueTypeNumber=0,volumeNumber=0,rectificationVersionNumber=0)"
    docs.append({'external_id':external,'jurisdiction_code':'AU','title':str(title),'citation':str(ident),'document_type':str(upstream.pick(item,'Collection','Type','TitleType') or 'legislation').lower(),'canonical_url':f'https://www.legislation.gov.au/{ident}/latest/text','source_url':source_url,'published_at':upstream.pick(item,'LastUpdated','DateMade','Start','AsMadeDate'),'source_status':item.get('status')})
   self.batch(docs,{'www.legislation.gov.au','api.prod.legislation.gov.au'},workers);offset+=len(entries)
 def uk(self,workers,max_pages=100):
  url='https://www.legislation.gov.uk/all/data.feed?sort=published&page=1';page=0
  while url and page<max_pages:
   raw,_=self.fetch(url,{'www.legislation.gov.uk'});entries,next_url=upstream.uk_feed(raw.decode('utf-8'));docs=[]
   for item in entries:
    self.discover('UK',item['id'],item)
    if item['xml_url']:docs.append({'external_id':item['id'],'jurisdiction_code':'UK','title':item['title'],'citation':None,'document_type':'legislation','canonical_url':item['xml_url'].removesuffix('/data.xml'),'source_url':item['xml_url'],'published_at':item['published'],'version_notice':'As made/enacted; amendments not verified'})
   self.batch(docs,{'www.legislation.gov.uk'},workers);url=next_url;page+=1
 def eu(self,workers,max_records=2200):
  for offset in range(0,max_records,100):
   query='''PREFIX cdm: <http://publications.europa.eu/ontology/cdm#> SELECT DISTINCT ?work ?celex ?date ?title WHERE { ?work cdm:resource_legal_id_celex ?celex ; cdm:work_date_document ?date . OPTIONAL { ?expression cdm:expression_belongs_to_work ?work ; cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/ENG> ; cdm:expression_title ?title . } FILTER(REGEX(STR(?celex), "^[1234][0-9A-Z]{4,}$")) } ORDER BY DESC(?date) DESC(?celex) LIMIT 100 OFFSET '''+str(offset)
   r=self.client.post('https://publications.europa.eu/webapi/rdf/sparql',data={'query':query,'format':'application/sparql-results+json'});r.raise_for_status();entries=r.json().get('results',{}).get('bindings',[])
   if not entries:break
   docs=[]
   for item in entries:
    celex=item['celex']['value'];url='https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:'+quote(celex,safe='');external='celex:'+celex;self.discover('EU',external,item)
    docs.append({'external_id':external,'jurisdiction_code':'EU','title':item.get('title',{}).get('value','EU legal document '+celex),'citation':'CELEX '+celex,'document_type':'eu_legal_act','canonical_url':url,'source_url':'https://publications.europa.eu/resource/celex/'+quote(celex,safe=''),'published_at':item.get('date',{}).get('value')})
   self.batch(docs,{'eur-lex.europa.eu','publications.europa.eu'},workers)
 def publish(self):
  generation='rebuild-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S');counts={};chunks=0;latest=[]
  with tempfile.TemporaryDirectory() as folder:
   snapshot=sqlite3.connect(str(pathlib.Path(folder)/'snapshot.sqlite'))
   with self.lock:self.db.backup(snapshot)
   index_path=str(pathlib.Path(folder)/'index.sqlite');index=sqlite3.connect(index_path)
   index.executescript('PRAGMA journal_mode=OFF; PRAGMA temp_store=FILE; CREATE TABLE postings(j TEXT,p INTEGER,term TEXT,key TEXT,weight REAL);')
   for j,key,title,n,record in snapshot.execute('SELECT jurisdiction,object_key,title,chunk_count,record FROM documents'):
    doc=json.loads(record);counts[j]=counts.get(j,0)+1;chunks+=n
    body=collections.Counter()
    for chunk in doc['chunks']:body.update(tokens(chunk['content']))
    titles=collections.Counter(tokens(title+' '+str(doc.get('citation') or '')))
    index.executemany('INSERT INTO postings VALUES (?,?,?,?,?)',((j,int(prefix(term),16),term,key,round(math.log1p(body[term])+titles[term]*15,3)) for term in body.keys()|titles.keys()))
    latest.append({k:doc.get(k) for k in ['title','citation','canonical_url','jurisdiction_code','document_type','published_at']})
    latest=sorted(latest,key=lambda d:str(d.get('published_at') or ''),reverse=True)[:12]
   snapshot.close();index.execute('CREATE INDEX lookup ON postings(j,p,term,weight DESC,key)');index.commit();index.close()
   for j in sorted(counts):
    def upload(p):
     connection=sqlite3.connect(index_path);shard=collections.defaultdict(list)
     try:
      for term,key,weight in connection.execute('SELECT term,key,weight FROM postings WHERE j=? AND p=? ORDER BY term,weight DESC,key',(j,p)):
       if len(shard[term])<256:shard[term].append([key,weight])
     finally:connection.close()
     return self.call('/index','PUT',json={'key':f'search/{generation}/{j}/{p:02x}.json','data':shard})
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(upload,range(256)))
    self.call('/seal',json={'generation':generation,'jurisdiction':j})
  if not counts:raise RuntimeError('No verified documents to publish')
  manifest={'generation':generation,'as_of':now(),'jurisdictions':sorted(counts),'documents':sum(counts.values()),'chunks':chunks,'counts':counts,'latest':latest,'coverage':'Rebuild in progress; source reconciliation required','index':'lexical title/content postings, bounded to 256 documents per term'}
  print(json.dumps(self.call('/publish',json=manifest)),flush=True)

 def checkpoint(self):
  generation='backup-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')
  with tempfile.TemporaryDirectory() as folder:
   target=sqlite3.connect(str(pathlib.Path(folder)/'corpus.sqlite'))
   with self.lock:self.db.backup(target)
   target.close();compressed=pathlib.Path(folder)/'corpus.sqlite.gz'
   with (pathlib.Path(folder)/'corpus.sqlite').open('rb') as source,gzip.open(compressed,'wb',compresslevel=3) as output:shutil.copyfileobj(source,output,1024*1024)
   parts=[];overall=hashlib.sha256();size=0
   with compressed.open('rb') as stream:
    while part:=stream.read(8*1024*1024):
     overall.update(part);size+=len(part);key=f'checkpoints/{generation}/part-{len(parts)}'
     receipt=self.call('/checkpoint','PUT',params={'key':key},content=part)
     if receipt.get('sha256')!=digest(part):raise ValueError('Checkpoint hash mismatch')
     parts.append({'key':key,'sha256':digest(part)})
  manifest={'generation':generation,'parts':parts,'sha256':overall.hexdigest(),'as_of':now()}
  self.call('/checkpoint','PUT',params={'key':f'checkpoints/{generation}/manifest.json'},content=json.dumps(manifest).encode())
  self.call('/checkpoint-prune',json={})
  print(json.dumps({'checkpoint':generation,'compressed_bytes':size,'parts':len(parts)}),flush=True)

def restore_checkpoint(endpoint,database):
 token=os.environ['LOCKE_CORPUS_INGEST_TOKEN'];headers={'authorization':'Bearer '+token}
 with httpx.Client(timeout=120) as client:
  result=client.get(endpoint+'/checkpoint',headers=headers)
  if result.status_code==404:return
  result.raise_for_status();manifest=result.json();overall=hashlib.sha256()
  with tempfile.TemporaryDirectory() as folder:
   archive=pathlib.Path(folder)/'checkpoint.gz'
   with archive.open('wb') as stream:
    for part in manifest['parts']:
     r=client.get(endpoint+'/checkpoint',headers=headers,params={'key':part['key']});r.raise_for_status()
     if digest(r.content)!=part['sha256']:raise ValueError('Checkpoint part hash mismatch')
     overall.update(r.content);stream.write(r.content)
   if overall.hexdigest()!=manifest['sha256']:raise ValueError('Checkpoint hash mismatch')
   restored=pathlib.Path(folder)/'restored.sqlite'
   with gzip.open(archive,'rb') as source,restored.open('wb') as target:shutil.copyfileobj(source,target,1024*1024)
   check=sqlite3.connect(str(restored));valid=check.execute('PRAGMA integrity_check').fetchone()[0]=='ok';check.close()
   if not valid:raise ValueError('Checkpoint database integrity check failed')
   shutil.copyfile(restored,database)

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--endpoint',default='https://locke-corpus.ivogeraldladjr.workers.dev');p.add_argument('--secrets',default='work/cloudflare-operator.json');p.add_argument('--database',default='work/cloudflare-corpus.sqlite');p.add_argument('--jurisdictions',nargs='+',choices=['TZ','CA','AU','UK','EU'],default=['TZ']);p.add_argument('--workers',type=int,default=4);p.add_argument('--publish-only',action='store_true');p.add_argument('--no-publish',action='store_true');a=p.parse_args()
 runner=Rebuild(a.endpoint,a.secrets,a.database)
 if not a.publish_only:
  for j in a.jurisdictions:
   try:getattr(runner,{'TZ':'tanzania','CA':'canada','AU':'australia','UK':'uk','EU':'eu'}[j])(max(1,min(a.workers,8)))
   except Exception as e:print(json.dumps({'jurisdiction':j,'connector_failed':type(e).__name__,'message':str(e)[:200]}),flush=True)
 if not a.no_publish:runner.publish()
if __name__=='__main__':main()
