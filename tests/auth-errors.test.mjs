import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAuthFields, authErrorMessage, authRequest} from '../lib/legal/auth-errors.ts';

test('signup distinguishes email, short password and missing firm; sign-in accepts legacy shorter passwords',()=>{
 const errors=validateAuthFields({email:'wrong-email',password:'short',signup:true,firm:' ',requireFirm:true});
 assert.match(errors.email,/valid email/);assert.match(errors.password,/12 characters/);assert.match(errors.firm,/firm/);
 assert.deepEqual(validateAuthFields({email:' lawyer@firm.co.tz ',password:'old',signup:false}),{});
 assert.equal(validateAuthFields({email:'a@firm.com',password:'long-password',signup:true,requireFirm:false}).firm,undefined);
 assert.match(validateAuthFields({password:'long-password',confirm:'different',signup:true}).confirm,/do not match/);
});
test('provider errors distinguish confirmation, breached password and throttling without guessing which credential was wrong',()=>{
 assert.match(authErrorMessage({error_code:'email_not_confirmed'},400),/Confirm your email/);
 assert.match(authErrorMessage({code:'invalid_credentials'},400),/Email or password/);
 assert.match(authErrorMessage({code:'weak_password',weak_password:{reasons:['pwned']}},422),/data breach/);
 assert.match(authErrorMessage({},429),/Too many attempts/);
 assert.doesNotMatch(authErrorMessage({message:'SQL secret_token=private',code:'unexpected_failure'},500),/SQL|private|secret_token/);
});
test('network and timeout errors are actionable and account calls always have a bounded abort signal',async(t)=>{
 assert.match(authErrorMessage(new TypeError('fetch failed')),/internet connection/);
 assert.match(authErrorMessage(new DOMException('timeout','TimeoutError')),/too long/);
 let signal;
 t.mock.method(globalThis,'fetch',async(_url,init)=>{signal=init.signal;throw new TypeError('network internals');});
 await assert.rejects(authRequest('https://auth.invalid',{method:'POST'}),/internet connection/);
 assert.ok(signal instanceof AbortSignal);
});
