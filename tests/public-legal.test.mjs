import test from 'node:test';
import assert from 'node:assert/strict';
import {corpusQueries,officialSourceUrl} from '../lib/legal/public-legal.ts';

test('bilingual topic search preserves the original and expands common Kiswahili terms',()=>{
  const [expansion,original]=corpusQueries('Kufukuzwa kazi bila taarifa');
  assert.match(expansion,/Employment Labour Relations Act/);
  assert.equal(original,'Kufukuzwa kazi bila taarifa');
  assert.deepEqual(corpusQueries('Cap. 359'),['Cap. 359']);
});

test('public sources must be HTTPS on an exact approved official host',()=>{
  assert.equal(officialSourceUrl('https://oagmis.oag.go.tz/portal/acts/88'),'https://oagmis.oag.go.tz/portal/acts/88');
  for(const value of ['http://oagmis.oag.go.tz/','https://oagmis.oag.go.tz.evil.example/','https://user@oagmis.oag.go.tz/','https://oagmis.oag.go.tz:444/','javascript:alert(1)',null]){
    assert.equal(officialSourceUrl(value),null);
  }
});
