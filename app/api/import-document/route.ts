import {inflateRawSync} from 'node:zlib';
export async function POST(request:Request){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,authorization=request.headers.get('authorization')||'';
 if(!url||!key)return Response.json({error:'Server configuration is incomplete'},{status:503});
 const auth=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,authorization},cache:'no-store'});if(!auth.ok)return Response.json({error:'Sign in required'},{status:401});
 try{const form=await request.formData(),file=form.get('file');if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.docx')||file.size>20000000)throw new Error('Choose a DOCX file under 20 MB.');
 const data=Buffer.from(await file.arrayBuffer());let end=-1;for(let i=data.length-22;i>=Math.max(0,data.length-65557);i--){if(data.readUInt32LE(i)===0x06054b50){end=i;break;}}if(end<0)throw new Error('Invalid DOCX archive');let cursor=data.readUInt32LE(end+16);const count=data.readUInt16LE(end+10);let document='';
 for(let i=0;i<count;i++){if(data.readUInt32LE(cursor)!==0x02014b50)throw new Error('Invalid archive directory');const method=data.readUInt16LE(cursor+10),size=data.readUInt32LE(cursor+20),unpacked=data.readUInt32LE(cursor+24),nameLength=data.readUInt16LE(cursor+28),extra=data.readUInt16LE(cursor+30),comment=data.readUInt16LE(cursor+32),offset=data.readUInt32LE(cursor+42),name=data.subarray(cursor+46,cursor+46+nameLength).toString('utf8');if(name==='word/document.xml'){if(unpacked>4000000)throw new Error('The document text exceeds the import limit.');const start=offset+30+data.readUInt16LE(offset+26)+data.readUInt16LE(offset+28);const compressed=data.subarray(start,start+size);if(method!==0&&method!==8)throw new Error('Unsupported document compression');document=(method===0?compressed:inflateRawSync(compressed,{maxOutputLength:4000000})).toString('utf8');break;}cursor+=46+nameLength+extra+comment;}
 if(!document)throw new Error('This file has no Word document content');
 const decode=(s:string)=>s.replace(/&#x([\da-f]+);/gi,(_,v)=>String.fromCodePoint(parseInt(v,16))).replace(/&#(\d+);/g,(_,v)=>String.fromCodePoint(Number(v))).replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&apos;',"'").replaceAll('&amp;','&');
 const paragraphs=[...document.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map(p=>[...p[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m=>decode(m[1])).join(''));
 return Response.json({title:file.name.replace(/\.docx$/i,''),text:paragraphs.join('\n\n')},{headers:{'cache-control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Import failed'},{status:400});}
}
