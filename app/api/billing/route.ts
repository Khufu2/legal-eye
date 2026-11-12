import {createHmac} from 'node:crypto';
import {z} from 'zod';
import {billingAccess,billingDb,billingMember,billingOrganization,billingOrderRpc,createSnippePayment,findSnippePayment,reconcile,rejectUncreatedPayment,SnippeError,snippePayment,type BillingOrder} from '@/lib/legal/billing-server';
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
const checkoutReady=()=>process.env.LOCKE_SNIPPE_ENABLED==='1'&&!!process.env.LOCKE_SNIPPE_API_KEY?.trim()&&!!process.env.LOCKE_SNIPPE_WEBHOOK_SECRET;

export async function POST(request:Request) {
  const parsed=input.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return reply({error:'Check your billing details and try again.'},400);
  const args=parsed.data, org=args.organization_id;
  let stage='membership';
  try{
    const member=await billingMember(request,org);
    if(!member)return reply({error:'Verified workspace membership required.'},403);
    if(args.action!=='status'&&!member.canManage)return reply({error:'A workspace owner or admin manages billing.'},403);
    let order:BillingOrder|undefined;
    stage=args.action;
    if(args.action==='trial'){
      await billingDb('rpc/locke_start_trial',{p_org:org});
    }else if(args.action==='reconcile'){
      [order]=await latest(org);
      if(order&&['creating','pending'].includes(order.status)){
        const reference=order.provider_reference||await findSnippePayment(order);
        if(!reference)return reply({error:'Snippe has not returned a reference for this request. If the request is recent, retry with the same details. Contact Locke support if it has been more than 23 hours.'},409);
        const verified=await snippePayment('/'+encodeURIComponent(reference));
        if(verified.reference!==reference)throw new Error('Unexpected payment reference');
        order=await reconcile(order,verified);
      }
    }else if(args.action==='checkout'){
      if(!checkoutReady())return reply({error:'Mobile money checkout is not available yet.'},503);
      const customer={firstname:args.firstName,lastname:args.lastName,email:member.email};
      const details={amount:starterPrice,currency:'TZS'};
      const secret=process.env.LOCKE_SNIPPE_WEBHOOK_SECRET!;
      const digest=createHmac('sha256',secret).update(JSON.stringify([org,customer,args.phone])).digest('hex');
      stage='reserve';
      order=await billingOrderRpc('locke_reserve_checkout',{p_org:org,p_digest:digest});
      if(!order.provider_reference){
        if(order.request_digest!==digest)return reply({error:'An earlier checkout is awaiting confirmation. Retry with its original details.'},409);
        if(Date.now()-Date.parse(order.created_at)>=23*60*60*1000)return reply({error:'This payment requires support to reconcile before retrying.'},409);
        stage='create_payment';
        let reference:string;
        try{
          reference=await createSnippePayment({key:order.id.replaceAll('-','').slice(0,30),body:{
            payment_type:'mobile',details,phone_number:args.phone,customer,
            webhook_url:'https://app.lockeslaw.xyz/api/billing/webhook',metadata:{locke_order_id:order.id},
          }});
        }catch(error){
          if(error instanceof SnippeError&&error.httpStatus===400&&error.code==='validation_error'){
            console.warn('Locke Snippe rejected checkout',{status:error.httpStatus,code:error.code});
            await rejectUncreatedPayment(order);
            return reply({error:'Snippe rejected the payment details. Check the name and mobile-money number and try again.'},422);
          }
          throw error;
        }
        // Attach the reference without granting access. Reconciliation verifies amount and currency with Snippe.
        stage='attach_payment';
        order=await reconcile(order,{reference,status:'pending',amount:{value:order.amount,currency:order.currency}});
      }
    }
    stage='load_access';
    if(!order)[order]=await latest(org);
    return reply({access:await billingAccess(org),canManage:member.canManage,checkoutEnabled:checkoutReady(),
      payment:order?{status:order.status,createdAt:order.created_at}:null});
  }catch(error){
    if(error instanceof SnippeError){
      console.warn('Locke Snippe request failed',{stage,status:error.httpStatus,code:error.code});
      if(error.httpStatus===401||error.httpStatus===403){
        return reply({error:'Locke could not connect to Snippe with its current credentials. Contact Locke support before retrying.'},503);
      }
      if(error.httpStatus===422){
        return reply({error:'Snippe found a conflicting checkout. Check payment status or contact Locke support.'},409);
      }
    }else{
      console.error('Locke billing request failed',{stage});
    }
    const message=args.action==='trial'?'We could not start your trial. Please try again.':
      args.action==='status'?'Workspace billing could not be loaded. Please try again.':
      'Billing could not confirm this payment. Check its status before retrying.';
    return reply({error:message},503);
  }
}
