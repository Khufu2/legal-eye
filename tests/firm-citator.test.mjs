import test from 'node:test';import assert from 'node:assert/strict';
import {citationCandidates,lookupFirmTreatment} from '../lib/legal/firm-citator.ts';
test('neutral citation parsing only produces bounded lookup candidates',()=>{
 assert.deepEqual(citationCandidates('See [2024] TZCA 123 and [2024] TZCA 123',[{citation:'Cap. 366'},{citation:null}]),['[2024] TZCA 123','Cap. 366']);
 assert.equal(citationCandidates('',Array.from({length:100},(_,i)=>({citation:'Citation '+i}))).length,80);
});
test('an empty citator result never certifies good law',async()=>{
 const result=await lookupFirmTreatment({url:'https://unused.invalid',key:'',authorization:'',organizationId:'',query:'No neutral citation',jurisdictions:['TZ'],evidence:[]});
 assert.equal(result.current_good_law_verified,false);assert.equal(result.absence_means,'unknown');assert.deepEqual(result.entries,[]);
});
