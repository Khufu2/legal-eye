"use client";

import { useMemo, useState } from "react";
import { Bot, FileSearch2, Play, Send, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type GuestSession={access_token:string;user:{id:string;email?:string}};
type Portal={id:string;name:string};
type Resource={id:string;resource_type:string;resource_id:string;label:string|null};
type Citation={resource_id:string;label:string;quote:string;page:number|null};

export function PortalAssistant({session,portal,resources}:{session:GuestSession;portal:Portal;resources:Resource[]}){
  const [question,setQuestion]=useState(""),[conversation,setConversation]=useState<string|null>(null),[answer,setAnswer]=useState(""),[citations,setCitations]=useState<Citation[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const workflows=useMemo(()=>resources.filter(r=>r.resource_type==="workflow"),[resources]);
  const [workflowId,setWorkflowId]=useState(""),[workflowInput,setWorkflowInput]=useState(""),[workflowOutput,setWorkflowOutput]=useState("");
  const call=async(body:Record<string,unknown>)=>{const response=await fetch("/api/portal-work",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"content-type":"application/json"},body:JSON.stringify(body)});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data?.error||"Portal action failed");return data;};
  const ask=async()=>{if(!question.trim())return;setBusy(true);setError("");try{const data=await call({action:"ask",portal_id:portal.id,question,conversation_id:conversation||undefined});setConversation(data.conversation_id);setAnswer(data.answer||"");setCitations(data.citations||[]);}catch(e){setError(e instanceof Error?e.message:"Question failed");}finally{setBusy(false);}};
  const run=async()=>{if(!workflowId)return;setBusy(true);setError("");setWorkflowOutput("");try{const data=await call({action:"run_workflow",portal_id:portal.id,workflow_id:workflowId,input:workflowInput});setWorkflowOutput([data.executive_summary,data.deliverable,data.uncertainties?.length?`Open questions:\n- ${data.uncertainties.join("\n- ")}`:""].filter(Boolean).join("\n\n"));}catch(e){setError(e instanceof Error?e.message:"Workflow failed");}finally{setBusy(false);}};
  return <div className="portal-ai-grid"><section className="portal-ai-card"><div className="portal-ai-title"><Bot/><div><b>Ask shared knowledge</b><small>Answers are restricted to material your legal team published here.</small></div><Badge><ShieldCheck/> Grounded</Badge></div><Textarea value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ask about the shared agreement, review table or work product…"/><Button onClick={ask} disabled={busy||!question.trim()}><Send/> {busy?"Working…":"Ask Legal Eye"}</Button>{answer?<div className="portal-answer"><p>{answer}</p>{citations.length?<div className="portal-citations"><b>Sources</b>{citations.map((c,i)=><article key={`${c.resource_id}-${i}`}><FileSearch2/><div><strong>{c.label}</strong><small>{c.page?`Page ${c.page}`:"Published resource"}</small><p>{c.quote}</p></div></article>)}</div>:null}</div>:null}</section>{workflows.length?<section className="portal-ai-card"><div className="portal-ai-title"><Sparkles/><div><b>Firm-powered workflows</b><small>Run a published workflow without exposing the firm’s underlying prompts or knowledge rules.</small></div></div><select value={workflowId} onChange={e=>setWorkflowId(e.target.value)}><option value="">Choose a workflow</option>{workflows.map(w=><option key={w.resource_id} value={w.resource_id}>{w.label||"Published workflow"}</option>)}</select><Textarea value={workflowInput} onChange={e=>setWorkflowInput(e.target.value)} placeholder="Provide the facts or instructions this workflow needs…"/><Button onClick={run} disabled={busy||!workflowId}><Play/> Run workflow</Button>{workflowOutput?<pre className="portal-workflow-output">{workflowOutput}</pre>:null}</section>:null}{error?<p className="portal-message">{error}</p>:null}</div>;
}
