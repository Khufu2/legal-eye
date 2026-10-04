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
