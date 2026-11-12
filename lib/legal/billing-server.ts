import {z} from 'zod';

const reference=z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const positiveAmount=z.union([z.number(),z.string().regex(/^\d+$/).transform(Number)])
  .pipe(z.number().int().positive());
const money=z.object({value:positiveAmount,currency:z.string()});
const payment=z.object({
  reference,
  status:z.enum(['pending','completed','failed','voided','expired']),
  amount:z.union([money,positiveAmount]),
  currency:z.string().optional(),
}).transform(({amount,currency,...data})=>({
  ...data,amount:typeof amount==='number'?{value:amount,currency:currency||''}:amount,
}));
const snippeErrors=z.enum(['unauthorized','insufficient_scope','validation_error','rate_limit_exceeded','PAY_001','payment_failed','not_found','conflict']);

export class SnippeError extends Error {
  constructor(readonly httpStatus:number,readonly code:string) {
    super('Snippe request failed');
  }
}
export const billingOrganization = z.string().uuid();
export type BillingOrder = {
  id:string; organization_id:string; request_digest:string; status:string;
  amount:number; currency:string; provider_reference:string|null; created_at:string;
};
type Access = {trial_ends_at:string|null;paid_until:string|null};

export async function billingDb<T>(path:string, body?:Record<string,unknown>): Promise<T> {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.LOCKE_BILLING_SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error('Billing database is unavailable');
  const response=await fetch(url+'/rest/v1/'+path,{
    method:body?'POST':'GET',headers:{apikey:key,authorization:'Bearer '+key,'content-type':'application/json'},
    body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(8000),
  });
  if(!response.ok)throw new Error('Billing database request failed');
  const raw=await response.text();
  return (raw?JSON.parse(raw):null) as T;
}

export async function billingMember(request:Request,organizationId:string) {
  const authorization=request.headers.get('authorization')||'';
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key||!authorization.startsWith('Bearer '))return null;
  const headers={apikey:key,authorization};
  const auth=await fetch(url+'/auth/v1/user',{headers,cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(!auth.ok)return null;
  const user=z.object({id:z.string().uuid(),email:z.string().email(),email_confirmed_at:z.string()}).safeParse(await auth.json());
  if(!user.success)return null;
  const members=await fetch(url+'/rest/v1/organization_members?select=role&organization_id=eq.'+organizationId+'&user_id=eq.'+user.data.id+'&is_active=is.true&limit=1',{headers,cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(!members.ok)throw new Error('Membership lookup failed');
  const [member]=await members.json() as {role:string}[];
  return member?{email:user.data.email,canManage:['owner','admin'].includes(member.role)}:null;
}

export async function billingAccess(organizationId:string) {
  const [access]=await billingDb<Access[]>('locke_billing_access?select=trial_ends_at,paid_until&organization_id=eq.'+organizationId);
  return access||{trial_ends_at:null,paid_until:null};
}

export async function billingGate(organizationId:string) {
  if(process.env.LOCKE_BILLING_ENFORCED!=='1')return null;
  try{
    const access=await billingAccess(organizationId);
    if([access.paid_until,access.trial_ends_at].some(end=>end&&Date.parse(end)>Date.now()))return null;
    return Response.json({error:'Start a workspace trial or renew Starter in Settings.'},{status:402});
  }catch{
    return Response.json({error:'Billing access could not be verified. Try again shortly.'},{status:503});
  }
}

async function snippeRequest(path:string, options?:{key:string;body:Record<string,unknown>}) {
  const key=process.env.LOCKE_SNIPPE_API_KEY?.trim();
  if(!key)throw new SnippeError(0,'missing_key');
  const response=await fetch('https://api.snippe.sh/v1/payments'+path,{
    method:options?'POST':'GET',headers:{authorization:'Bearer '+key,'content-type':'application/json',
      ...(options?{'Idempotency-Key':options.key}:{})},
    body:options?JSON.stringify(options.body):undefined,cache:'no-store',signal:AbortSignal.timeout(12000),
  }).catch(()=>{throw new SnippeError(0,'network_error');});
  const raw=await response.json().catch(()=>null);
  if(!response.ok||raw?.status==='error'){
    const code=snippeErrors.safeParse(raw?.error_code);
    throw new SnippeError(response.status,code.success?code.data:'unknown_error');
  }
  return raw?.data;
}

export async function snippePayment(path:string) {
  const result=payment.safeParse(await snippeRequest(path));
  if(!result.success||!result.data.amount.currency)throw new SnippeError(200,'invalid_payment_status');
  return result.data;
}

export async function createSnippePayment(options:{key:string;body:Record<string,unknown>}) {
  // Creation only attaches the provider reference. Verified status is checked separately.
  const result=z.object({reference}).safeParse(await snippeRequest('',options));
  if(!result.success)throw new SnippeError(200,'missing_payment_reference');
  return result.data.reference;
}

export async function findSnippePayment(order:BillingOrder) {
  const list=z.object({items:z.array(z.object({
    reference,metadata:z.object({locke_order_id:z.string().optional()}).nullish(),
  }))}).safeParse(await snippeRequest('?limit=100'));
  if(!list.success)throw new SnippeError(200,'invalid_payment_list');
  const matches=list.data.items.filter(item=>item.metadata?.locke_order_id===order.id);
  return matches.length===1?matches[0].reference:null;
}

export async function rejectUncreatedPayment(order:BillingOrder) {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.LOCKE_BILLING_SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error('Billing database is unavailable');
  const filter='id=eq.'+order.id+'&status=eq.creating&provider_reference=is.null';
  const response=await fetch(url+'/rest/v1/locke_billing_orders?'+filter,{
    method:'PATCH',headers:{apikey:key,authorization:'Bearer '+key,'content-type':'application/json'},
    body:JSON.stringify({status:'failed'}),cache:'no-store',signal:AbortSignal.timeout(8000),
  });
  if(!response.ok)throw new Error('Billing rejection could not be recorded');
}

export async function billingOrderRpc(name:string, body:Record<string,unknown>) {
  const result=await billingDb<BillingOrder|BillingOrder[]>('rpc/'+name,body);
  const order=Array.isArray(result)?result[0]:result;
  if(!order?.id)throw new Error('Billing order was not returned');
  return order;
}

export function reconcile(order:BillingOrder, verified:z.infer<typeof payment>) {
  return billingOrderRpc('locke_reconcile_checkout',{
    p_order:order.id,p_ref:verified.reference,p_status:verified.status,
    p_amount:verified.amount.value,p_currency:verified.amount.currency,
  });
}
