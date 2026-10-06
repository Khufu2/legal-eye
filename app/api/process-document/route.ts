import {z} from "zod";
import {createHash} from "node:crypto";
import {extractPrivateFile,privateChunks} from "@/lib/legal/private-extraction";
export const maxDuration=60;
const schema=z.object({document_id:z.string().uuid(),organization_id:z.string().uuid()});
export async function POST(request:Request){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,authorization=request.headers.get("authorization")||"";
 const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});
 if(!url||!key)return json({error:"Server configuration is incomplete"},503);
 if(!authorization.startsWith("Bearer "))return json({error:"Authentication required"},401);
 const headers={apikey:key,authorization};
 try{
 const input=schema.parse(await request.json());
 const user=await fetch(`${url}/auth/v1/user`,{headers,cache:"no-store"});if(!user.ok)return json({error:"Sign in required"},401);
 const result=await fetch(`${url}/rest/v1/documents?id=eq.${input.document_id}&organization_id=eq.${input.organization_id}&select=id,file_name,mime_type,storage_path,status`,{headers,cache:"no-store"});const docs=result.ok?await result.json():[];const doc=docs[0];if(!doc)return json({error:"Document not found or not authorized"},403);
 if(doc.status==="archived")return json({error:"Restore or upload an active document before processing"},409);
 if(!doc.storage_path)return json({error:"Document has no source file"},409);
 const source=await fetch(`${url}/storage/v1/object/authenticated/firm-vault/${doc.storage_path.split("/").map(encodeURIComponent).join("/")}`,{headers,cache:"no-store",signal:AbortSignal.timeout(15000)});if(!source.ok)return json({error:"Private source file could not be read"},source.status===403?403:502);
 const size=Number(source.headers.get("content-length")||0);if(size>20_971_520)return json({error:"File exceeds 20 MB"},413);
 const bytes=new Uint8Array(await source.arrayBuffer());const chunks=privateChunks(await extractPrivateFile(bytes,doc.file_name||"",doc.mime_type||""));
 const saved=await fetch(`${url}/rest/v1/rpc/replace_private_document_text`,{method:"POST",headers:{...headers,"content-type":"application/json"},body:JSON.stringify({p_document_id:doc.id,p_content_hash:createHash("sha256").update(bytes).digest("hex"),p_chunks:chunks}),cache:"no-store"});const payload=await saved.json().catch(()=>({}));if(!saved.ok)return json({error:payload.message||"Processed text could not be saved"},saved.status);
 return json({ok:true,status:"complete",searchable:true,chunks:payload,processing_mode:"text-extraction",engine:chunks.some(c=>c.ocr_requires_verification)?"tesseract-ocr":"unpdf-or-ooxml",requires_ocr:false,ocr_requires_verification:chunks.some(c=>c.ocr_requires_verification),engine_notice:chunks.some(c=>c.ocr_requires_verification)?'OCR text requires comparison with the original scan.':null});
 }catch(e){return json({error:e instanceof Error?e.message:"Document processing failed"},e instanceof z.ZodError?400:422);}
}
