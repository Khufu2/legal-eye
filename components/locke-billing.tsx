'use client';

import {useEffect,useState,type FormEvent} from 'react';
import {action,type Identity} from '@/lib/legal/client';
import {Check,Smartphone} from 'lucide-react';
import './locke-billing.css';
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
      const number=phone.trim().replace(/[\s()-]/g,'').replace(/^\+/,'').replace(/^0/,'255');
      setStatus(await action<BillingStatus>(identity,'/api/billing',{
        action:kind,...(kind==='checkout'?{phone:number,firstName,lastName}:{}),
      }));
    }catch(e){setError(e instanceof Error?e.message:'Billing is temporarily unavailable.');}
    finally{setPending(false);}
  }

  useEffect(()=>{
    if(!identity||pending||status?.payment?.status!=='pending')return;
    let active=true;
    let attempts=0;
    let timer:ReturnType<typeof setTimeout>;
    async function check() {
      if(!identity)return;
      try{
        const next=await action<BillingStatus>(identity,'/api/billing',{action:'status'});
        if(!active)return;
        if(next.payment?.status!=='pending'){setStatus(next);return;}
      }catch{/* The manual status check remains available. */}
      if(active&&++attempts<24)timer=setTimeout(check,5000);
    }
    timer=setTimeout(check,5000);
    return()=>{active=false;clearTimeout(timer);};
  },[identity,pending,status?.payment?.status]);

  function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void request('checkout');
  }

  const paymentState=status?.payment?.status;
  const paymentLabels:Record<string,string>={
    creating:'Request awaiting confirmation',pending:'Awaiting phone approval',completed:'Payment confirmed',
    failed:'Payment failed',voided:'Payment cancelled',expired:'Payment expired',
  };

  return <div className="view-pad locke-billing">
    <div className="live-header"><div><h1>Billing</h1><p>Manage access for your Locke workspace.</p></div></div>
    <div className="billing-grid">
      <section className="billing-plan" aria-labelledby="starter-plan">
        <h2 id="starter-plan">Starter</h2>
        <div className="billing-price"><strong>TZS 49,000</strong><span>/ 30 days</span></div>
        <p>Research, review documents, and run legal workflows.</p>
        <div className="billing-trial"><Check size={18}/><div><strong>14-day free trial</strong><p>No payment method required. Renew manually by mobile money.</p></div></div>
      </section>
      <section className="billing-checkout" aria-labelledby="checkout-title">
        <h2 id="checkout-title">Workspace access</h2>
        {!identity&&<><p>Sign in to start your trial or manage payments.</p><Button onClick={connect}>Sign in</Button></>}
        {identity&&status&&<>
          {(status.access.trial_ends_at||status.access.paid_until||paymentState)&&<div className="billing-status" role="status">
            {status.access.trial_ends_at&&<p>Trial ends {dateLabel(status.access.trial_ends_at)} EAT</p>}
            {status.access.paid_until&&<p>Paid through {dateLabel(status.access.paid_until)} EAT</p>}
            {paymentState&&<strong>{paymentLabels[paymentState]||'Check payment status'}</strong>}
          </div>}
          {status.canManage&&!status.access.trial_ends_at&&!status.access.paid_until&&<Button disabled={pending} onClick={()=>void request('trial')}>Start free trial</Button>}
          {status.canManage&&paymentState==='pending'&&<><p>Approve the mobile-money prompt on your phone. You can keep this page open on your computer while it updates.</p><Button disabled={pending} onClick={()=>void request('reconcile')}>Check payment status</Button></>}
          {status.canManage&&status.checkoutEnabled&&paymentState!=='pending'&&
            <form onSubmit={submit}>
              <div className="billing-names">
                <label className="billing-field">First name<Input value={firstName} onChange={e=>setFirstName(e.target.value)} autoComplete="given-name" required maxLength={80}/></label>
                <label className="billing-field">Last name<Input value={lastName} onChange={e=>setLastName(e.target.value)} autoComplete="family-name" required maxLength={80}/></label>
              </div>
              <label className="billing-field">Mobile money number<Input value={phone} onChange={e=>setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="07XX XXX XXX" required maxLength={18}/></label>
              <Button className="billing-submit" type="submit" disabled={pending}><Smartphone size={18}/>{paymentState==='creating'?'Retry payment request':'Pay TZS 49,000'}</Button>
              <small>A single payment. Approve it with your mobile-money provider on any supported phone, including a basic phone.</small>
            </form>}
          {!status.checkoutEnabled&&<p>Mobile money checkout is currently unavailable.</p>}
          {!status.canManage&&<p>Your workspace owner or admin manages billing.</p>}
        </>}
        {identity&&!status&&!error&&<p role="status">Loading workspace billing…</p>}
        {error&&<p className="billing-error" role="alert">{error}</p>}
        {identity&&<Button variant="ghost" disabled={pending} onClick={()=>void request('status')}>Refresh billing</Button>}
      </section>
    </div>
  </div>;
}
