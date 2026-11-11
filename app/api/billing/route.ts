import {createHmac} from 'node:crypto';
import {z} from 'zod';
import {billingAccess,billingDb,billingMember,billingOrganization,billingOrderRpc,reconcile,snippePayment,type BillingOrder} from '@/lib/legal/billing-server';
import {starterPrice} from '@/lib/legal/snippe';

export const maxDuration = 45;
const input = z.discriminatedUnion('action',[
  z.object({action:z.literal('status'),organization_id:billingOrganization}),
  z.object({action:z.literal('trial'),organization_id:billingOrganization}),
  z.object({action:z.literal('reconcile'),organization_id:billingOrganization}),
  z.object({action:z.literal('checkout'),organization_id:billingOrganization,
    phone:z.string().regex(/^255[67]\d{8}$/),firstName:z.string().trim().min(1).max(80),
    lastName:z.string().trim().min(1).max(80)}),
]);
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
const latest=(org:string)=>billingDb<BillingOrder[]>('locke_billing_orders?organization_id=eq.'+org+'&order=created_at.desc&limit=1');
const checkoutReady=()=>process.env.LOCKE_SNIPPE_ENABLED==='1'&&!!process.env.LOCKE_SNIPPE_API_KEY&&!!process.env.LOCKE_SNIPPE_WEBHOOK_SECRET;

export async function POST(request:Request) {
  const parsed=input.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return reply({error:'Check your billing details and try again.'},400);
  const args=parsed.data, org=args.organization_id;
  try{
    const member=await billingMember(request,org);
    if(!member)return reply({error:'Verified workspace membership required.'},403);
    if(args.action!=='status'&&!member.canManage)return reply({error:'A workspace owner or admin manages billing.'},403);
    let order:BillingOrder|undefined;
    if(args.action==='trial'){
      await billingDb('rpc/locke_start_trial',{p_org:org});
    }else if(args.action==='reconcile'){
      [order]=await latest(org);
      if(order?.provider_reference&&order.status!=='completed'){
        const verified=await snippePayment('/'+encodeURIComponent(order.provider_reference));
        if(verified.reference!==order.provider_reference)throw new Error('Unexpected payment reference');
        order=await reconcile(order,verified);
      }
    }else if(args.action==='checkout'){
      if(!checkoutReady())return reply({error:'Mobile money checkout is not available yet.'},503);
      const customer={firstname:args.firstName,lastname:args.lastName,email:member.email};
      const details={amount:starterPrice,currency:'TZS'};
      const secret=process.env.LOCKE_SNIPPE_WEBHOOK_SECRET!;
      const digest=createHmac('sha256',secret).update(JSON.stringify([org,customer,args.phone])).digest('hex');
      order=await billingOrderRpc('locke_reserve_checkout',{p_org:org,p_digest:digest});
      if(!order.provider_reference){
        if(order.request_digest!==digest)return reply({error:'An earlier checkout is awaiting confirmation. Retry with its original details.'},409);
        if(Date.now()-Date.parse(order.created_at)>=23*60*60*1000)return reply({error:'This payment requires support to reconcile before retrying.'},409);
        const created=await snippePayment('',{key:order.id.replaceAll('-','').slice(0,30),body:{
          payment_type:'mobile',details,phone_number:args.phone,customer,
          webhook_url:'https://www.lockeslaw.xyz/api/billing/webhook',metadata:{locke_order_id:order.id},
        }});
        // Only an authenticated status lookup or signed callback can grant access.
        order=await reconcile(order,{...created,status:'pending'});
      }
    }
    if(!order)[order]=await latest(org);
    return reply({access:await billingAccess(org),canManage:member.canManage,checkoutEnabled:checkoutReady(),
      payment:order?{status:order.status,createdAt:order.created_at}:null});
  }catch{
    return reply({error:'Billing could not confirm this request. Check its status before retrying.'},503);
  }
}
