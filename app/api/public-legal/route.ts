import {createHmac} from 'node:crypto';
import {z} from 'zod';
import {billingDb} from '@/lib/legal/billing-server';
import {corpusQueries,officialSourceUrl,practiceAreas,type PublicSource} from '@/lib/legal/public-legal';

const area=z.enum(Object.keys(practiceAreas) as [keyof typeof practiceAreas,...(keyof typeof practiceAreas)[]]);
const schema=z.discriminatedUnion('action',[
  z.object({action:z.literal('search'),query:z.string().trim().min(3).max(140)}),
  z.object({action:z.literal('directory')}),
  z.object({action:z.literal('request'),advocate:z.string().uuid(),area,name:z.string().trim().min(2).max(100),
    email:z.string().trim().email().max(254),locale:z.enum(['en','sw']),consent:z.literal(true),website:z.string().max(0).optional()}),
]);
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const activeDirectory='state=eq.verified&checked_at=gt.';

async function search(query:string) {
  const origin=process.env.LEGAL_CORPUS_URL?.replace(/\/$/,'');
  const token=process.env.LEGAL_CORPUS_SEARCH_TOKEN;
  if(!origin||!token)throw new Error('Corpus unavailable');
  const results=await Promise.allSettled(corpusQueries(query).map(async q=>{
    const response=await fetch(origin+'/search',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
      body:JSON.stringify({query:q,jurisdictions:['TZ'],limit:12}),cache:'no-store',signal:AbortSignal.timeout(9000)});
    if(!response.ok)throw new Error('Corpus unavailable');
    return await response.json() as {as_of?:string;evidence?:Record<string,unknown>[]};
  }));
  const sources=new Map<string,PublicSource>();
  let available=false, asOf:string|null=null;
  for(const result of results){
    if(result.status!=='fulfilled')continue;
    available=true;
    asOf??=result.value.as_of||null;
    for(const entry of result.value.evidence||[]){
      if(entry.jurisdiction_code!=='TZ'||typeof entry.title!=='string')continue;
      const url=officialSourceUrl(entry.canonical_url)||officialSourceUrl(entry.source_url);
      if(!url||sources.has(url))continue;
      sources.set(url,{url,title:entry.title.slice(0,250),citation:typeof entry.citation==='string'?entry.citation.slice(0,100):null,
        publisher:typeof entry.source_name==='string'?entry.source_name.slice(0,120):null,
        excerpt:typeof entry.content==='string'?entry.content.replace(/\s+/g,' ').trim().slice(0,320):'',
        page:typeof entry.page_number==='number'?entry.page_number:null});
      if(sources.size===6)break;
    }
    if(sources.size===6)break;
  }
  if(!available)throw new Error('Corpus unavailable');
  return {sources:[...sources.values()],asOf};
}

export async function POST(request:Request) {
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return reply({error:'invalid'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'invalid'},415);
  const raw=await request.text();
  if(raw.length>2048)return reply({error:'invalid'},413);
  let value:unknown;
  try{value=JSON.parse(raw);}catch{return reply({error:'invalid'},400);}
  const parsed=schema.safeParse(value);
  if(!parsed.success)return reply({error:'invalid'},400);
  const input=parsed.data;
  try{
    if(input.action==='search')return reply(await search(input.query));
    if(input.action==='directory'){
      const since=encodeURIComponent(new Date(Date.now()-90*86400000).toISOString());
      const advocates=await billingDb('locke_public_advocates?select=id,name,firm,roll,city,areas,checked_at&'+activeDirectory+since+'&order=name.asc&limit=500');
      return reply({advocates});
    }
    const key=process.env.LOCKE_BILLING_SUPABASE_SERVICE_ROLE_KEY;
    if(!key)throw new Error('Unavailable');
    const ip=request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
    const email=input.email.toLowerCase();
    const requester=createHmac('sha256',key).update('consultation:'+ (ip||email)).digest('hex');
    const result=await billingDb<string>('rpc/locke_request_consultation',{p_advocate:input.advocate,p_area:input.area,p_name:input.name,
      p_email:email,p_locale:input.locale,p_requester:requester});
    if(result==='unavailable')return reply({error:'listing'},409);
    if(result==='limited')return reply({error:'limited'},429);
    if(result!=='received')throw new Error('Unavailable');
    return reply({received:true},202);
  }catch{return reply({error:'unavailable'},503);}
}
