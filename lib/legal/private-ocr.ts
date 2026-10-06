import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createWorker} from 'tesseract.js';
import {renderPageAsImage,type getDocumentProxy} from 'unpdf';
// Traced server assets live beside the application under node_modules.
const packageRoot=join(process.cwd(),'node_modules');
export type OcrPage={page_number:number;content:string;ocr_confidence:number;ocr_requires_verification:true};
/** Local OCR: private file bytes never leave the application runtime. */
export async function recognizeScannedPages(pdf:Awaited<ReturnType<typeof getDocumentProxy>>,pageNumbers:number[]){
 if(pageNumbers.length>20)throw new Error('This scan exceeds the 20-page OCR limit. Split it into smaller PDFs and retry.');
 const langPath=join(packageRoot,'@tesseract.js-data/eng/4.0.0');
 const worker=await createWorker('eng',1,{langPath,gzip:true,cachePath:tmpdir(),cacheMethod:'none',workerPath:join(packageRoot,'tesseract.js/src/worker-script/node/index.js'),corePath:join(packageRoot,'tesseract.js-core')});
 const pages:OcrPage[]=[];const deadline=Date.now()+40000;
 try{
 for(const pageNumber of pageNumbers){
  if(Date.now()>deadline)throw new Error('OCR reached its processing time limit. Split this PDF into smaller files and retry.');
  const page=await pdf.getPage(pageNumber);const viewport=page.getViewport({scale:1});const scale=Math.min(2,Math.sqrt(4_000_000/(viewport.width*viewport.height)));
  const image=await renderPageAsImage(pdf,pageNumber,{canvasImport:()=>import('@napi-rs/canvas'),scale});
  let timer:ReturnType<typeof setTimeout>|undefined;
  const result=await Promise.race([worker.recognize(Buffer.from(image)),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('OCR timed out. Split this scan and retry.')),Math.max(1000,deadline-Date.now()));})]).finally(()=>clearTimeout(timer));
  if(result.data.text.trim())pages.push({page_number:pageNumber,content:result.data.text,ocr_confidence:result.data.confidence,ocr_requires_verification:true});
 }
 return pages;
 }finally{await worker.terminate();}
}
