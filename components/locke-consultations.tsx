'use client';

import {useEffect,useState,type FormEvent} from 'react';
import {action,type Identity} from '@/lib/legal/client';
import {practiceAreas,type PracticeArea} from '@/lib/legal/public-legal';
import {Button} from './ui/button';
import {Input} from './ui/input';

type Listing={id:string;name:string;firm:string;roll:string;city:string;areas:PracticeArea[];state:'pending'|'verified'|'withdrawn';checked_at:string|null};
type Request={id:string;name:string;email:string;area:PracticeArea;locale:'sw'|'en';status:'new'|'contacted'|'closed';created_at:string;locke_public_advocates:{name:string}};
type Records={listings:Listing[];requests:Request[]};
const localDate=(value:string)=>new Intl.DateTimeFormat('en-TZ',{dateStyle:'medium',timeZone:'Africa/Dar_es_Salaam'}).format(new Date(value));

export function LockeConsultations({identity,connect}:{identity:Identity|null;connect:()=>void}) {
  const [records,setRecords]=useState<Records|null>(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [draft,setDraft]=useState<Listing|null>(null);
  const canManage=!!identity&&['owner','admin'].includes(identity.role);
  useEffect(()=>{
    if(!identity||!canManage)return;
    let active=true;
    action<Records>(identity,'/api/consultations',{action:'list'}).then(data=>{if(active)setRecords(data);})
      .catch((e:Error)=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[identity,canManage]);

  async function run(payload:Record<string,unknown>,message=''){
    if(!identity||busy)return false;
    setBusy(true);setError('');setNotice('');
    try{setRecords(await action<Records>(identity,'/api/consultations',payload));setNotice(message);return true;}
    catch(e){setError(e instanceof Error?e.message:'Consultations are unavailable.');return false;}
    finally{setBusy(false);}
  }

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=event.currentTarget;
    const values=new FormData(form);
    const done=await run({action:'submit',name:values.get('name'),firm:values.get('firm'),roll:values.get('roll'),
      city:values.get('city'),areas:values.getAll('areas'),consent:values.has('consent')},'Listing submitted for verification.');
    if(done){form.reset();setDraft(null);}
  }

  return <div className="view-pad">
    <div className="live-header"><div><h1>Consultations</h1><p>List verified advocates and receive public requests in your workspace.</p></div><a href="/consult">Open public directory ↗</a></div>
    {!identity?<Button onClick={connect}>Sign in</Button>:!canManage?<p>Ask a workspace owner or admin to manage consultation requests.</p>:<>
      <div className="locke-billing">
        <div className="billing-grid">
          <section className="billing-checkout" aria-labelledby="listing-title">
            <h2 id="listing-title">Advocate listings</h2>
            <p>Submit your advocate’s name and roll number. Locke checks their current status against the Judiciary register before publication.</p>
            {records?.listings.map(listing=>{
              const expired=listing.state==='verified'&&listing.checked_at&&Date.parse(listing.checked_at)<=Date.now()-90*86400000;
              return <div className="billing-status" key={listing.id}><strong>{listing.name} · {expired?'verification expired':listing.state}</strong>
                <p>{listing.firm} · {listing.city} · Roll {listing.roll}</p>
                <Button variant="outline" disabled={busy} onClick={()=>setDraft(listing)}>Edit or renew listing</Button>
                {listing.state!=='withdrawn'&&<Button variant="ghost" disabled={busy} onClick={()=>void run({action:'withdraw',id:listing.id},'Listing withdrawn.')}>Withdraw listing</Button>}
              </div>;
            })}
            <form onSubmit={submit} key={draft?.id||'new-listing'}>
              <h3>{draft?'Update listing':'Submit a listing'}</h3>
              <label className="billing-field">Advocate name<Input name="name" minLength={3} maxLength={120} required defaultValue={draft?.name}/></label>
              <label className="billing-field">Firm name<Input name="firm" minLength={2} maxLength={120} required defaultValue={draft?.firm}/></label>
              <label className="billing-field">Judiciary roll number<Input name="roll" maxLength={30} required defaultValue={draft?.roll} readOnly={!!draft}/></label>
              <label className="billing-field">Town or city<Input name="city" minLength={2} maxLength={60} required defaultValue={draft?.city}/></label>
              <fieldset><legend>Practice areas</legend>{(Object.keys(practiceAreas) as PracticeArea[]).map(k=><label key={k} style={{display:'block'}}><input type="checkbox" name="areas" value={k} defaultChecked={draft?.areas.includes(k)}/> {practiceAreas[k][0]}</label>)}</fieldset>
              <label><input type="checkbox" name="consent" required/> The advocate agrees to publish these details after verification and receive consultation requests through this firm.</label>
              <Button type="submit" disabled={busy}>Submit for verification</Button>
              {draft&&<Button variant="ghost" type="button" onClick={()=>setDraft(null)}>Cancel edit</Button>}
            </form>
          </section>
          <section className="billing-checkout" aria-labelledby="inbox-title">
            <h2 id="inbox-title">Consultation inbox</h2>
            <p>Contact the requester to agree on a time and terms. Only firm owners and admins can see these requests.</p>
            {!records&&!error&&<p role="status">Loading consultations…</p>}
            {records?.requests.length===0&&<p>No consultation requests yet.</p>}
            {records?.requests.map(item=><article key={item.id} className="billing-status">
              <strong>{item.name} · {item.status}</strong>
              <p>{item.locke_public_advocates.name} · {practiceAreas[item.area][0]} · {localDate(item.created_at)}</p>
              <p>Preferred language: {item.locale==='sw'?'Kiswahili':'English'}</p>
              {item.status!=='closed'&&<><a href={`mailto:${encodeURIComponent(item.email)}`}>{item.email}</a>
                {item.status==='new'&&<Button variant="outline" disabled={busy} onClick={()=>void run({action:'update',id:item.id,status:'contacted'})}>Mark contacted</Button>}
                <Button variant="ghost" disabled={busy} onClick={()=>void run({action:'update',id:item.id,status:'closed'})}>Close request</Button></>}
            </article>)}
            <Button variant="ghost" disabled={busy} onClick={()=>void run({action:'list'})}>Refresh inbox</Button>
          </section>
        </div>
      </div>
      {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    </>}
  </div>;
}
