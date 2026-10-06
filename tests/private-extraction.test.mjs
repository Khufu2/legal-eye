import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocx} from '../lib/legal/docx.ts';
import {docxText,extractPrivateFile,privateChunks} from '../lib/legal/private-extraction.ts';
test('private Word extraction roundtrips legal text without treating XML as instructions',()=>{
 const bytes=createDocx('Agreement','Confidentiality & duty < disclosure.\nNotice is 30 days.');
 assert.match(docxText(bytes),/Confidentiality & duty < disclosure/);
 assert.match(docxText(bytes),/Notice is 30 days/);
});
test('private text preserves source pages and bounded overlapping passages',()=>{
 const text='A'.repeat(8200);const chunks=privateChunks([{page_number:7,content:text}]);
 assert.equal(chunks.length,3);assert.ok(chunks.every(c=>c.page_number===7&&c.content.length<=4000));
 assert.deepEqual(chunks.map(c=>c.reading_order),[0,1,2]);
 assert.throws(()=>privateChunks([{page_number:1,content:' '}]),/No readable text/);
});
test('unsupported files and oversized source text fail explicitly',async()=>{
 await assert.rejects(extractPrivateFile(new Uint8Array([1,2]),'sheet.xlsx','application/octet-stream'),/Choose a PDF, DOCX/);
 assert.throws(()=>privateChunks([{page_number:null,content:'x'.repeat(2_000_001)}]),/processing limit/);
});
