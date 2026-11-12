'use client';

import {useEffect,useState,type FormEvent} from 'react';
import {ArrowUpRight,BookOpen,Check,MapPin,Search,ShieldCheck} from 'lucide-react';
import {practiceAreas,type PracticeArea,type PublicAdvocate,type PublicSource} from '@/lib/legal/public-legal';

const words = {
  en:{
    eyebrow:'Tanzanian legal information',headline:'Find the law. Find a lawyer.',
    intro:'Search official legal sources and request a consultation with a verified advocate.',
    sourceTitle:'Search the law',sourceHint:'Try a topic or Act name. Leave out names and private case details.',
    searchLabel:'Legal topic or Act',placeholder:'e.g. unfair dismissal or Land Act',search:'Search sources',working:'Searching…',
    source:'Open official source',empty:'No matching sources. Try the name of an Act or a more specific topic.',
    snapshot:'Index snapshot',excerpts:'Excerpts appear in their original language. Check the official source for the current text.',
    directory:'Find an advocate',directoryHint:'Choose a location and practice area. Requests go to the firm you select.',
    city:'Location',practice:'Practice area',allCities:'All locations',allAreas:'All practice areas',verified:'Verified in the Judiciary register',
    date:'Checked',request:'Request consultation',verify:'Check the Judiciary register',noAdvocates:'No verified advocates match these filters yet.',
    firmJoin:'List an advocate from your firm',selected:'Request a consultation with',name:'Your name',email:'Your email',
    consent:'Share my name, email and selected practice area with this firm so it can contact me.',
    privacy:'Locke stores these details for up to 90 days. Please keep your documents and case details for your conversation with the advocate.',
    send:'Send request',sending:'Sending…',sent:'Request received. The firm can email you to arrange a consultation.',
    cancel:'Cancel',invalid:'Check the form and try again.',unavailable:'Temporarily unavailable. Please try again.',
    limited:'Too many requests. Please try again later.',listing:'This advocate is currently unavailable for new requests.',
    loading:'Loading verified advocates…',workspace:'Lawyer workspace',
  },
  sw:{
    eyebrow:'Taarifa za sheria za Tanzania',headline:'Tafuta sheria. Tafuta wakili.',
    intro:'Tafuta vyanzo rasmi vya sheria na omba mashauriano na wakili aliyethibitishwa.',
    sourceTitle:'Tafuta sheria',sourceHint:'Andika mada au jina la sheria. Usiweke majina au taarifa za siri za shauri.',
    searchLabel:'Mada au jina la sheria',placeholder:'mf. kufukuzwa kazi au Sheria ya Ardhi',search:'Tafuta vyanzo',working:'Inatafuta…',
    source:'Fungua chanzo rasmi',empty:'Hakuna vyanzo vilivyopatikana. Jaribu jina la sheria au mada mahususi zaidi.',
    snapshot:'Tarehe ya faharasa',excerpts:'Nukuu zinaonyeshwa katika lugha ya chanzo. Hakiki maandishi ya sasa kwenye chanzo rasmi.',
    directory:'Tafuta wakili',directoryHint:'Chagua eneo na taaluma ya sheria. Ombi litaenda kwa ofisi utakayochagua.',
    city:'Eneo',practice:'Taaluma ya sheria',allCities:'Maeneo yote',allAreas:'Taaluma zote',verified:'Amethibitishwa kwenye daftari la Mahakama',
    date:'Imehakikiwa',request:'Omba mashauriano',verify:'Hakiki kwenye daftari la Mahakama',noAdvocates:'Kwa sasa hakuna wakili aliyethibitishwa anayelingana na chaguo lako.',
    firmJoin:'Sajili wakili wa ofisi yako',selected:'Omba mashauriano na',name:'Jina lako',email:'Barua pepe yako',
    consent:'Ninakubali jina, barua pepe na taaluma niliyochagua vitumwe kwa ofisi hii ili iwasiliane nami.',
    privacy:'Locke huhifadhi taarifa hizi kwa hadi siku 90. Hifadhi nyaraka na taarifa za shauri kwa mazungumzo yako na wakili.',
    send:'Tuma ombi',sending:'Inatuma…',sent:'Ombi limepokelewa. Ofisi inaweza kukutumia barua pepe kupanga mashauriano.',
    cancel:'Ghairi',invalid:'Hakiki taarifa ulizojaza kisha ujaribu tena.',unavailable:'Huduma haipatikani kwa sasa. Jaribu tena.',
    limited:'Maombi ni mengi. Tafadhali jaribu tena baadaye.',listing:'Wakili huyu hapokei maombi mapya kwa sasa.',
    loading:'Inapakia mawakili waliothibitishwa…',workspace:'Eneo la kazi la wakili',
  }
};

