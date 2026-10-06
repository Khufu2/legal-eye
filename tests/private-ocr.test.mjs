import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {recognizeScannedPages} from '../lib/legal/private-ocr.ts';
import {createWorker} from 'tesseract.js';
import {createRequire} from 'node:module';
import {extractPrivateFile,privateChunks} from '../lib/legal/private-extraction.ts';
import {dirname,join} from 'node:path';
import {tmpdir} from 'node:os';
test('OCR rejects excessive page fan-out before loading a language model',async()=>{
 await assert.rejects(recognizeScannedPages({},Array.from({length:21},(_,i)=>i+1)),/20-page OCR limit/);
});
test('local OCR reads an actual raster agreement without a remote provider',{timeout:60000},async()=>{
 const require=createRequire(import.meta.url);const canvas=createCanvas(1100,360);const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1100,360);ctx.fillStyle='black';ctx.font='32px sans-serif';ctx.fillText('CONFIDENTIALITY AGREEMENT',50,70);ctx.fillText('The recipient must keep information secret.',50,140);ctx.fillText('Written notice is thirty days.',50,210);
 const langPath=join(dirname(require.resolve('@tesseract.js-data/eng/package.json')),'4.0.0');
 const worker=await createWorker('eng',1,{langPath,gzip:true,cacheMethod:'none',cachePath:tmpdir()});
 try{const {data:result}=await worker.recognize(canvas.toBuffer('image/png'));assert.match(result.text,/CONFIDENTIALITY AGREEMENT/);assert.match(result.text,/thirty days/);assert.ok(result.confidence>70);}finally{await worker.terminate();}
});

// A real image-only PDF exercises PDF rendering, OCR and persisted chunk metadata.
test('image-only PDF enters OCR and preserves the review warning',{timeout:60000},async()=>{
 const canvas=createCanvas(1100,360),ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1100,360);ctx.fillStyle='black';ctx.font='32px sans-serif';ctx.fillText('CONFIDENTIALITY AGREEMENT',50,70);ctx.fillText('Written notice is thirty days.',50,140);
 const jpeg=canvas.toBuffer('image/jpeg');
 const objects=[Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 550 180] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>'),Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width 1100 /Height 360 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),jpeg,Buffer.from('\nendstream')]),Buffer.from('<< /Length 32 >>\nstream\nq 550 0 0 180 0 0 cm /Im0 Do Q\nendstream')];
 let pdf=Buffer.from('%PDF-1.4\n'),offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(pdf.length);pdf=Buffer.concat([pdf,Buffer.from(`${i+1} 0 obj\n`),objects[i],Buffer.from('\nendobj\n')]);}const xref=pdf.length;pdf=Buffer.concat([pdf,Buffer.from(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`)]);
 const chunks=privateChunks(await extractPrivateFile(new Uint8Array(pdf),'scan.pdf','application/pdf'));assert.match(chunks[0].content,/CONFIDENTIALITY AGREEMENT/);assert.equal(chunks[0].page_number,1);assert.equal(chunks[0].ocr_requires_verification,true);assert.ok(chunks[0].ocr_confidence>70);
});
