import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{validateWatchlist,refreshTick} from '../scripts/cloudflare/corpus_worker.mjs';
const source={jurisdiction_code:'TZ',external_id:'oag:acts:synthetic',title:'Synthetic source',canonical_url:'https://oagmis.oag.go.tz/portal/acts/1',source_url:'https://oagmis.oag.go.tz/storage/source.pdf',content_sha256:'a'.repeat(64)};
test('source refresh rejects external hosts, credentials and oversized watchlists',()=>{
 assert.throws(()=>validateWatchlist([{...source,source_url:'https://127.0.0.1/private'}]),/Unapproved/);assert.throws(()=>validateWatchlist([{...source,source_url:'https://user:pass@oagmis.oag.go.tz/source'}]),/Unapproved/);assert.throws(()=>validateWatchlist(Array(101).fill(source)),/100/);assert.equal(validateWatchlist([source]).length,1);
});
test('scheduled refresh uses latest known source hash and persists failed checks',async()=>{
 const state={};const values={'refresh/watchlist.json':{documents:[source]},'search/delta.json':{documents:[{external_id:source.external_id,jurisdiction:'TZ',hash:'b'.repeat(64)}]}};const env={INGEST_TOKEN:'test-secret',CORPUS:{get:async key=>values[key]?{json:async()=>values[key]}:null,put:async(key,value)=>{state[key]=JSON.parse(value);}}};const previous=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{assert.equal(url,'https://lockeslaw.sheenax.xyz/api/corpus-refresh');assert.equal(JSON.parse(options.body).content_sha256,'b'.repeat(64));return Response.json({error:'Official source returned 503'},{status:422});};
 try{const event=await refreshTick(env);assert.equal(event.state,'error');assert.equal(state['refresh/state.json'].cursor,1);assert.equal(state['refresh/state.json'].coverage,1);}finally{globalThis.fetch=previous;}
});
test('search gateway never accepts anonymous update publications',async()=>{
 const r=await worker.fetch(new Request('https://example.invalid/delta-publish',{method:'POST',body:'{}'}),{INGEST_TOKEN:'test-secret'});assert.equal(r.status,401);
});
test('changed versions enter the delta index and search returns the replacement passage',async()=>{
 const id='1'.repeat(64),hash='2'.repeat(64),key=`documents/${id}/${hash}/${'3'.repeat(64)}.json`;
 const values={'search/current.json':{generation:'snapshot',jurisdictions:['TZ'],as_of:'2026-01-01'},[key]:{id,jurisdiction_code:'TZ',external_id:'synthetic',title:'Employment Act',canonical_url:source.canonical_url,content_sha256:hash,chunks:[{content:'Employment termination requires fair procedure.',page_number:1,source_node_ref:'page/1'}]}};
 const env={INGEST_TOKEN:'test-secret',SEARCH_TOKEN:'read-secret',CORPUS:{get:async k=>values[k]?{etag:'old',json:async()=>values[k]}:null,put:async(k,v)=>{values[k]=JSON.parse(v);return {etag:'new'};}}};
 const publish=await worker.fetch(new Request('https://example.invalid/delta-publish',{method:'POST',headers:{authorization:'Bearer test-secret','content-type':'application/json'},body:JSON.stringify({id,document_key:key})}),env);assert.equal(publish.status,200);assert.equal(values['search/delta.json'].documents[0].hash,hash);
 const search=await worker.fetch(new Request('https://example.invalid/search',{method:'POST',headers:{authorization:'Bearer read-secret'},body:JSON.stringify({query:'employment termination procedure',jurisdictions:['TZ']})}),env);const result=await search.json();assert.equal(result.evidence[0].content_sha256,hash);assert.match(result.evidence[0].content,/requires fair procedure/);
});
test('concurrent delta publication fails safely instead of overwriting another update',async()=>{
 const id='1'.repeat(64),key=`documents/${id}/${'2'.repeat(64)}/${'3'.repeat(64)}.json`;
 const env={INGEST_TOKEN:'test-secret',CORPUS:{get:async k=>k===key?{json:async()=>({id,jurisdiction_code:'TZ',title:'Law',chunks:[{content:'Law changed'}]})}:null,put:async()=>null}};
 const r=await worker.fetch(new Request('https://example.invalid/delta-publish',{method:'POST',headers:{authorization:'Bearer test-secret'},body:JSON.stringify({id,document_key:key})}),env);assert.equal(r.status,409);
});