type Locale=keyof typeof words;
async function api<T>(body:Record<string,unknown>):Promise<T>{
  const response=await fetch('/api/public-legal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'unavailable');
  return data as T;
}

export function PublicConsultations() {
  const [locale,setLocale]=useState<Locale>('sw');
  const [query,setQuery]=useState('');
  const [result,setResult]=useState<{sources:PublicSource[];asOf:string|null}|null>(null);
  const [searching,setSearching]=useState(false);
  const [searchError,setSearchError]=useState('');
  const [advocates,setAdvocates]=useState<PublicAdvocate[]|null>(null);
  const [directoryError,setDirectoryError]=useState(false);
  const [city,setCity]=useState('');
  const [area,setArea]=useState<PracticeArea|''>('');
  const [selected,setSelected]=useState<PublicAdvocate|null>(null);
  const [requestArea,setRequestArea]=useState<PracticeArea|''>('');
  const [sending,setSending]=useState(false);
  const [sent,setSent]=useState(false);
  const [requestError,setRequestError]=useState('');
  const t=words[locale];
  const label=(key:PracticeArea)=>practiceAreas[key][locale==='en'?0:1];
  const cities=[...new Set(advocates?.map(a=>a.city)||[])].sort();
  const matches=advocates?.filter(a=>(!city||a.city===city)&&(!area||a.areas.includes(area)))||[];
  const day=(date:string)=>new Intl.DateTimeFormat(locale==='sw'?'sw-TZ':'en-TZ',{dateStyle:'medium',timeZone:'Africa/Dar_es_Salaam'}).format(new Date(date));

  useEffect(()=>{
    let live=true;
    api<{advocates:PublicAdvocate[]}>({action:'directory'})
      .then(data=>{if(live)setAdvocates(data.advocates);}).catch(()=>{if(live)setDirectoryError(true);});
    return()=>{live=false;};
  },[]);

  async function search(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(searching)return;
    setSearching(true);setSearchError('');setResult(null);
    try{setResult(await api<{sources:PublicSource[];asOf:string|null}>({action:'search',query}));}
    catch(e){setSearchError(e instanceof Error&&e.message==='invalid'?'invalid':'unavailable');}
    finally{setSearching(false);}
  }

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!selected||sending)return;
    const values=new FormData(event.currentTarget);
    setSending(true);setRequestError('');
    try{
      await api({action:'request',advocate:selected.id,area:requestArea,name:values.get('name'),email:values.get('email'),
        website:values.get('website'),locale,consent:values.has('consent')});
      setSelected(null);setSent(true);
    }catch(e){setRequestError(e instanceof Error?e.message:'unavailable');}
    finally{setSending(false);}
  }

  return <main className="public-legal" lang={locale}>
    <div className="public-shell">
      <header className="public-nav">
        <a href="https://www.lockeslaw.xyz/" className="public-logo">Locke<span>.</span></a>
        <div><a className="public-workspace" href="/">{t.workspace}<ArrowUpRight size={16}/></a>
          <button type="button" className="public-language" onClick={()=>setLocale(locale==='sw'?'en':'sw')}>{locale==='sw'?'English':'Kiswahili'}</button>
        </div>
      </header>
      <div className="public-hero"><p>{t.eyebrow}</p><h1>{t.headline}</h1><div>{t.intro}</div></div>
      <div className="public-grid">
        <section className="public-card" aria-labelledby="law-search">
          <BookOpen aria-hidden="true"/><h2 id="law-search">{t.sourceTitle}</h2><p>{t.sourceHint}</p>
          <form className="public-search" onSubmit={search}>
            <label>{t.searchLabel}<input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t.placeholder} required minLength={3} maxLength={140}/></label>
            <button type="submit" disabled={searching}><Search size={18}/>{searching?t.working:t.search}</button>
          </form>
          {searchError&&<p role="alert">{searchError==='invalid'?t.invalid:t.unavailable}</p>}
          {result&&<div className="public-results" aria-live="polite">
            {result.asOf&&<small>{t.snapshot}: {day(result.asOf)}</small>}
            {result.sources.length===0?<p>{t.empty}</p>:<>
              <small>{t.excerpts}</small>
              {result.sources.map(s=><article key={s.url}><h3>{s.title}</h3><small>{[s.citation,s.publisher].filter(Boolean).join(' · ')}</small>
                {s.excerpt&&<p>{s.excerpt}</p>}<a href={s.url} target="_blank" rel="noreferrer">{t.source}<ArrowUpRight size={15}/></a></article>)}
            </>}
          </div>}
        </section>
        <section className="public-card" aria-labelledby="advocate-directory">
          <ShieldCheck aria-hidden="true"/><h2 id="advocate-directory">{t.directory}</h2><p>{t.directoryHint}</p>
          <div className="public-filters">
            <label>{t.city}<select value={city} onChange={e=>setCity(e.target.value)}><option value="">{t.allCities}</option>{cities.map(c=><option key={c}>{c}</option>)}</select></label>
            <label>{t.practice}<select value={area} onChange={e=>setArea(e.target.value as PracticeArea|'')}><option value="">{t.allAreas}</option>{(Object.keys(practiceAreas) as PracticeArea[]).map(k=><option value={k} key={k}>{label(k)}</option>)}</select></label>
          </div>
          {directoryError?<p role="alert">{t.unavailable}</p>:advocates===null?<p role="status">{t.loading}</p>:matches.length===0?<p role="status">{t.noAdvocates}</p>:null}
          {matches.map(a=><article key={a.id} className="public-advocate"><h3>{a.name}</h3><p>{a.firm}</p>
            <small><MapPin size={15}/>{a.city} · {a.areas.map(label).join(', ')}</small>
            <small><Check size={15}/>{t.verified} · {t.date} {day(a.checked_at)} · {a.roll}</small>
            <button type="button" disabled={sending} onClick={()=>{setSelected(a);setRequestArea(area&&a.areas.includes(area)?area:a.areas[0]);setSent(false);setRequestError('');}}>{t.request}</button>
          </article>)}
          {sent&&<p className="public-success" role="status">{t.sent}</p>}
          {selected&&<form className="public-request" onSubmit={submit} key={selected.id}>
            <h3>{t.selected} {selected.name}</h3>
            <label>{t.practice}<select required value={requestArea} onChange={e=>setRequestArea(e.target.value as PracticeArea)}>{selected.areas.map(k=><option value={k} key={k}>{label(k)}</option>)}</select></label>
            <label>{t.name}<input name="name" autoComplete="name" minLength={2} maxLength={100} required/></label>
            <label>{t.email}<input name="email" autoComplete="email" type="email" maxLength={254} required/></label>
            <input name="website" hidden tabIndex={-1} autoComplete="off" aria-hidden="true"/>
            <label className="public-consent"><input name="consent" type="checkbox" required/>{t.consent}</label>
            <small>{t.privacy}</small>
            {requestError&&<p role="alert">{requestError==='limited'?t.limited:requestError==='listing'?t.listing:requestError==='invalid'?t.invalid:t.unavailable}</p>}
            <div className="public-actions"><button type="submit" disabled={sending}>{sending?t.sending:t.send}</button><button type="button" className="public-secondary" disabled={sending} onClick={()=>setSelected(null)}>{t.cancel}</button></div>
          </form>}
          <div className="public-links"><a href="https://ewakili.judiciary.go.tz/" target="_blank" rel="noreferrer">{t.verify}<ArrowUpRight size={15}/></a><a href="/?view=consultations">{t.firmJoin}<ArrowUpRight size={15}/></a></div>
        </section>
      </div>
    </div>
  </main>;
}
