import {z} from 'zod';
import {billingDb,reconcile,snippePayment,type BillingOrder} from '@/lib/legal/billing-server';
import {verifySnippeSignature} from '@/lib/legal/snippe';

const eventSchema=z.object({type:z.string(),data:z.object({
  reference:z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  metadata:z.object({locke_order_id:z.string().uuid().optional()}).optional(),
})});

export async function POST(request:Request) {
  const secret=process.env.LOCKE_SNIPPE_WEBHOOK_SECRET||'';
  const raw=await request.text();
  if(raw.length>64_000||!verifySnippeSignature(raw,request.headers.get('x-webhook-timestamp')||'',
    request.headers.get('x-webhook-signature')||'',secret))return new Response(null,{status:401});
  let event;
  try{event=eventSchema.parse(JSON.parse(raw));}catch{return new Response(null,{status:400});}
  if(!['payment.completed','payment.failed','payment.voided','payment.expired'].includes(event.type))return new Response(null,{status:204});
  const reference=event.data.reference;
  try{
    let [order]=await billingDb<BillingOrder[]>('locke_billing_orders?provider_reference=eq.'+reference);
    if(!order&&event.data.metadata?.locke_order_id){
      [order]=await billingDb<BillingOrder[]>('locke_billing_orders?id=eq.'+event.data.metadata.locke_order_id);
    }
    if(!order)return new Response(null,{status:204});
    if(order.provider_reference&&order.provider_reference!==reference)return new Response(null,{status:409});
    const verified=await snippePayment('/'+encodeURIComponent(reference));
    if(verified.reference!==reference||verified.status==='pending')return new Response(null,{status:503});
    await reconcile(order,verified);
    return new Response(null,{status:204});
  }catch{return new Response(null,{status:503});}
}
