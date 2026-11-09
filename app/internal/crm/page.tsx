"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { workspace, type Identity } from "@/lib/legal/client";
import "./crm.css";

type Staff = { role: "owner"|"operator"|"viewer"; active: boolean };
type Lead = { id: string; firm_name: string; city: string|null; segment: string|null; priority: string; contact_name: string|null; public_email: string|null; public_phone: string|null; website: string|null; source_url: string|null; email_permission: string; stage: string; next_action: string|null; next_action_at: string|null; updated_at: string };
const stages = ["researched","qualified","permission_pending","ready_for_approval","invited","engaged","pilot_booked","pilot_active","converted","closed"] as const;
const title = (v:string) => v.replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase());

export default function InternalCRM() {
  const [identity,setIdentity]=useState<Identity|null>(null);
  const [staff,setStaff]=useState<Staff|null>(null);
  const [leads,setLeads]=useState<Lead[]>([]);
  const [busy,setBusy]=useState(true);
  const [error,setError]=useState("");
  const [search,setSearch]=useState("");
  const [status,setStatus]=useState("all");
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState({firm_name:"",public_email:"",source_url:"",city:"",segment:"",contact_name:""});
  const [saving,setSaving]=useState(false);
  useEffect(()=>{
    try {
      const raw=sessionStorage.getItem("legal-eye-session");
      const saved=raw ? JSON.parse(raw) as Identity : null;
      if (!saved?.access_token || !saved?.organization_id || !saved?.user?.id) throw new Error("Sign in to LOCKE, then open this internal dashboard.");
      setIdentity(saved);
    } catch {setError("Please sign in to LOCKE with an authorized internal account.");setBusy(false);}
  },[]);
  const refresh=async(user:Identity)=>{
    const [permission,rows]=await Promise.all([
      workspace<Staff[]>(user,`crm_staff?select=role,active&user_id=eq.${user.user.id}&limit=1`),
      workspace<Lead[]>(user,"crm_leads?select=id,firm_name,city,segment,priority,contact_name,public_email,public_phone,website,source_url,email_permission,stage,next_action,next_action_at,updated_at&order=updated_at.desc&limit=500"),
    ]);
    if(!permission[0]?.active) throw new Error("Your account is not enrolled as an internal LOCKE CRM user.");
    setStaff(permission[0]);setLeads(rows);
  };
  useEffect(()=>{if(!identity)return;let active=true;setBusy(true);refresh(identity).catch(e=>{if(active)setError(e instanceof Error?e.message:"CRM temporarily unavailable");}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[identity]);
  const filtered=useMemo(()=>leads.filter(x=>(status==="all"||x.stage===status)&&`${x.firm_name} ${x.city||""} ${x.contact_name||""} ${x.public_email||""}`.toLowerCase().includes(search.toLowerCase())),[leads,status,search]);
  const count=(stage:string)=>leads.filter(x=>x.stage===stage).length;
  const create=async(e:React.FormEvent)=>{
    e.preventDefault();if(!identity||staff?.role==="viewer")return;
    setSaving(true);setError("");
    try{
      if(!/^https:\/\//.test(form.source_url)) throw new Error("A public HTTPS source URL is required.");
      const record={...form,firm_name:form.firm_name.trim(),public_email:form.public_email.trim()||null,city:form.city.trim()||null,segment:form.segment.trim()||null,contact_name:form.contact_name.trim()||null,stage:"researched",email_permission:"not_established",priority:"medium"};
      await workspace(identity,"crm_leads",{method:"POST",body:JSON.stringify(record)});
      setForm({firm_name:"",public_email:"",source_url:"",city:"",segment:"",contact_name:""});setShowForm(false);await refresh(identity);
    }catch(e){setError(e instanceof Error?e.message:"Could not create lead");}finally{setSaving(false);}
  };
  return <main className="crm-root">
    <div className="crm-wrap">
      <header className="crm-head"><div><Link href="/" className="crm-back">LOCKE / Internal operations</Link><h1>Law firm pipeline</h1><p>Research, qualify, evaluate. Outreach stays human-approved.</p></div><div className="crm-head-actions"><span className="crm-lock">Private CRM</span>{staff?.role!=="viewer"&&staff&&<button onClick={()=>setShowForm(x=>!x)}>+ Add firm</button>}</div></header>
      {error&&<div className="crm-error" role="alert">{error}</div>}
      {busy&&<p className="crm-loading">Checking restricted CRM access…</p>}
      {!busy&&!staff&&<section className="crm-empty"><h2>Access not enabled</h2><p>Internal operators must be explicitly enrolled. A lawyer workspace account does not grant CRM access.</p><Link href="/">Return to LOCKE</Link></section>}
      {!busy&&staff&&<>
        <section className="crm-stats">{[["Researched",count("researched")],["Awaiting permission",count("permission_pending")],["Engaged",count("engaged")],["Pilots",count("pilot_booked")+count("pilot_active")]].map(([name,value])=><article key={name}><p>{name}</p><strong>{value}</strong></article>)}</section>
        <div className="crm-safety"><b>Outbound disabled by default.</b> Public contact listings do not demonstrate marketing permission. Record lawful eligibility, suppression checks, exact message approval and sender validation before outreach. Do not upload real client work for pilot evaluation.</div>
        {showForm&&<form onSubmit={create} className="crm-form"><h2>New researched firm</h2><div className="crm-fields">{[["firm_name","Firm *"],["public_email","Published email"],["source_url","Public source URL *"],["city","City"],["segment","Segment"],["contact_name","Published contact"]].map(([key,label])=><label key={key}>{label}<input type={key==="public_email"?"email":key==="source_url"?"url":"text"} required={key==="firm_name"||key==="source_url"} maxLength={key==="source_url"?2000:200} value={form[key as keyof typeof form]} onChange={e=>setForm(x=>({...x,[key]:e.target.value}))}/></label>)}</div><button disabled={saving}>{saving?"Saving…":"Save researched firm"}</button></form>}
        <div className="crm-controls"><input aria-label="Search firms" placeholder="Search firm, city, contact or email" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Pipeline stage" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All stages</option>{stages.map(x=><option key={x} value={x}>{title(x)}</option>)}</select><span>{filtered.length} of {leads.length} records</span></div>
        <div className="crm-table-scroll"><table><thead><tr><th>Firm</th><th>Location</th><th>Contact</th><th>Stage</th><th>Permission</th><th>Next action</th><th>Source</th></tr></thead><tbody>{filtered.map(x=><tr key={x.id}><td><strong>{x.firm_name}</strong><small>{x.segment||""} · {title(x.priority)}</small></td><td>{x.city||"—"}</td><td>{x.contact_name||"General office"}<small>{x.public_email||"No email listed"}</small></td><td><span className="crm-chip">{title(x.stage)}</span></td><td>{x.email_permission==="not_established"?"Not established":title(x.email_permission)}</td><td>{x.next_action||"Review source"}</td><td>{x.source_url?<a href={x.source_url} target="_blank" rel="noopener noreferrer">Verify source ↗</a>:"—"}</td></tr>)}</tbody></table>{!filtered.length&&<p className="crm-no-results">No firms match this view. Import approved research records or add a source-backed firm.</p>}</div>
      </>}
    </div>
  </main>;
}
