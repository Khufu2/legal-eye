import {createHmac} from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {verifySnippeSignature,starterPrice} from '../lib/legal/snippe.ts';
import {workflowLibrary} from '../lib/legal/workflow-library.ts';

test('Snippe webhook requires signed raw body and rejects old or future timestamps',()=>{
  const body='{"id":"evt-test"}', timestamp='1794429500', secret='test-signing-key';
  const now=Number(timestamp)*1000;
  const signature=createHmac('sha256',secret).update(timestamp+'.'+body).digest('hex');
  assert.equal(verifySnippeSignature(body,timestamp,signature,secret,now),true);
  assert.equal(verifySnippeSignature(body+' ',timestamp,signature,secret,now),false);
  assert.equal(verifySnippeSignature(body,timestamp,signature,'wrong',now),false);
  assert.equal(verifySnippeSignature(body,timestamp,signature,secret,now+301_000),false);
  assert.equal(verifySnippeSignature(body,timestamp,signature,secret,now-301_000),false);
  assert.equal(starterPrice,49_000);
});

test('all built-in workflows end with a lawyer checkpoint and file-dependent templates begin with review',()=>{
  assert.equal(workflowLibrary.length,10);
  assert.equal(new Set(workflowLibrary.map(template=>template.id)).size,workflowLibrary.length);
  for(const template of workflowLibrary){
    assert.equal(template.steps.at(-1).type,'human_checkpoint');
    if(template.requiresFiles)assert.equal(template.steps[0].type,'review');
    assert.equal(new Set(template.steps.map(step=>step.key)).size,template.steps.length);
  }
});
