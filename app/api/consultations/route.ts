import {z} from 'zod';
import {billingDb,billingMember,billingOrganization} from '@/lib/legal/billing-server';
import {practiceAreas} from '@/lib/legal/public-legal';

const area=z.enum(Object.keys(practiceAreas) as [keyof typeof practiceAreas,...(keyof typeof practiceAreas)[]]);
const schema=z.discriminatedUnion('action',[
  z.object({action:z.literal('list'),organization_id:billingOrganization}),
  z.object({action:z.literal('submit'),organization_id:billingOrganization,name:z.string().trim().min(3).max(120),
    firm:z.string().trim().min(2).max(120),roll:z.string().trim().toUpperCase().regex(/^[A-Z0-9/-]{1,30}$/),
    city:z.string().trim().min(2).max(60),areas:z.array(area).min(1).max(8),consent:z.literal(true)}),
  z.object({action:z.literal('update'),organization_id:billingOrganization,id:z.string().uuid(),status:z.enum(['contacted','closed'])}),
  z.object({action:z.literal('withdraw'),organization_id:billingOrganization,id:z.string().uuid()}),
]);
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});

export async function POST(request:Request) {
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return reply({error:'Check the form details and try again.'},400);
  const input=parsed.data, org=input.organization_id;
  try{
    const member=await billingMember(request,org);
    if(!member?.canManage)return reply({error:'A verified workspace owner or admin manages public listings and consultation requests.'},403);
    if(input.action==='submit'){
      await billingDb('rpc/locke_submit_advocate',{p_org:org,p_name:input.name,p_firm:input.firm,p_roll:input.roll,p_city:input.city,p_areas:[...new Set(input.areas)].sort()});
    }
    if(input.action==='update'){
      const updated=await billingDb('rpc/locke_manage_consultation',{p_org:org,p_id:input.id,p_status:input.status});
      if(!updated)return reply({error:'That consultation is unavailable.'},404);
    }
    if(input.action==='withdraw'){
      const updated=await billingDb('rpc/locke_withdraw_advocate',{p_org:org,p_id:input.id});
      if(!updated)return reply({error:'That listing is unavailable.'},404);
    }
    const since=encodeURIComponent(new Date(Date.now()-90*86400000).toISOString());
    const [listings,requests]=await Promise.all([
      billingDb('locke_public_advocates?select=id,name,firm,roll,city,areas,state,checked_at&organization_id=eq.'+org+'&order=created_at.desc&limit=50'),
      billingDb('locke_consultation_requests?select=id,name,email,area,locale,status,created_at,locke_public_advocates!inner(name)&locke_public_advocates.organization_id=eq.'+org+'&created_at=gt.'+since+'&order=created_at.desc&limit=100'),
    ]);
    return reply({listings,requests});
  }catch{return reply({error:'Consultations are temporarily unavailable or the roll number is already registered.'},503);}
}
