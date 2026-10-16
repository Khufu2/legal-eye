import test from 'node:test';
import assert from 'node:assert/strict';
import {createSafeStorage} from '../lib/auth/browser-storage.ts';
import {filterTelemetry} from '../lib/telemetry-policy.ts';
import {readAuthCallback} from '../lib/legal/auth-callback.ts';

test('denied storage and quota errors cannot interrupt onboarding or logout',()=>{
 const denied=createSafeStorage(()=>{throw new DOMException('Denied','SecurityError');});
 assert.equal(denied.getItem('session'),null);
 assert.equal(denied.setItem('session','value'),false);
 assert.doesNotThrow(()=>denied.removeItem('session'));
 const full=createSafeStorage(()=>({getItem:()=>null,setItem:()=>{throw new DOMException('Full','QuotaExceededError');},removeItem:()=>{}}));
 assert.equal(full.setItem('session','value'),false);
});
test('analytics drops legal content, identities, URLs, credentials and arbitrary codes',()=>{
 const input={event:'locke_auth_failed',session:'abcde123-1234-1234-abcd-abcde1234567',properties:{stage:'signin',browser:'Safari',code:'invalid_credentials',duration_ms:432,email:'person@firm.test',password:'secret',access_token:'secret',token_hash:'secret',url:'https://site/#access_token=secret',text:'Confidential matter',message:'Private exception'}};
 const clean=filterTelemetry(input);
 assert.equal(clean.properties.code,'invalid_credentials');
 assert.equal(clean.properties.$process_person_profile,false);
 assert.equal(clean.properties.$geoip_disable,true);
 assert.ok(!JSON.stringify(clean).includes('secret'));
 assert.ok(!JSON.stringify(clean).includes('Confidential'));
 assert.equal(filterTelemetry({...input,event:'$identify'}),null);
 assert.equal(filterTelemetry({...input,session:'person@firm.test'}),null);
 assert.equal(filterTelemetry({...input,properties:{code:'secret'}}).properties.code,undefined);
});
test('query-string callback errors and unsupported token types cannot masquerade as confirmation',()=>{
 assert.equal(readAuthCallback('', '?error=access_denied&error_description=private').kind,'error');
 assert.equal(readAuthCallback('#access_token=fake&type=arbitrary').kind,'error');
 assert.equal(readAuthCallback('#access_token=fake&type=recovery').kind,'recovery');
});
