import test from 'node:test';
import assert from 'node:assert/strict';
import {driveDownload, readDriveFile, GOOGLE_DOC_MIME, DOCX_MIME, DRIVE_LIMIT} from '../lib/legal/google-drive.ts';
test('selected Google documents export to DOCX without accepting arbitrary download URLs', () => {
  const file = driveDownload('document_123', GOOGLE_DOC_MIME, 'Agreement');
  assert.equal(file.name, 'Agreement.docx');
  assert.equal(file.mime, DOCX_MIME);
  assert.match(file.url, /^https:\/\/www.googleapis.com\/drive\/v3\/files\/document_123\/export\?/);
  for (const id of ['../private', 'https://example.com', 'abc?alt=media', '']) assert.throws(() => driveDownload(id, DOCX_MIME, 'x'));
  assert.throws(() => driveDownload('abc', 'application/vnd.google-apps.spreadsheet', 'x'), /Choose/);
});
test('Google downloads enforce size even when content length is missing', async () => {
  let cancelled = false;
  const stream = new ReadableStream({start(c) {c.enqueue(new Uint8Array(DRIVE_LIMIT + 1));}, cancel() {cancelled = true;}});
  await assert.rejects(readDriveFile(new Response(stream), 'large.pdf', 'application/pdf'), /under 20 MB/);
  assert.equal(cancelled, true);
});
test('Google downloads preserve the source bytes and explain denied access', async () => {
  const file = await readDriveFile(new Response('Source text'), 'source.txt', 'text/plain');
  assert.equal(await file.text(), 'Source text');
  assert.equal(file.name, 'source.txt');
  await assert.rejects(readDriveFile(new Response(null, {status: 401}), 'x', 'text/plain'), /expired/);
  await assert.rejects(readDriveFile(new Response(null, {status: 403}), 'x', 'text/plain'), /denied access/);
  await assert.rejects(readDriveFile(new Response(''), 'x', 'text/plain'), /empty/);
});
