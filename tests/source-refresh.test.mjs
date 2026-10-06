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
