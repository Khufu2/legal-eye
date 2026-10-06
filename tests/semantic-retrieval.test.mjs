import test from 'node:test';
import assert from 'node:assert/strict';
import {fuseSemanticRanking,retrievalQuery} from '../lib/legal/semantic-retrieval.ts';
test('semantic fusion promotes the concept match while retaining source contents',()=>{
 const rows=[{id:1,content:'Lexical candidate'},{id:2,content:'Conceptual candidate'}];
 const ranked=fuseSemanticRanking(rows,[[1,0],[0,1],[1,0]]);assert.equal(ranked[0].id,2);assert.equal(ranked[0].content,rows[1].content);assert.equal(ranked[0].semantic_similarity,1);
});
test('invalid embedding shapes and zero vectors cannot silently reorder results',()=>{
 assert.throws(()=>fuseSemanticRanking([{content:'A'}],[[1,0],[0,0]]),/Invalid embedding/);assert.throws(()=>fuseSemanticRanking([{content:'A'}],[[1,0],[1]]),/Invalid embedding/);
 assert.throws(()=>retrievalQuery('key AKIAABCDEFGHIJKLMNOP'),/credential/);assert.match(retrievalQuery('passport: ABC12345'),/REDACTED/);
});
