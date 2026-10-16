import { filterTelemetry } from '@/lib/telemetry-policy';
export async function POST(request: Request) {
  const headers={'cache-control':'no-store'};
  const origin=request.headers.get('origin');
  if (!origin || origin!==new URL(request.url).origin || request.headers.get('sec-fetch-site')==='cross-site') return new Response(null,{status:403,headers});
  if (!request.headers.get('content-type')?.startsWith('application/json')) return new Response(null,{status:415,headers});
  if (Number(request.headers.get('content-length')||0)>2048) return new Response(null,{status:413,headers});
  const reader=request.body?.getReader();if(!reader)return new Response(null,{status:400,headers});
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048){await reader.cancel();return new Response(null,{status:413,headers});}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  let event;try{event=filterTelemetry(JSON.parse(new TextDecoder().decode(bytes)));}catch{return new Response(null,{status:400,headers});}
  if(!event)return new Response(null,{status:400,headers});
  const apiKey=process.env.POSTHOG_PROJECT_TOKEN;
  if(!apiKey)return new Response(null,{status:204,headers});
  const host=process.env.POSTHOG_HOST||'https://us.i.posthog.com';
  if(!['https://us.i.posthog.com','https://eu.i.posthog.com'].includes(host))return new Response(null,{status:503,headers});
  try {
    const response=await fetch(host+'/i/v0/e/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({api_key:apiKey,...event}),signal:AbortSignal.timeout(3000)});
    return new Response(null,{status:response.ok?204:502,headers});
  } catch {return new Response(null,{status:502,headers});}
}
