import {z} from 'zod';

const payment = z.object({
  reference: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  status: z.enum(['pending','completed','failed','voided','expired']),
  amount: z.object({value:z.number().int().positive(),currency:z.string()}),
});
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
    return Response.json({error:'Start a workspace trial or renew Starter in Billing.'},{status:402});
  }catch{
    return Response.json({error:'Billing access could not be verified. Try again shortly.'},{status:503});
  }
}

export async function snippePayment(path:string, options?:{key:string;body:Record<string,unknown>}) {
  const key=process.env.LOCKE_SNIPPE_API_KEY;
  if(!key)throw new Error('Checkout is unavailable');
  const response=await fetch('https://api.snippe.sh/v1/payments'+path,{
    method:options?'POST':'GET',headers:{authorization:'Bearer '+key,'content-type':'application/json',
      ...(options?{'Idempotency-Key':options.key}:{})},
    body:options?JSON.stringify(options.body):undefined,cache:'no-store',signal:AbortSignal.timeout(12000),
  });
  if(!response.ok)throw new Error('Snippe could not confirm the payment');
  return payment.parse((await response.json()).data);
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
