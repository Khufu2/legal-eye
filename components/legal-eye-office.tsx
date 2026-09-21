"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Check, FilePenLine, LogIn, Mail, RefreshCw, Search, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

type Session = { access_token:string; user:{id:string;email?:string} };
type Membership = { organization_id:string; role:string };
type Playbook = { id:string; name:string; description:string|null; document_type:string|null; rules:unknown };
type Host = "word"|"outlook";

declare global {
  interface Window { Office?: any; Word?: any; }
}

async function api(path:string, session:Session, init:RequestInit={}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers:{ apikey:SUPABASE_KEY, Authorization:`Bearer ${session.access_token}`, ...(init.headers as Record<string,string>||{}) }, cache:"no-store" });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if(!response.ok) throw new Error(body?.error_description||body?.msg||body?.message||body?.error||`Request failed (${response.status})`);
  return body;
}

async function wordSelection() {
  if(!window.Word) throw new Error("Open this taskpane inside Microsoft Word.");
  return window.Word.run(async (context:any) => {
    const selection = context.document.getSelection();
    selection.load("text");
    await context.sync();
    return String(selection.text||"");
  });
}

async function replaceWordSelection(text:string) {
  if(!window.Word) throw new Error("Open this taskpane inside Microsoft Word.");
  await window.Word.run(async (context:any) => {
    const selection = context.document.getSelection();
    selection.insertText(text, "Replace");
    selection.select("End");
    await context.sync();
  });
}

function outlookItemText():Promise<string>{
  return new Promise((resolve,reject)=>{
    const Office = window.Office;
    const item = Office?.context?.mailbox?.item;
    if(!item?.body?.getAsync) return reject(new Error("Open this taskpane inside Outlook on a message."));
    item.body.getAsync(Office.CoercionType.Text, (result:any)=>result.status===Office.AsyncResultStatus.Succeeded?resolve(String(result.value||"")):reject(new Error(result.error?.message||"Could not read message")));
  });
}

function outlookSubject(){ return String(window.Office?.context?.mailbox?.item?.subject||""); }

function draftOutlookReply(text:string){
  const item=window.Office?.context?.mailbox?.item;
  if(item?.displayReplyForm){ item.displayReplyForm({htmlBody:text.replace(/\n/g,"<br>")}); return; }
  if(item?.body?.setAsync){ item.body.setAsync(text,{coercionType:window.Office.CoercionType.Text}); return; }
  throw new Error("This Outlook surface cannot open a reply form.");
}

