import {createHash,timingSafeEqual} from 'node:crypto';
import {extractText,getDocumentProxy} from 'unpdf';
import {z} from 'zod';
import {buildDeltaTokens} from '@/lib/legal/corpus-index';
export const maxDuration=60;
const schema=z.object({external_id:z.string().min(1).max(200),jurisdiction_code:z.literal('TZ'),title:z.string().max(500),citation:z.string().nullable().optional(),document_type:z.string().max(80),canonical_url:z.string().url(),source_url:z.string().url(),content_sha256:z.string().regex(/^[a-f0-9]{64}$/),published_at:z.string().nullable().optional()});
const allowed=(value:string)=>{const url=new URL(value);if(url.protocol!=='https:'||url.hostname!=='oagmis.oag.go.tz'||url.username||url.password||url.port)throw new Error('Unapproved source URL');return url.href;};
export async function POST(request:Request){
 const secret=process.env.LEGAL_CORPUS_INGEST_TOKEN,url=process.env.LEGAL_CORPUS_URL;
 const presented=request.headers.get('authorization')||'',expected=`Bearer ${secret}`;
 if(!secret||!url)return Response.json({error:'Source refresh unavailable'},{status:503});
 if(presented.length!==expected.length||!timingSafeEqual(Buffer.from(presented),Buffer.from(expected)))return Response.json({error:'Unauthorized'},{status:401});
 try{
 const doc=schema.parse(await request.json());allowed(doc.canonical_url);
 const upstream=await fetch(allowed(doc.source_url),{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});
 if(!upstream.ok)throw new Error(`Official source returned ${upstream.status}`);
 const reader=upstream.body?.getReader();if(!reader)throw new Error('Empty official source');const parts:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>20_971_520)throw new Error('Official source exceeds 20 MB refresh limit');parts.push(value);}}finally{await reader.cancel();}
 const bytes=Buffer.concat(parts),hash=createHash('sha256').update(bytes).digest('hex');if(hash===doc.content_sha256)return Response.json({state:'unchanged',content_sha256:hash});
 if(bytes.subarray(0,5).toString()!=='%PDF-')throw new Error('Source refresh requires a text-based official PDF');
 const pdf=await getDocumentProxy(new Uint8Array(bytes));let pages:string[];
 try{if(pdf.numPages>500)throw new Error('Official source exceeds page limit');pages=(await extractText(pdf,{mergePages:false})).text;}finally{await (pdf as unknown as {destroy?:()=>Promise<void>}).destroy?.();}
 const chunks=pages.flatMap((text,i)=>{const result=[];for(let offset=0;offset<text.length;offset+=7600){const content=text.slice(offset,offset+8000).trim();if(content)result.push({content,page_number:i+1,source_node_ref:`page/${i+1}/text/${offset}`});if(offset+8000>=text.length)break;}return result;});
 if(!chunks.length||chunks.length>1000)throw new Error('Official source needs OCR or exceeds passage limit');
 const document={...doc,content_sha256:hash,chunks,retrieved_at:new Date().toISOString(),parser_version:'unpdf-source-refresh-v1',version_notice:'Source file changed; legal effect, amendments and currentness require lawyer verification.'};
 const form=new FormData();form.set('raw',new Blob([bytes],{type:'application/pdf'}),'source.pdf');form.set('document',JSON.stringify(document));
 const headers={authorization:`Bearer ${secret}`};const ingested=await fetch(`${url}/ingest`,{method:'POST',headers,body:form,signal:AbortSignal.timeout(15000)});if(!ingested.ok)throw new Error('Verified source storage failed');const receipt=await ingested.json();
 const tokens=buildDeltaTokens(doc.title+' '+chunks.map(c=>c.content).join(' '));
 const published=await fetch(`${url}/delta-publish`,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({id:receipt.id,document_key:receipt.document_key,tokens}),signal:AbortSignal.timeout(15000)});if(!published.ok)throw new Error('Source stored; search publication requires retry');
 return Response.json({state:'updated',content_sha256:hash,document_key:receipt.document_key,chunks:chunks.length,currentness_verified:false});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Source refresh failed'},{status:422});}
}
