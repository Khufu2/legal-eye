import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{terms,rankPassage} from '../scripts/cloudflare/corpus_worker.mjs';

test('gateway fails closed when secrets are missing or incorrect',async()=>{
 for(const [path,token] of [['/ingest','Bearer undefined'],['/search','Bearer undefined'],['/index','Bearer wrong']]){
  const response=await worker.fetch(new Request('https://example.org'+path,{method:'POST',headers:{authorization:token},body:'{}'}),{});
  assert.equal(response.status,401);
 }
});
test('corpus ranking keeps legal terms and ignores conversational filler',()=>{
 assert.deepEqual(terms('What does the Tanzania employment law say about termination?'),['employment','say','about','termination']);
 assert.equal(rankPassage('Employment termination requires notice',['employment','termination']),2);
 assert.equal(rankPassage('An unrelated tax provision',['employment','termination']),0);
 assert.ok(rankPassage('Arrangement of sections: Employment termination notice',['employment','termination']) < rankPassage('Employment termination requires notice',['employment','termination']));
});
test('unpublished index returns unavailable rather than invented evidence',async()=>{
 const response=await worker.fetch(new Request('https://example.org/search',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({query:'employment'})}),{SEARCH_TOKEN:'test',CORPUS:{get:async()=>null}});
 assert.equal(response.status,503);
});
test('index paths cannot escape the versioned search namespace',async()=>{
 const response=await worker.fetch(new Request('https://example.org/index',{method:'PUT',headers:{authorization:'Bearer test'},body:JSON.stringify({key:'raw/private',data:{}})}),{INGEST_TOKEN:'test'});
 assert.equal(response.status,400);
});
test('serialized index upload verifies exact stored bytes and rejects corruption',async()=>{
 const bytes=new TextEncoder().encode('{"employment":[["documents/test",2]]}');
 for(const corrupt of [false,true]){
  let stored;
  const response=await worker.fetch(new Request('https://example.org/index?key=search/test/TZ/00.json',{method:'PUT',headers:{authorization:'Bearer test'},body:bytes}),{INGEST_TOKEN:'test',CORPUS:{put:async(key,body)=>{stored=new Uint8Array(body);},get:async()=>({arrayBuffer:async()=>corrupt?new Uint8Array([0]).buffer:stored.buffer})}});
  assert.equal(response.status,corrupt?502:200);
  assert.deepEqual(stored,bytes);
 }
});
test('checkpoint cleanup retains three complete backups and newer in-flight parts',async()=>{
 const keys=['checkpoints/current.json',...['backup-1','backup-2','backup-3','backup-4'].flatMap(g=>[`checkpoints/${g}/manifest.json`,`checkpoints/${g}/part-0`]),'checkpoints/backup-5/part-0','raw/TZ/authority'];
 const removed=[];
 const response=await worker.fetch(new Request('https://example.org/checkpoint-prune',{method:'POST',headers:{authorization:'Bearer test'}}),{INGEST_TOKEN:'test',CORPUS:{get:async()=>({json:async()=>({generation:'backup-4'})}),list:async()=>({objects:keys.filter(k=>k.startsWith('checkpoints/')).map(key=>({key})),truncated:false}),delete:async key=>removed.push(key)}});
 assert.equal(response.status,200);assert.deepEqual(removed,['checkpoints/backup-1/manifest.json','checkpoints/backup-1/part-0']);
});
test('passage ranking recognizes legal inflections and prioritizes a specific issue',()=>{
 const query=['employment','termination','misconduct','procedural'];const weights={misconduct:2.5,procedural:2.5};
 const procedure='The employer must follow a fair procedure before dismissal for misconduct.';
 const unrelated='Employment employment employment termination notice notice.';
 assert.ok(rankPassage(procedure,query,weights)>rankPassage(unrelated,query,weights));
});
test('search retains distinct issue-bearing passages from the same authority',async()=>{
 const doc={id:'authority',title:'Employment statute',jurisdiction_code:'TZ',document_type:'act',chunks:Array.from({length:10},(_,index)=>({content:index===0?'Employment dismissal misconduct notice':index===5?'Employment termination must follow a fair procedure':'Unrelated provision',page_number:index+1,source_node_ref:'page-'+index}))};
 const index={employment:[['documents/authority',20]],termination:[['documents/authority',2]],misconduct:[['documents/authority',2]],procedural:[['documents/authority',2]]};
 const response=await worker.fetch(new Request('https://example.org/search',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({query:'employment termination misconduct procedural',jurisdictions:['TZ'],limit:16})}),{SEARCH_TOKEN:'test',CORPUS:{get:async key=>({json:async()=>key==='search/current.json'?{generation:'test',jurisdictions:['TZ']}:key==='documents/authority'?doc:index})}});
 assert.equal(response.status,200);const {evidence}=await response.json();
 assert.equal(evidence.length,2);assert.ok(evidence.some(hit=>hit.content.includes('fair procedure')));assert.ok(evidence.some(hit=>hit.content.includes('misconduct notice')));
});

test('the recovered parliamentary resolution carries its actual official source provenance',async()=>{
 const {provenance}=await import('../scripts/cloudflare/corpus_worker.mjs');
 const doc={jurisdiction_code:'TZ',external_id:'oag:parliamentary_resolutions:19',source_url:'https://www.parliament.go.tz/uploads/documents/sw-1738920470-1569484644-AZIMIO%20LA%20MARRAKESH.pdf'};
 assert.equal(provenance(doc).source_name,'Parliament of Tanzania');
 assert.match(provenance(doc).attribution,/Resolution 09\/2019/);
 assert.equal(provenance({...doc,source_url:'https://example.org/fake.pdf'}).source_name,'Tanzania Office of the Attorney General');
});
