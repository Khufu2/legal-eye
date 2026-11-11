'use client';

import {useEffect,useState,type FormEvent} from 'react';
import {action,type Identity} from '@/lib/legal/client';
import {Button} from './ui/button';
import {Input} from './ui/input';

type BillingStatus={
  access:{trial_ends_at:string|null;paid_until:string|null};
  canManage:boolean;
  checkoutEnabled:boolean;
  payment:{status:string;createdAt:string}|null;
};

function dateLabel(value:string) {
  return new Intl.DateTimeFormat('en-TZ',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Dar_es_Salaam'}).format(new Date(value));
}

export function LockeBilling({identity,connect}:{identity:Identity|null;connect:()=>void}) {
  const [status,setStatus]=useState<BillingStatus|null>(null);
  const [pending,setPending]=useState(false);
  const [error,setError]=useState('');
  const [phone,setPhone]=useState('');
  const [firstName,setFirstName]=useState('');
  const [lastName,setLastName]=useState('');

  useEffect(()=>{
    if(!identity)return;
    let current=true;
    action<BillingStatus>(identity,'/api/billing',{action:'status'}).then(result=>{
      if(current)setStatus(result);
    }).catch((e:Error)=>{if(current)setError(e.message);});
    return ()=>{current=false;};
  },[identity]);

  async function request(kind:'checkout'|'trial'|'reconcile'|'status') {
    if(!identity||pending)return;
    setPending(true);setError('');
    try{
      const number=phone.trim().replace(/^\+/,'').replace(/^0/,'255');
      setStatus(await action<BillingStatus>(identity,'/api/billing',{
        action:kind,...(kind==='checkout'?{phone:number,firstName,lastName}:{}),
      }));
    }catch(e){setError(e instanceof Error?e.message:'Billing is temporarily unavailable.');}
    finally{setPending(false);}
  }

  function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void request('checkout');
  }

  return <div className="view-pad">
    <div className="live-header"><div><h1>Billing</h1><p>Manage access for your Locke workspace.</p></div></div>
    <section className="intelligence-input-card" style={{padding:'1rem',maxWidth:'42rem'}}>
      <h2>Starter</h2>
      <p><strong>TZS 49,000</strong> for 30 days of workspace access. Renew manually with Tanzanian mobile money.</p>
      <p>Start a 14-day trial without a payment method.</p>
      {!identity&&<Button onClick={connect}>Sign in to manage billing</Button>}
      {identity&&status&&<>
        {status.access.trial_ends_at&&<p>Trial end: {dateLabel(status.access.trial_ends_at)} EAT</p>}
        {status.access.paid_until&&<p>Paid through: {dateLabel(status.access.paid_until)} EAT</p>}
        {status.payment&&<p role="status">Latest payment: {status.payment.status}</p>}
        {status.payment?.status==='pending'&&<p>Approve the prompt on your phone, then check payment status.</p>}
        {status.canManage&&!status.access.trial_ends_at&&!status.access.paid_until&&<Button disabled={pending} onClick={()=>void request('trial')}>Start 14-day trial</Button>}
        {status.canManage&&status.payment?.status==='pending'&&<Button disabled={pending} onClick={()=>void request('reconcile')}>Check payment status</Button>}
        {status.canManage&&status.checkoutEnabled&&status.payment?.status!=='pending'&&
          <form onSubmit={submit} style={{display:'grid',gap:'.75rem',marginTop:'1rem'}}>
            <label>First name<Input value={firstName} onChange={e=>setFirstName(e.target.value)} autoComplete="given-name" required maxLength={80}/></label>
            <label>Last name<Input value={lastName} onChange={e=>setLastName(e.target.value)} autoComplete="family-name" required maxLength={80}/></label>
            <label>Mobile money number<Input value={phone} onChange={e=>setPhone(e.target.value)} type="tel" autoComplete="tel" placeholder="07XXXXXXXX" required maxLength={13}/></label>
            <Button type="submit" disabled={pending}>{status.payment?.status==='creating'?'Retry existing TZS 49,000 request':'Request TZS 49,000 mobile payment'}</Button>
          </form>}
        {!status.checkoutEnabled&&<p>Mobile money checkout is currently unavailable.</p>}
        {!status.canManage&&<p>Your workspace owner or admin manages billing.</p>}
      </>}
      {identity&&!status&&!error&&<p role="status">Loading workspace billing…</p>}
      {error&&<p role="alert">{error}</p>}
      {identity&&<Button variant="ghost" disabled={pending} onClick={()=>void request('status')}>Refresh billing</Button>}
    </section>
  </div>;
}
