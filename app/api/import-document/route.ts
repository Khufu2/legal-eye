import {docxText} from '@/lib/legal/private-extraction';
export async function POST(request:Request){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,authorization=request.headers.get('authorization')||'';
 if(!url||!key)return Response.json({error:'Server configuration is incomplete'},{status:503});
 const auth=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,authorization},cache:'no-store'});if(!auth.ok)return Response.json({error:'Sign in required'},{status:401});
 try{const form=await request.formData(),file=form.get('file');if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.docx')||file.size>20000000)throw new Error('Choose a DOCX file under 20 MB.');
 return Response.json({title:file.name.replace(/\.docx$/i,''),text:docxText(new Uint8Array(await file.arrayBuffer()))},{headers:{'cache-control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Import failed'},{status:400});}
}
