import assert from 'node:assert/strict';
import test from 'node:test';
import {readAuthCallback} from '../lib/legal/auth-callback.ts';

test('recovery requires an access token and recovery type', () => {
  assert.equal(readAuthCallback('#type=recovery'), null);
  assert.deepEqual(readAuthCallback('#access_token=test-token&type=recovery'), {kind:'recovery',token:'test-token'});
  assert.deepEqual(readAuthCallback('#access_token=test-token&type=signup'), {kind:'verified'});
});
test('expired email links never expose provider details or accept a token', () => {
  assert.deepEqual(readAuthCallback('#error=access_denied&error_description=sensitive&access_token=ignored&type=recovery'), {kind:'error',message:'This email link is invalid or expired. Request a new link.'});
  assert.equal(readAuthCallback('#unrelated-anchor'),null);
});