export function LegalEyeOffice({host}:{host:Host}){
  const storageKey="legal-eye-office-session";
  const [ready,setReady]=useState(false),[session,setSession]=useState<Session|null>(null),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[membership,setMembership]=useState<Membership|null>(null),[playbooks,setPlaybooks]=useState<Playbook[]>([]),[playbookId,setPlaybookId]=useState(""),[source,setSource]=useState(""),[instruction,setInstruction]=useState(host==="word"?"Review this text for legal risk, clarity, consistency and missing protections. Propose precise replacement wording.":"Draft a concise professional reply that answers the sender, preserves commitments and flags anything requiring lawyer review."),[result,setResult]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const selectedPlaybook=useMemo(()=>playbooks.find(p=>p.id===playbookId)||null,[playbooks,playbookId]);

  useEffect(()=>{
    try{const raw=localStorage.getItem(storageKey);if(raw)setSession(JSON.parse(raw));}catch{}
    const timer=setInterval(()=>{if(window.Office){window.Office.onReady(()=>setReady(true));clearInterval(timer);}},250);
    const fallback=setTimeout(()=>setReady(Boolean(window.Office)),3000);
    return()=>{clearInterval(timer);clearTimeout(fallback);};
  },[]);

  useEffect(()=>{if(!session)return;void (async()=>{
    try{
      const memberships=await api(`/rest/v1/organization_members?select=organization_id,role&user_id=eq.${session.user.id}&is_active=is.true&limit=1`,session) as Membership[];
      const current=memberships[0]||null;setMembership(current);
      if(current){const rows=await api(`/rest/v1/playbooks?select=id,name,description,document_type,rules&organization_id=eq.${current.organization_id}&order=updated_at.desc&limit=50`,session) as Playbook[];setPlaybooks(rows);}
    }catch(error){setMessage(error instanceof Error?error.message:"Could not load LOCKE workspace");}
  })();},[session]);

  const signIn=async()=>{setBusy(true);setMessage("");try{
    const response=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:"POST",headers:{apikey:SUPABASE_KEY,"content-type":"application/json"},body:JSON.stringify({email,password})});
    const data=await response.json();if(!response.ok)throw new Error(data?.msg||data?.error_description||"Sign in failed");
    const next={access_token:data.access_token,user:data.user};localStorage.setItem(storageKey,JSON.stringify(next));setSession(next);
  }catch(error){setMessage(error instanceof Error?error.message:"Sign in failed");}finally{setBusy(false);}};
  const signOut=()=>{localStorage.removeItem(storageKey);setSession(null);setMembership(null);setPlaybooks([]);setResult("");};

  const capture=async()=>{setMessage("");try{const text=host==="word"?await wordSelection():await outlookItemText();setSource(text);if(!text.trim())setMessage(host==="word"?"Select text in Word first.":"The message body is empty.");}catch(error){setMessage(error instanceof Error?error.message:"Could not read Office content");}};
  const run=async(mode:"agent"|"improve"|"anonymize"|"summarize"|"translate"|"reply")=>{if(!session||!membership)return;setBusy(true);setMessage("");try{
    let text=source;if(!text.trim()){text=host==="word"?await wordSelection():await outlookItemText();setSource(text);}if(!text.trim())throw new Error("Select or load content first.");
    const playbook=selectedPlaybook?`\n\nFIRM PLAYBOOK — ${selectedPlaybook.name}:\n${selectedPlaybook.description||""}\nRULES:\n${JSON.stringify(selectedPlaybook.rules)}`:"";
    if(mode==="agent"||mode==="reply"){
      const objective=mode==="reply"?`Email subject: ${outlookSubject()}\n\n${instruction}${playbook}\n\nEMAIL:\n${text}`:`${instruction}${playbook}\n\nDOCUMENT TEXT:\n${text}`;
      const body=await api("/api/legal-work",session,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"run_agent",organization_id:membership.organization_id,objective:objective.slice(0,12000),skill_instructions:selectedPlaybook?JSON.stringify(selectedPlaybook.rules).slice(0,20000):undefined})});
      setResult(String(body.deliverable||body.executive_summary||""));
    }else{
      const body=await api("/api/legal-work",session,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"transform",organization_id:membership.organization_id,text:text.slice(0,80000),operation:mode,language:mode==="translate"?"English":undefined})});
      setResult(String(body.content||""));
    }
  }catch(error){setMessage(error instanceof Error?error.message:"LOCKE action failed");}finally{setBusy(false);}};
  const apply=async()=>{if(!result.trim())return;try{if(host==="word")await replaceWordSelection(result);else draftOutlookReply(result);setMessage(host==="word"?"Inserted into the selected Word range.":"Reply draft opened in Outlook.");}catch(error){setMessage(error instanceof Error?error.message:"Could not apply result");}};

  if(!session)return <main className="office-shell"><div className="office-brand"><span>L</span><div><b>LOCKE for {host==="word"?"Word":"Outlook"}</b><small>Firm-governed legal intelligence</small></div></div><section className="office-card"><ShieldCheck/><h1>Connect your workspace</h1><p>Sign in with your LOCKE account. Your firm permissions and playbooks apply inside Microsoft Office.</p><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@firm.com"/><Input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password"/><Button onClick={signIn} disabled={busy||!email||password.length<6}><LogIn/> {busy?"Signing in…":"Sign in"}</Button>{message?<p className="office-message">{message}</p>:null}</section></main>;

  return <main className="office-shell"><header className="office-top"><div className="office-brand"><span>L</span><div><b>LOCKE</b><small>{host==="word"?"Word Add-in":"Outlook Add-in"}</small></div></div><div><Badge>{membership?.role||"workspace"}</Badge><button onClick={signOut}>Sign out</button></div></header><section className="office-card office-work"><div className="office-status"><span><Check/> Connected</span><small>{ready?"Office host detected":"Open inside Microsoft Office to read/write the active item"}</small></div><Button variant="outline" onClick={capture}><RefreshCw/> {host==="word"?"Load selection":"Load email"}</Button><Textarea value={source} onChange={e=>setSource(e.target.value)} placeholder={host==="word"?"Select text in Word or paste text here…":"Load the current message or paste email text…"}/>{playbooks.length?<select value={playbookId} onChange={e=>setPlaybookId(e.target.value)}><option value="">No playbook</option>{playbooks.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select>:null}<Textarea value={instruction} onChange={e=>setInstruction(e.target.value)} placeholder="Tell LOCKE what to do…"/><div className="office-actions">{host==="word"?<><Button onClick={()=>void run("agent")} disabled={busy}><Bot/> Review / redline</Button><Button variant="outline" onClick={()=>void run("improve")} disabled={busy}><Wand2/> Improve</Button><Button variant="outline" onClick={()=>void run("anonymize")} disabled={busy}><ShieldCheck/> Anonymize</Button><Button variant="outline" onClick={()=>void run("summarize")} disabled={busy}><Search/> Summarize</Button></>:<><Button onClick={()=>void run("reply")} disabled={busy}><Mail/> Draft reply</Button><Button variant="outline" onClick={()=>void run("summarize")} disabled={busy}><Search/> Summarize thread</Button><Button variant="outline" onClick={()=>void run("anonymize")} disabled={busy}><ShieldCheck/> Anonymize</Button></>}</div>{busy?<p className="office-message">LOCKE is working…</p>:null}{result?<div className="office-result"><div><b>{host==="word"?"Proposed work product":"Proposed reply"}</b><Badge><Sparkles/> AI · lawyer review</Badge></div><Textarea value={result} onChange={e=>setResult(e.target.value)}/><Button onClick={apply}><FilePenLine/> {host==="word"?"Replace selection":"Open reply"}</Button></div>:null}{message?<p className="office-message">{message}</p>:null}</section></main>;
}
