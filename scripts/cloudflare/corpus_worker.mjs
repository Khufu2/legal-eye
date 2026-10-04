// Independent public corpus gateway. No private firm records or browser credentials.
const SOURCES = {
 TZ: {host:'oagmis.oag.go.tz',name:'Tanzania Office of the Attorney General',attribution:'Source: Office of the Attorney General, United Republic of Tanzania.'},
 CA: {host:'raw.githubusercontent.com',name:'Justice Canada',attribution:'Source: Justice Canada. Reproduction is not represented as an official version.'},
 AU: {host:'www.legislation.gov.au',name:'Federal Register of Legislation',attribution:'Source: Australian Federal Register of Legislation, CC BY 4.0.'},
 UK: {host:'www.legislation.gov.uk',name:'UK Legislation',attribution:'Contains public sector information licensed under the Open Government Licence v3.0.'},
 EU: {host:'eur-lex.europa.eu',name:'EUR-Lex',attribution:'Source: EUR-Lex. Excludes protected third-party material.'},
};
const json=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
export function terms(text){return [...new Set((text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]).filter(w=>!['the','and','for','with','from','that','this','shall','which','under','what','does','how','are','law','legal','tanzania','tanzanian','act','section','please'].includes(w)))].slice(0,10);}
export function rankPassage(text,query){const lower=text.toLowerCase();const score=query.reduce((s,t)=>{const count=lower.split(t).length-1;return s+(count?1+Math.min(3,count-1)*0.15:0);},0);return /arrangement\s+of\s+sections|table\s+of\s+contents/i.test(text)?score*0.25:score;}
async function read(env,key){const obj=await env.CORPUS.get(key);return obj?obj.json():null;}
async function ingest(request,env){
 const form=await request.formData(), raw=form.get('raw'), metadata=String(form.get('document')||'{}');
 if(metadata.length>12*1024*1024)return json({error:'Extracted body too large'},413);
 const document=JSON.parse(metadata);
 const source=SOURCES[document.jurisdiction_code];
 if(!source||!(raw instanceof File)||raw.size>32*1024*1024||!raw.size)return json({error:'Invalid source or payload'},400);
 const url=new URL(document.canonical_url); if(url.protocol!=='https:'||url.hostname!==source.host||url.username||url.password)return json({error:'Unapproved source URL'},400);
 if(document.jurisdiction_code==='CA'&&!url.pathname.startsWith('/justicecanada/laws-lois-xml/'))return json({error:'Unapproved Canada source'},400);
 if(typeof document.external_id!=='string'||!document.external_id||!Array.isArray(document.chunks)||!document.chunks.length||document.chunks.length>3000)return json({error:'Missing extracted passages'},400);
 for(const c of document.chunks)if(typeof c.content!=='string'||!c.content.trim()||c.content.length>12000||!c.source_node_ref)return json({error:'Invalid passage'},400);
 const bytes=await raw.arrayBuffer(), hash=await sha(bytes);
 if(hash!==document.content_sha256)return json({error:'Source hash mismatch'},400);
 const id=await sha(new TextEncoder().encode(document.jurisdiction_code+':'+document.external_id));
 const rawKey=`raw/${document.jurisdiction_code}/${id}/${hash}`;
 const existing=await env.CORPUS.head(rawKey);
 if(!existing)await env.CORPUS.put(rawKey,bytes,{sha256:hash,httpMetadata:{contentType:raw.type||'application/octet-stream',cacheControl:'private, no-store'},customMetadata:{sha256:hash}});
 const remote=await env.CORPUS.get(rawKey); if(!remote||await sha(await remote.arrayBuffer())!==hash)return json({error:'R2 verification failed'},502);
 const stored={...document,id,raw_r2_key:rawKey,source_name:source.name,attribution:source.attribution,parser_version:document.parser_version||'locke-open-text-v1',indexed_at:new Date().toISOString()};
 const docKey=`documents/${id}/${hash}.json`, body=JSON.stringify(stored), bodyHash=await sha(new TextEncoder().encode(body));
 await env.CORPUS.put(docKey,body,{httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'},customMetadata:{sha256:bodyHash}});
 const check=await env.CORPUS.get(docKey);if(!check||await sha(await check.arrayBuffer())!==bodyHash)return json({error:'Extracted body verification failed'},502);
 return json({id,document_key:docKey,content_sha256:hash,extracted_sha256:bodyHash,bytes:raw.size,chunks:document.chunks.length,verified:true});
}
async function search(request,env){
 const input=await request.json(), query=terms(String(input.query||'').slice(0,4000));
 const manifest=await read(env,'search/current.json'); if(!manifest)return json({error:'Corpus index is not published'},503);
 const scope=(Array.isArray(input.jurisdictions)&&input.jurisdictions.length?input.jurisdictions:manifest.jurisdictions).filter(j=>SOURCES[j]);
 if(!query.length||!scope.length)return json({evidence:[],provider:'cloudflare-r2',as_of:manifest.as_of});
 const prefixOf=word=>{let h=0;for(const c of word)h=(h*31+c.codePointAt(0))>>>0;return (h%256).toString(16).padStart(2,'0');};
 const candidate=new Map();
 await Promise.all(scope.map(async jurisdiction=>{
  const prefixes=[...new Set(query.map(prefixOf))];
  const shards=await Promise.all(prefixes.map(p=>read(env,`search/${manifest.generation}/${jurisdiction}/${p}.json`)));
  query.forEach(term=>{const index=prefixes.indexOf(prefixOf(term));for(const hit of shards[index]?.[term]||[]){const key=hit[0],old=candidate.get(key)||{key,score:0,hits:0};old.score+=hit[1];old.hits++;candidate.set(key,old);}});
 }));
 const top=[...candidate.values()].sort((a,b)=>(b.score+b.hits*10)-(a.score+a.hits*10)).slice(0,8);
 const evidence=[];
 await Promise.all(top.map(async item=>{
  const doc=await read(env,item.key);if(!doc||!scope.includes(doc.jurisdiction_code))return;
  const ranked=doc.chunks.map((chunk,index)=>({chunk,index,score:rankPassage(chunk.content,query)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,1);
  for(const hit of ranked){const adjacent=doc.chunks.slice(Math.max(0,hit.index-1),hit.index+2);hit.chunk={...hit.chunk,content:adjacent.map(c=>`[${c.page_number?'Page '+c.page_number:c.source_node_ref}]\n${c.content}`).join('\n\n')};}
  for(const {chunk,index,score} of ranked)evidence.push({legal_document_id:doc.id,chunk_id:`${doc.id}:${index}`,title:doc.title,citation:doc.citation,content:chunk.content,page_number:chunk.page_number||null,source_node_ref:chunk.source_node_ref,start_offset:chunk.start_offset??null,end_offset:chunk.end_offset??null,canonical_url:doc.canonical_url,source_url:doc.source_url||doc.canonical_url,jurisdiction_code:doc.jurisdiction_code,document_type:doc.document_type,published_at:doc.published_at,retrieved_at:doc.retrieved_at,version_notice:doc.version_notice||'Currentness and amendments require verification',ocr_requires_verification:doc.ocr_requires_verification||false,content_sha256:doc.content_sha256,attribution:doc.attribution,source_kind:'cloudflare-r2',retrieval_score:(item.score+score*10)*(doc.document_type==='bill'?0.1:1)});
 }));
 evidence.sort((a,b)=>b.retrieval_score-a.retrieval_score);
 return json({evidence:evidence.slice(0,Math.min(24,Number(input.limit)||24)),provider:'cloudflare-r2',as_of:manifest.as_of,generation:manifest.generation});
}
export default {async fetch(request,env){
 try{
 const path=new URL(request.url).pathname;
 if(path==='/health')return json({service:'locke-corpus',private_storage:true});
 if(path==='/stats'){const m=await read(env,'search/current.json');return m?json(m):json({documents:0,chunks:0,jurisdictions:[],state:'building'});}
 if(path==='/search'&&request.method==='POST'){
  if(!env.SEARCH_TOKEN||request.headers.get('authorization')!==`Bearer ${env.SEARCH_TOKEN}`)return json({error:'Unauthorized'},401);
  return await search(request,env);
 }
 if(!env.INGEST_TOKEN||request.headers.get('authorization')!==`Bearer ${env.INGEST_TOKEN}`)return json({error:'Unauthorized'},401);
 if(path==='/checkpoint-prune'&&request.method==='POST'){
  const current=await read(env,'checkpoints/current.json');if(!current)return json({removed:0});
  let objects=[],cursor;
  do{const page=await env.CORPUS.list({prefix:'checkpoints/',limit:1000,cursor});objects.push(...page.objects);cursor=page.truncated?page.cursor:undefined;}while(cursor);
  const complete=objects.filter(o=>o.key.endsWith('/manifest.json')).map(o=>o.key.split('/')[1]).sort().reverse();
  const keep=new Set([current.generation,...complete.slice(0,3)]),cutoff=complete.slice(0,3).at(-1);
  const stale=objects.filter(o=>/^checkpoints\/backup-/.test(o.key)&&o.key.split('/')[1]<cutoff&&!keep.has(o.key.split('/')[1]));
  for(const obj of stale)await env.CORPUS.delete(obj.key);
  return json({removed:stale.length,retained_generations:[...keep]});
 }
 if(path==='/checkpoint'&&request.method==='PUT'){
  const key=new URL(request.url).searchParams.get('key');
  if(!/^checkpoints\/[a-zA-Z0-9_-]+\/(manifest\.json|part-[0-9]+)$/.test(key||''))return json({error:'Invalid checkpoint key'},400);
  const bytes=await request.arrayBuffer();if(bytes.byteLength>8*1024*1024)return json({error:'Checkpoint part too large'},413);
  const hash=await sha(bytes);await env.CORPUS.put(key,bytes,{customMetadata:{sha256:hash}});
  const check=await env.CORPUS.get(key);if(!check||await sha(await check.arrayBuffer())!==hash)return json({error:'Checkpoint verification failed'},502);
  if(key.endsWith('/manifest.json'))await env.CORPUS.put('checkpoints/current.json',bytes);
  return json({verified:true,sha256:hash});
 }
 if(path==='/checkpoint'&&request.method==='GET'){
  const key=new URL(request.url).searchParams.get('key')||'checkpoints/current.json';
  if(key!=='checkpoints/current.json'&&!/^checkpoints\/[a-zA-Z0-9_-]+\/(manifest\.json|part-[0-9]+)$/.test(key))return json({error:'Invalid checkpoint key'},400);
  const obj=await env.CORPUS.get(key);return obj?new Response(obj.body,{headers:{'cache-control':'private, no-store'}}):json({error:'Checkpoint not found'},404);
 }
 if(path==='/ingest'&&request.method==='POST')return await ingest(request,env);
 if(path==='/index'&&request.method==='PUT'){
  const {key,data}=await request.json();
  if(typeof key!=='string'||!/^search\/[a-zA-Z0-9_-]+\/(TZ|AU|CA|UK|EU)\/[0-9a-f]{2}\.json$/.test(key))return json({error:'Invalid index key'},400);
  const body=JSON.stringify(data);if(body.length>8*1024*1024)return json({error:'Index shard too large'},413);
  const digest=await sha(new TextEncoder().encode(body));await env.CORPUS.put(key,body,{httpMetadata:{contentType:'application/json'},customMetadata:{sha256:digest}});
  const remote=await env.CORPUS.get(key);if(!remote||await sha(await remote.arrayBuffer())!==digest)return json({error:'Index verification failed'},502);
  return json({verified:true,sha256:digest});
 }
 if(path==='/seal'&&request.method==='POST'){
  const {generation,jurisdiction}=await request.json();if(!/^[a-zA-Z0-9_-]+$/.test(generation)||!SOURCES[jurisdiction])return json({error:'Invalid generation'},400);
  for(let p=0;p<256;p++){const key=`search/${generation}/${jurisdiction}/${p.toString(16).padStart(2,'0')}.json`;if(!await env.CORPUS.head(key))return json({error:'Incomplete index',key},409);}
  await env.CORPUS.put(`search/${generation}/${jurisdiction}/sealed.json`,JSON.stringify({verified:true}));return json({verified:true});
 }
 if(path==='/publish'&&request.method==='POST'){
  const manifest=await request.json();if(!/^[a-zA-Z0-9_-]+$/.test(manifest.generation)||!Array.isArray(manifest.jurisdictions)||!manifest.documents)return json({error:'Invalid manifest'},400);
  for(const j of manifest.jurisdictions){if(!SOURCES[j]||!await env.CORPUS.head(`search/${manifest.generation}/${j}/sealed.json`))return json({error:'Unverified jurisdiction index'},409);}
  await env.CORPUS.put('search/current.json',JSON.stringify(manifest),{httpMetadata:{contentType:'application/json'}});return json({published:true,...manifest});
 }
 return json({error:'Not found'},404);
 }catch(error){return json({error:'Corpus request failed',kind:error.name},500);}
}};
