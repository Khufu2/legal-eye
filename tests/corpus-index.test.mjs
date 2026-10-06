import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDeltaTokens} from '../lib/legal/corpus-index.ts';
test('public-source postings preserve Unicode and count inherited property names safely',()=>{
 assert.deepEqual(buildDeltaTokens('Constructor constructor employment AJIRA ajira'),{constructor:2,ajira:2,employment:1});
});
test('public-source delta postings bound unique terms and oversized words',()=>{
 const result=buildDeltaTokens(Array.from({length:4000},(_,i)=>'term'+i).join(' ')+' '+'a'.repeat(101));
 assert.equal(Object.keys(result).length,3000);assert.ok(!result['a'.repeat(101)]);
});
