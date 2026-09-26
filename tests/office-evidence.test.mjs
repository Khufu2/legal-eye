import test from 'node:test';
import assert from 'node:assert/strict';
import { draftOutlookReply, outlookSubject, replaceWordSelection } from '../lib/legal/office-host.ts';
import { verifyPublishedCitations } from '../lib/legal/evidence-validation.ts';
const host = item => ({ AsyncResultStatus: { Succeeded: 'ok' }, CoercionType: { Text: 'text' }, context: { mailbox: { item } } });
test('Outlook escapes model text and waits for host confirmation', async () => {
  let callback, body, complete = false;
  const promise = draftOutlookReply(host({ displayReplyFormAsync(data, done) { body = data.htmlBody; callback = done; } }), '<img src=x> &\nReply').then(() => complete = true);
  await Promise.resolve();
  assert.equal(complete, false);
  assert.equal(body, '&lt;img src=x&gt; &amp;<br>Reply');
  callback({ status: 'ok' }); await promise; assert.equal(complete, true);
});
test('Outlook compose inserts at cursor and propagates host failure', async () => {
  let replaced = false;
  await assert.rejects(draftOutlookReply(host({ body: { setAsync() { replaced = true; }, setSelectedDataAsync(text, options, done) { done({ status: 'failed', error: { message: 'Read only' } }); } } }), 'Reply'), /Read only/);
  assert.equal(replaced, false);
  assert.equal(await outlookSubject(host({ subject: { getAsync(done) { done({ status: 'ok', value: 'Compose subject' }); } } })), 'Compose subject');
});
test('Word refuses to overwrite a different selection', async () => {
  let writes = 0;
  const word = { run: fn => fn({ document: { getSelection: () => ({ text: 'Changed clause', load() {}, insertText() { writes++; } }) }, sync: async () => {} }) };
  await assert.rejects(replaceWordSelection(word, 'Original clause', 'New clause'), /selection changed/);
  assert.equal(writes, 0);
  await replaceWordSelection(word, 'Changed clause', 'New clause'); assert.equal(writes, 1);
});
test('Portal rejects invented quotes, foreign resources and whitespace-only citations', () => {
  const sources = [{ resource_id: 'published', label: 'Agreement', text: 'Notice must be given within 30 days.' }];
  const cite = { resource_id: 'published', label: 'Model label', quote: 'within 30 days.', page: 99 };
  assert.equal(verifyPublishedCitations([cite], sources)[0].label, 'Agreement');
  assert.equal(verifyPublishedCitations([cite], sources)[0].page, null);
  for (const bad of [{ ...cite, quote: 'within 60 days' }, { ...cite, resource_id: 'private' }, { ...cite, quote: '  ' }]) assert.throws(() => verifyPublishedCitations([bad], sources), /unsupported/);
});
