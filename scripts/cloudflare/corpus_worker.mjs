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
const VARIANTS={employment:['employment','employee','employer'],termination:['termination','terminate','terminated','terminating','dismissal','dismissed'],procedural:['procedural','procedure','procedures'],unfair:['unfair','fair'],remedy:['remedy','remedies']};
export function rankPassage(text,query,weights={}){const lower=text.toLowerCase();const score=query.reduce((s,t)=>{const count=Math.max(...(VARIANTS[t]||[t]).map(v=>lower.split(v).length-1));return s+(count?(weights[t]||1)*(1+Math.min(3,count-1)*0.15):0);},0);return /arrangement\s+of\s+sections|table\s+of\s+contents/i.test(text)?score*0.25:score;}

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
 const body=JSON.stringify(stored), bodyHash=await sha(new TextEncoder().encode(body)),docKey=`documents/${id}/${hash}/${bodyHash}.json`;
 await env.CORPUS.put(docKey,body,{httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'},customMetadata:{sha256:bodyHash}});
 const check=await env.CORPUS.get(docKey);if(!check||await sha(await check.arrayBuffer())!==bodyHash)return json({error:'Extracted body verification failed'},502);
 return json({id,document_key:docKey,content_sha256:hash,extracted_sha256:bodyHash,bytes:raw.size,chunks:document.chunks.length,verified:true});
}
// Large public PDFs bypass multipart buffering and are verified as complete streams.
async function ingestRawStream(request,env){
 const q=new URL(request.url).searchParams,j=q.get('jurisdiction'),external=q.get('external_id'),hash=q.get('sha256'),size=Number(q.get('bytes'));
 const source=SOURCES[j];const url=new URL(q.get('canonical_url')||'https://invalid.invalid');
 if(!source||url.protocol!=='https:'||url.hostname!==source.host||url.username||url.password||!external||external.length>500||! /^[a-f0-9]{64}$/.test(hash||'')||!Number.isInteger(size)||size<1||size>96*1024*1024||Number(request.headers.get('content-length'))!==size||!request.body)return json({error:'Invalid bounded source stream'},400);
 if(j==='CA'&&!url.pathname.startsWith('/justicecanada/laws-lois-xml/'))return json({error:'Unapproved Canada source'},400);
 const id=await sha(new TextEncoder().encode(j+':'+external)),key=`raw/${j}/${id}/${hash}`;
 await env.CORPUS.put(key,request.body,{sha256:hash,httpMetadata:{contentType:'application/pdf',cacheControl:'private, no-store'}});
 const remote=await env.CORPUS.get(key),digest=new crypto.DigestStream('SHA-256');
 if(!remote||remote.size!==size)return json({error:'Source stream size mismatch'},502);
 await remote.body.pipeTo(digest);const actual=Array.from(new Uint8Array(await digest.digest),x=>x.toString(16).padStart(2,'0')).join('');
 if(actual!==hash)return json({error:'Source stream verification failed'},502);
 await env.CORPUS.put(`verification/${id}/${hash}.json`,JSON.stringify({id,key,sha256:hash,bytes:size}));
 return json({id,key,content_sha256:hash,bytes:size,verified:true});
}
async function ingestExtracted(request,env){
 const text=await request.text();if(text.length>12*1024*1024)return json({error:'Extracted body too large'},413);
 const document=JSON.parse(text),source=SOURCES[document.jurisdiction_code];
 if(!source||typeof document.external_id!=='string'||!document.external_id||! /^[a-f0-9]{64}$/.test(document.content_sha256||'')||!Array.isArray(document.chunks)||!document.chunks.length||document.chunks.length>3000)return json({error:'Invalid extracted document'},400);
 const url=new URL(document.canonical_url);if(url.protocol!=='https:'||url.hostname!==source.host||url.username||url.password)return json({error:'Unapproved source URL'},400);
 for(const c of document.chunks)if(typeof c.content!=='string'||!c.content.trim()||c.content.length>12000||!c.source_node_ref)return json({error:'Invalid passage'},400);
 const id=await sha(new TextEncoder().encode(document.jurisdiction_code+':'+document.external_id)),verification=await read(env,`verification/${id}/${document.content_sha256}.json`);
 if(!verification||!await env.CORPUS.head(verification.key))return json({error:'Complete source-byte verification required'},409);
 const stored={...document,id,raw_r2_key:verification.key,source_name:source.name,attribution:source.attribution,indexed_at:new Date().toISOString()};
 const body=JSON.stringify(stored),bodyHash=await sha(new TextEncoder().encode(body)),key=`documents/${id}/${document.content_sha256}/${bodyHash}.json`;
 await env.CORPUS.put(key,body,{httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'}});
 const check=await env.CORPUS.get(key);if(!check||await sha(await check.arrayBuffer())!==bodyHash)return json({error:'Extracted body verification failed'},502);
 return json({id,document_key:key,content_sha256:document.content_sha256,extracted_sha256:bodyHash,chunks:document.chunks.length,verified:true});
}
export function validateWatchlist(documents){
 if(!Array.isArray(documents)||!documents.length||documents.length>100)throw new Error('Watchlist must contain 1 to 100 priority sources');
 for(const doc of documents){for(const field of ['canonical_url','source_url']){const url=new URL(doc[field]);if(doc.jurisdiction_code!=='TZ'||url.protocol!=='https:'||url.hostname!==SOURCES.TZ.host||url.username||url.password||url.port)throw new Error('Unapproved watchlist source');}if(!/^[a-f0-9]{64}$/.test(doc.content_sha256)||typeof doc.external_id!=='string'||!doc.title)throw new Error('Invalid watchlist metadata');}
 return documents;
}
async function publishDelta(request,env){
 const input=await request.json();if(!/^[a-f0-9]{64}$/.test(input.id)||typeof input.document_key!=='string'||!input.document_key.startsWith(`documents/${input.id}/`)||!/^documents\/[a-f0-9]{64}\/[a-f0-9]{64}\/[a-f0-9]{64}\.json$/.test(input.document_key))return json({error:'Invalid verified document key'},400);
 const doc=await read(env,input.document_key);if(!doc||doc.id!==input.id)return json({error:'Verified document not found'},404);
 const frequencies={};for(const word of ((doc.title+' '+doc.chunks.map(c=>c.content).join(' ')).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]))frequencies[word]=(frequencies[word]||0)+1;
 const tokens=Object.fromEntries(Object.entries(frequencies).sort((a,b)=>b[1]-a[1]).slice(0,3000));
 const entry={id:doc.id,key:input.document_key,jurisdiction:doc.jurisdiction_code,external_id:doc.external_id,title:doc.title,canonical_url:doc.canonical_url,hash:doc.content_sha256,updated_at:new Date().toISOString(),tokens};
 for(let attempt=0;attempt<4;attempt++){const object=await env.CORPUS.get('search/delta.json'),previous=object?await object.json():{documents:[]};const documents=previous.documents.filter(d=>d.id!==entry.id);if(documents.length>=200)return json({error:'Delta index requires a full index reconciliation'},409);documents.push(entry);const next={documents,updated_at:entry.updated_at};const written=await env.CORPUS.put('search/delta.json',JSON.stringify(next),{onlyIf:object?{etagMatches:object.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});if(written)return json({published:true,id:entry.id,currentness_verified:false});}
 return json({error:'Concurrent index publication; retry'},409);
}
export async function refreshTick(env){
 const watchlist=await read(env,'refresh/watchlist.json');if(!watchlist?.documents?.length)return {state:'no-watchlist'};
 const state=await read(env,'refresh/state.json')||{cursor:0,events:[]};const doc=watchlist.documents[state.cursor%watchlist.documents.length];const delta=await read(env,'search/delta.json');const current=delta?.documents?.find(d=>d.external_id===doc.external_id&&d.jurisdiction===doc.jurisdiction_code);
 let result;try{const response=await fetch('https://lockeslaw.sheenax.xyz/api/corpus-refresh',{method:'POST',headers:{authorization:`Bearer ${env.INGEST_TOKEN}`,'content-type':'application/json'},body:JSON.stringify({...doc,content_sha256:current?.hash||doc.content_sha256}),redirect:'manual',signal:AbortSignal.timeout(55000)});result=await response.json();if(!response.ok)result={state:'error',error:String(result.error||`Refresh returned ${response.status}`).slice(0,250)};}catch(error){result={state:'error',error:String(error.message).slice(0,250)};}
 const event={title:doc.title,external_id:doc.external_id,canonical_url:doc.canonical_url,checked_at:new Date().toISOString(),...result};const next={cursor:state.cursor+1,coverage:watchlist.documents.length,events:[event,...state.events].slice(0,100)};await env.CORPUS.put('refresh/state.json',JSON.stringify(next),{httpMetadata:{contentType:'application/json'}});return event;
}
async function search(request,env){
 const input=await request.json(), query=terms(String(input.query||'').slice(0,4000));
 const manifest=await read(env,'search/current.json'); if(!manifest)return json({error:'Corpus index is not published'},503);
 const scope=(Array.isArray(input.jurisdictions)&&input.jurisdictions.length?input.jurisdictions:manifest.jurisdictions).filter(j=>SOURCES[j]);
 if(!query.length||!scope.length)return json({evidence:[],provider:'cloudflare-r2',as_of:manifest.as_of});
 const prefixOf=word=>{let h=0;for(const c of word)h=(h*31+c.codePointAt(0))>>>0;return (h%256).toString(16).padStart(2,'0');};
 const candidate=new Map(),weights={};
 await Promise.all(scope.map(async jurisdiction=>{
  const expanded=[...new Set(query.flatMap(t=>VARIANTS[t]||[t]))];
  const prefixes=[...new Set(expanded.map(prefixOf))];
  const shards=await Promise.all(prefixes.map(p=>read(env,`search/${manifest.generation}/${jurisdiction}/${p}.json`)));
  query.forEach(term=>{const best=new Map();for(const variant of VARIANTS[term]||[term]){const index=prefixes.indexOf(prefixOf(variant));for(const hit of shards[index]?.[variant]||[])best.set(hit[0],Math.max(best.get(hit[0])||0,hit[1]));}
   const importance=['misconduct','disciplinary','hearing','procedural','admissibility','indemnity','confidentiality'].includes(term)?2.5:1;
   const weight=importance*Math.max(1,Math.log1p(256/Math.max(1,best.size)));weights[term]=Math.max(weights[term]||1,weight);
   for(const [key,value] of best){const old=candidate.get(key)||{key,score:0,hits:0};old.score+=value*weight;old.hits+=weight;candidate.set(key,old);}
  });
 }));
 const delta=await read(env,'search/delta.json');
 for(const entry of delta?.documents||[]){if(!scope.includes(entry.jurisdiction))continue;let score=0,hits=0;for(const term of query){const count=Math.max(...(VARIANTS[term]||[term]).map(t=>entry.tokens[t]||0));if(count){score+=(1+Math.log1p(count))*(weights[term]||1);hits+=weights[term]||1;}}if(hits)candidate.set(entry.key,{key:entry.key,score,hits});}
 const top=[...candidate.values()].sort((a,b)=>(b.score+b.hits*10)-(a.score+a.hits*10)).slice(0,8);
 const evidence=[],seen=new Set();
 await Promise.all(top.map(async item=>{
  const newer=delta?.documents?.find(d=>item.key.startsWith(`documents/${d.id}/`));
  const doc=await read(env,newer?.key||item.key);if(!doc||!scope.includes(doc.jurisdiction_code)||seen.has(doc.id))return;seen.add(doc.id);
  const ranked=doc.chunks.map((chunk,index)=>({chunk,index,score:rankPassage(chunk.content,query,weights)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.index-b.index).filter((hit,index,all)=>!all.slice(0,index).some(previous=>Math.abs(previous.index-hit.index)<=2)).slice(0,3);
  for(const hit of ranked){const adjacent=doc.chunks.slice(Math.max(0,hit.index-1),hit.index+2);hit.chunk={...hit.chunk,content:adjacent.map(c=>`[${c.page_number?'Page '+c.page_number:c.source_node_ref}]\n${c.content}`).join('\n\n')};}
  for(const [passageRank,{chunk,index,score}] of ranked.entries())evidence.push({legal_document_id:doc.id,chunk_id:`${doc.id}:${index}`,title:doc.title,citation:doc.citation,content:chunk.content,page_number:chunk.page_number||null,source_node_ref:chunk.source_node_ref,start_offset:chunk.start_offset??null,end_offset:chunk.end_offset??null,canonical_url:doc.canonical_url,source_url:doc.source_url||doc.canonical_url,jurisdiction_code:doc.jurisdiction_code,document_type:doc.document_type,published_at:doc.published_at,retrieved_at:doc.retrieved_at,version_notice:doc.version_notice||'Currentness and amendments require verification',ocr_requires_verification:doc.ocr_requires_verification||false,content_sha256:doc.content_sha256,attribution:doc.attribution,source_kind:'cloudflare-r2',passage_rank:passageRank,retrieval_score:(item.score+score*10)*(doc.document_type==='bill'?0.1:1)});
 }));
 evidence.sort((a,b)=>a.passage_rank-b.passage_rank||b.retrieval_score-a.retrieval_score);
 return json({evidence:evidence.slice(0,Math.min(24,Number(input.limit)||24)),provider:'cloudflare-r2',as_of:manifest.as_of,generation:manifest.generation});
}
export default {async scheduled(controller,env,ctx){ctx.waitUntil(refreshTick(env));},async fetch(request,env){
 try{
 const path=new URL(request.url).pathname;
 if(path==='/health')return json({service:'locke-corpus',private_storage:true});
 if(path==='/stats'){const m=await read(env,'search/current.json');const assessment=await read(env,'coverage/current.json');return m?json({...m,assessment}):json({documents:0,chunks:0,jurisdictions:[],state:'building'});}
 if(path==='/changes'&&request.method==='GET'){if(request.headers.get('authorization')!==`Bearer ${env.SEARCH_TOKEN}`||!env.SEARCH_TOKEN)return json({error:'Unauthorized'},401);return json(await read(env,'refresh/state.json')||{coverage:0,events:[]});}
 if(path==='/search'&&request.method==='POST'){
  if(!env.SEARCH_TOKEN||request.headers.get('authorization')!==`Bearer ${env.SEARCH_TOKEN}`)return json({error:'Unauthorized'},401);
  return await search(request,env);
 }
 if(!env.INGEST_TOKEN||request.headers.get('authorization')!==`Bearer ${env.INGEST_TOKEN}`)return json({error:'Unauthorized'},401);
 if(path==='/raw-source'&&request.method==='PUT')return await ingestRawStream(request,env);
 if(path==='/ingest-extracted'&&request.method==='POST')return await ingestExtracted(request,env);
 if(path==='/coverage'&&request.method==='PUT'){const body=await request.text();if(body.length>128000)return json({error:'Assessment too large'},413);const input=JSON.parse(body);if(input.all_law_complete!==false||input.jurisdiction!=='TZ'||!Array.isArray(input.collections))return json({error:'Bounded catalogue assessment required'},400);await env.CORPUS.put('coverage/current.json',body);return json({saved:true});}
 if(path==='/watchlist'&&request.method==='PUT'){const input=await request.json();const documents=validateWatchlist(input.documents);await env.CORPUS.put('refresh/watchlist.json',JSON.stringify({documents}));return json({saved:documents.length});}
 if(path==='/refresh-tick'&&request.method==='POST')return json(await refreshTick(env));
 if(path==='/delta-publish'&&request.method==='POST')return await publishDelta(request,env);
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
  // Trusted ingestion clients serialize on the ingestion host. Avoid parsing and
  // reserializing multi-megabyte shards within the Workers Free CPU budget.
  let key=new URL(request.url).searchParams.get('key'),body;
  if(key){body=await request.arrayBuffer();}
  else{const input=await request.json();key=input.key;body=new TextEncoder().encode(JSON.stringify(input.data));}
  if(typeof key!=='string'||!/^search\/[a-zA-Z0-9_-]+\/(TZ|AU|CA|UK|EU)\/[0-9a-f]{2}\.json$/.test(key))return json({error:'Invalid index key'},400);
  if(body.byteLength>8*1024*1024)return json({error:'Index shard too large'},413);
  const digest=await sha(body);await env.CORPUS.put(key,body,{httpMetadata:{contentType:'application/json'},customMetadata:{sha256:digest}});
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
