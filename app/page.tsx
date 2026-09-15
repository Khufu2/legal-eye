"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Menu, Moon, Sun, ArrowUpRight, BookOpen, Bot, BriefcaseBusiness, Check, ChevronDown,
  ChevronRight, CircleAlert, ClipboardCheck, Clock3, Columns3, Command as CommandIcon,
  FileClock, FilePenLine, Files, FolderLock, Gavel, Globe2, LibraryBig, ListChecks,
  LockKeyhole, MessageSquareText, MoreHorizontal, PanelRightOpen, Play, Plus, Search,
  Database, Eye, KeyRound, Network, ShieldCheck, Sparkles, Table2, Upload, Users, Workflow, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { AgentLive, ListsLive, MattersLive, MonitorsLive, SkillsLive, TablesLive, WorkflowsLive } from "@/components/legal-eye-live";
import { EditorLive } from "@/components/legal-eye-editor";
import { PortalHostPro } from "@/components/legal-eye-portal-host";
import { ResearchHome, ResearchLive, EyeMark } from "@/components/legal-eye-research";
import {downloadDocx} from "@/lib/legal/docx";
import {workspace} from "@/lib/legal/client";
import { TrustLive } from "@/components/legal-eye-trust-live";

type View = "ask"|"research"|"draft"|"review"|"tables"|"lists"|"matters"|"vault"|"portal"|"agent"|"skills"|"workflows"|"monitor"|"trust";
type Tone = "neutral"|"green"|"blue"|"amber"|"red";
type CorpusDocument = { title:string; citation:string|null; published_at:string|null; canonical_url:string|null; jurisdiction_code:string; document_type:string };
type VaultDocument = { id:string; title:string; file_name:string|null; status:string; created_at:string; size_bytes:number|null };
type WorkspaceIdentity = { refresh_token?:string; expires_at?:number; access_token:string; user:{ id:string; email?:string }; role:string; organization_id:string };
type CorpusStats = { TZ:number; UK:number; EU:number; searchable:number|null };
type ReviewFinding = { id?:string; status?:string; title:string; clauseRef:string|null; risk:"high"|"medium"|"low"|"info"; whyItMatters:string; originalText?:string|null; suggestedText?:string|null };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const primary = [
  ["ask","Ask",MessageSquareText],["research","Research",Search],["draft","Editor",FilePenLine],
  ["review","Review",ClipboardCheck],["tables","Tables",Table2],["lists","Lists",ListChecks],
] as const;
const context = [["matters","Matters",BriefcaseBusiness],["vault","Vault",FolderLock],["portal","Portal",Globe2]] as const;
const intelligence = [["agent","Agent",Bot],["skills","Skills",Sparkles],["workflows","Workflows",Workflow],["monitor","Monitor",Activity],["trust","Trust",ShieldCheck]] as const;
const allNav = [...primary,...context,...intelligence];

function ToneBadge({children,tone="neutral"}:{children:React.ReactNode;tone?:Tone}) {
  return <Badge className={"tone-badge tone-"+tone}>{children}</Badge>;
}
function Header({title,meta,action}:{title:string;meta:string;action?:React.ReactNode}) {
  return <div className="section-header"><div><h1>{title}</h1><p>{meta}</p></div>{action}</div>;
}
function VaultView({identity,documents,connect,refresh}:{identity:WorkspaceIdentity|null;documents:VaultDocument[];connect:()=>void;refresh:()=>void}) {
  const input=useRef<HTMLInputElement>(null),[uploading,setUploading]=useState(false),[filter,setFilter]=useState(""),[preview,setPreview]=useState<{title:string;text:string}|null>(null);
  useEffect(()=>{if(!identity)return;const timer=window.setInterval(refresh,10000);return()=>window.clearInterval(timer)},[identity]);
  const viewText=async(id:string)=>{if(!identity)return;try{const chunks=await workspace<Array<{page_number:number|null;content:string}>>(identity,`document_chunks?select=page_number,content&document_id=eq.${id}&order=id.asc&limit=150`);setPreview({title:documents.find(d=>d.id===id)?.title||"Source",text:chunks.map(c=>`${c.page_number?`Page ${c.page_number}\n`:""}${c.content}`).join("\n\n")||"No searchable passages yet. Retry processing or refresh after processing finishes."});}catch(e){toast.error(e instanceof Error?e.message:"Source unavailable");}};
  const retry=async(id:string)=>{if(!identity)return;try{const r=await fetch("/api/process-document",{method:"POST",headers:{Authorization:`Bearer ${identity.access_token}`,"content-type":"application/json"},body:JSON.stringify({document_id:id,organization_id:identity.organization_id})});const result=await r.json();if(!r.ok)throw new Error(result.error);toast.success("Processing requested");refresh();}catch(e){toast.error(e instanceof Error?e.message:"Processing failed");}};
  const upload=async(file?:File)=>{
    if(!file)return;
    if(file.size>50000000){toast.error("Choose a document under 50 MB.");return;}
    if(!identity){connect();toast("Sign in to your organization before uploading.");return;}
    setUploading(true);
    try{
      const safeName=file.name.replace(/[^a-zA-Z0-9._-]+/g,"-");
      const storagePath=`${identity.organization_id}/${crypto.randomUUID()}/${safeName}`;
      const stored=await fetch(`${SUPABASE_URL}/storage/v1/object/firm-vault/${storagePath.split("/").map(encodeURIComponent).join("/")}`,{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+identity.access_token,"content-type":file.type||"application/octet-stream","x-upsert":"false"},body:file});
      if(!stored.ok)throw new Error((await stored.json().catch(()=>null))?.message||"Secure upload failed");
      const created=await fetch(SUPABASE_URL+"/rest/v1/documents",{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+identity.access_token,"content-type":"application/json",Prefer:"return=representation"},body:JSON.stringify({organization_id:identity.organization_id,title:file.name.replace(/\.[^.]+$/,""),file_name:file.name,mime_type:file.type||null,storage_path:storagePath,size_bytes:file.size,status:"uploaded",jurisdiction_codes:["TZ"],uploaded_by:identity.user.id,metadata:{upload_channel:"legal-eye-web",classification:"confidential"}})});
      const rows=await created.json();
      if(!created.ok||!rows?.[0])throw new Error(rows?.message||"Document record could not be created");
      const process=await fetch("/api/process-document",{method:"POST",headers:{Authorization:"Bearer "+identity.access_token,"content-type":"application/json"},body:JSON.stringify({document_id:rows[0].id,organization_id:identity.organization_id})});
      const job=await process.json().catch(()=>({}));
      if(!process.ok)throw new Error(job?.error||"Document processing could not be queued");
      toast.success("Document secured",{description:job.status==="complete"?"Searchable text is ready in Supabase.":"Stored in Supabase. Hybrid processing is queued: Docling first, lightweight extraction fallback."});refresh();
    }catch(error){toast.error(error instanceof Error?error.message:"Upload failed")}finally{setUploading(false);if(input.current)input.current.value=""}
  };
  const display=documents.filter(d=>`${d.title} ${d.file_name}`.toLowerCase().includes(filter.toLowerCase())).map(d=>[d.id,d.title,d.status,d.file_name||"Private document"]);
  return <div className="view-pad"><Header title="Private knowledge" meta="Permission-filtered firm work, isolated from the public authority graph." action={<><input ref={input} hidden type="file" accept=".pdf,.docx,.xlsx,.txt" onChange={event=>upload(event.target.files?.[0])}/><Button onClick={()=>identity?input.current?.click():connect()} disabled={uploading}><Upload/> {uploading?"Securing…":"Upload"}</Button></>}/><Input aria-label="Search private documents" placeholder="Search your documents…" value={filter} onChange={e=>setFilter(e.target.value)}/><div className="vault-grid"><section>{display.length?display.map(x=><div className="vault-document" key={x[0]}><i><FolderLock/></i><span><b>{x[1]}</b><small>{x[2]} · {x[3]}</small></span><Button variant="ghost" onClick={()=>void viewText(x[0])}>Open text</Button>{x[2]!=="ready"&&<Button variant="outline" onClick={()=>void retry(x[0])}>Retry processing</Button>}</div>):<div className="empty-live"><FolderLock/><h2>{identity?"Your vault is empty":"Sign in to open the vault"}</h2><p>{identity?"Upload the first real client document.":"Private knowledge is available only to organization members."}</p></div>}</section><aside><ShieldCheck/><h2>Private Firm Intelligence</h2><p>Client content is permission-filtered before retrieval. Public and firm graphs stay separate and every agent action is auditable.</p>{[["Encryption","Supabase storage · private bucket"],["Data boundary","Organization + matter RLS"],["Model training","Disabled for private data"],["Parser","Docling + lightweight fallback"]].map(x=><div key={x[0]}><span>{x[0]}</span><b>{x[1]}</b></div>)}</aside></div><Dialog open={!!preview} onOpenChange={open=>{if(!open)setPreview(null)}}><DialogContent className="vault-preview"><DialogHeader><DialogTitle>{preview?.title}</DialogTitle><DialogDescription>Exact processed source text</DialogDescription></DialogHeader><pre>{preview?.text}</pre></DialogContent></Dialog></div>;
}
function ReviewView({identity,connect,documents,refresh}:{identity:WorkspaceIdentity|null;connect:()=>void;documents:VaultDocument[];refresh:()=>void}) {
  const [contract,setContract]=useState(""),[findings,setFindings]=useState<ReviewFinding[]>([]),[reviewing,setReviewing]=useState(false),[selectedDocument,setSelectedDocument]=useState(""),[reviewProjectId,setReviewProjectId]=useState<string|null>(null),[loadedTitle,setLoadedTitle]=useState("Pasted agreement text");
  const [history,setHistory]=useState<Array<{id:string;document_id:string;created_at:string;overall_risk:string}>>([]);
  const loadHistory=async()=>{if(identity)setHistory(await workspace(identity,`review_projects?select=id,document_id,created_at,overall_risk&organization_id=eq.${identity.organization_id}&order=created_at.desc&limit=50`));};
  useEffect(()=>{void loadHistory().catch(()=>undefined)},[identity]);
  const openReview=async(id:string)=>{if(!identity)return;try{const rows=await workspace<Array<{id:string;status:string;title:string;risk:ReviewFinding['risk'];clause_ref:string;why_it_matters:string;original_text:string;suggested_text:string}>>(identity,`review_findings?review_project_id=eq.${id}&order=created_at.asc`);setFindings(rows.map(r=>({id:r.id,status:r.status,title:r.title,risk:r.risk,clauseRef:r.clause_ref,whyItMatters:r.why_it_matters,originalText:r.original_text,suggestedText:r.suggested_text})));setReviewProjectId(id);const project=history.find(p=>p.id===id);setLoadedTitle(documents.find(d=>d.id===project?.document_id)?.title||"Saved review");setSelectedDocument(project?.document_id||"");setContract("");}catch(e){toast.error(e instanceof Error?e.message:"Review could not be reopened");}};
  const decide=async(finding:ReviewFinding,status:string)=>{if(!identity||!finding.id)return;try{await workspace(identity,`review_findings?id=eq.${finding.id}`,{method:"PATCH",body:JSON.stringify({status})});setFindings(rows=>rows.map(r=>r.id===finding.id?{...r,status}:r));}catch(e){toast.error(e instanceof Error?e.message:"Finding update failed");}};
  const exportWord=()=>downloadDocx(`Contract review — ${loadedTitle}`,findings.map((f,i)=>`## ${i+1}. ${f.title}\nRisk: ${f.risk} · Status: ${f.status||"open"}\n${f.whyItMatters}\n\nOriginal: ${f.originalText||"Not quoted"}\nProposed wording: ${f.suggestedText||"None"}\nSource: ${f.clauseRef||"Document text"}`).join("\n\n"));
  const authHeaders=identity?{apikey:SUPABASE_KEY,Authorization:"Bearer "+identity.access_token}:null;
  const resetResults=()=>{setFindings([]);setReviewProjectId(null)};
  const loadDocument=async(id:string)=>{
    setSelectedDocument(id);resetResults();
    if(!id){setContract("");setLoadedTitle("Pasted agreement text");return;}
    if(!identity){connect();return;}
    const doc=documents.find(item=>item.id===id);setLoadedTitle(doc?.title||"Private document");
    try{
      const response=await fetch(SUPABASE_URL+`/rest/v1/document_chunks?select=clause_number,paragraph_number,page_number,content&document_id=eq.${encodeURIComponent(id)}&order=id.asc&limit=1000`,{headers:authHeaders!});
      const chunks=await response.json();
      if(!response.ok)throw new Error(chunks?.message||"Document text could not be loaded");
      if(!chunks.length){setContract("");throw new Error(`Processing has not produced searchable text for ${doc?.title||"this document"} yet (${doc?.status||"unknown"}).`)}
      setContract(chunks.map((chunk:{clause_number?:string;paragraph_number?:string;page_number?:number;content:string})=>{const ref=chunk.clause_number||chunk.paragraph_number||(chunk.page_number?`page ${chunk.page_number}`:null);return `${ref?`[${ref}] `:""}${chunk.content}`}).join("\n\n"));
      toast.success("Processed document loaded",{description:`${chunks.length} exact source chunks are available for review.`});
    }catch(error){toast.error(error instanceof Error?error.message:"Document text could not be loaded")}
  };
  const createPastedSource=async()=>{
    if(!identity)throw new Error("Sign in required");
    const blob=new Blob([contract],{type:"text/plain;charset=utf-8"});
    const stamp=new Date().toISOString().replace(/[:.]/g,"-");
    const fileName=`pasted-contract-${stamp}.txt`,storagePath=`${identity.organization_id}/${crypto.randomUUID()}/${fileName}`;
    const stored=await fetch(`${SUPABASE_URL}/storage/v1/object/firm-vault/${storagePath.split("/").map(encodeURIComponent).join("/")}`,{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+identity.access_token,"content-type":"text/plain;charset=utf-8","x-upsert":"false"},body:blob});
    if(!stored.ok)throw new Error((await stored.json().catch(()=>null))?.message||"Pasted source could not be secured");
    const created=await fetch(SUPABASE_URL+"/rest/v1/documents",{method:"POST",headers:{...authHeaders!,"content-type":"application/json",Prefer:"return=representation"},body:JSON.stringify({organization_id:identity.organization_id,title:`Pasted contract · ${new Date().toLocaleDateString()}`,file_name:fileName,mime_type:"text/plain",storage_path:storagePath,size_bytes:blob.size,status:"uploaded",jurisdiction_codes:["TZ"],uploaded_by:identity.user.id,metadata:{upload_channel:"review-paste",classification:"confidential"}})});
    const rows=await created.json();
    if(!created.ok||!rows?.[0]?.id)throw new Error(rows?.message||"Pasted source record could not be created");
    await fetch("/api/process-document",{method:"POST",headers:{Authorization:"Bearer "+identity.access_token,"content-type":"application/json"},body:JSON.stringify({document_id:rows[0].id,organization_id:identity.organization_id})});refresh();
    return rows[0].id as string;
  };
  const persistReview=async(documentId:string,data:{overallRisk?:string;summary?:string;provider?:string;findings?:ReviewFinding[]})=>{
    if(!identity)throw new Error("Sign in required");
    const allowed=new Set(["high","medium","low","info"]),risk=allowed.has(data.overallRisk||"")?data.overallRisk:"info";
    const project=await fetch(SUPABASE_URL+"/rest/v1/review_projects",{method:"POST",headers:{...authHeaders!,"content-type":"application/json",Prefer:"return=representation"},body:JSON.stringify({organization_id:identity.organization_id,document_id:documentId,created_by:identity.user.id,overall_risk:risk,status:"complete",summary:{finding_count:data.findings?.length||0,provider:data.provider||"unknown",summary:data.summary||null,source:"legal-eye-web"}})});
    const projects=await project.json();
    if(!project.ok||!projects?.[0]?.id)throw new Error(projects?.message||"Review project could not be saved");
    const projectId=projects[0].id as string;
    if(data.findings?.length){
      const saved=await fetch(SUPABASE_URL+"/rest/v1/review_findings",{method:"POST",headers:{...authHeaders!,"content-type":"application/json",Prefer:"return=minimal"},body:JSON.stringify(data.findings.map(f=>({review_project_id:projectId,title:f.title||"Finding",risk:allowed.has(f.risk)?f.risk:"info",clause_ref:f.clauseRef||null,why_it_matters:f.whyItMatters||null,original_text:f.originalText||null,suggested_text:f.suggestedText||null,status:"open",metadata:{provider:data.provider||"unknown"}})))});
      if(!saved.ok)throw new Error((await saved.json().catch(()=>null))?.message||"Review findings could not be saved");
    }
    return projectId;
  };
  const runReview=async()=>{
    if(!identity){connect();return;}
    if(contract.trim().length<20){toast.error("Load a processed document or paste contract text first.");return;}
    setReviewing(true);resetResults();
    try{
      const documentId=selectedDocument||await createPastedSource();
      const response=await fetch("/api/legal-ai",{method:"POST",headers:{Authorization:"Bearer "+identity.access_token,"content-type":"application/json"},body:JSON.stringify({action:"review",organization_id:identity.organization_id,text:contract,playbook:["Require consent mechanics and identify closing risk.","Data protection indemnity must be proportionate and addressed against the negotiated liability cap.","Flag inconsistencies between governing law, dispute forum, and mandatory Tanzanian approvals."]})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Review failed");
      const next=(data.findings||[]) as ReviewFinding[];setFindings(next);
      const projectId=await persistReview(documentId,{...data,findings:next});setReviewProjectId(projectId);await loadHistory();const saved=await workspace<Array<{id:string;title:string;status:string}>>(identity,`review_findings?select=id,title,status&review_project_id=eq.${projectId}`);setFindings(next.map(f=>({...f,id:saved.find(r=>r.title===f.title)?.id,status:"open"})));
      toast.success("Contract review saved",{description:`${next.length} text-supported findings were persisted for lawyer review.`});
    }catch(error){toast.error(error instanceof Error?error.message:"Review failed")}finally{setReviewing(false)}
  };
  const exportReview=()=>{
    if(!reviewProjectId)return;
    const payload={review_project_id:reviewProjectId,document:selectedDocument||loadedTitle,exported_at:new Date().toISOString(),lawyer_verification_required:true,findings};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
    const anchor=document.createElement("a");anchor.href=url;anchor.download=`legal-eye-review-${reviewProjectId}.json`;document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);toast.success("Review exported");
  };
  return <div className="view-pad"><Header title="Review" meta="Playbook-backed findings, saved results and exact document text in one workspace." action={<div className="row"><Button variant="outline" onClick={exportWord} disabled={!findings.length}>Export Word</Button><Button variant="outline" onClick={exportReview} disabled={!reviewProjectId}>JSON</Button><Button onClick={runReview} disabled={reviewing||contract.trim().length<20}><Sparkles/> {reviewing?"Reviewing…":"Run AI review"}</Button></div>}/>
    <div className="review-source-picker"><label><span>Saved reviews</span><select aria-label="Saved reviews" value={reviewProjectId||""} onChange={e=>{if(e.target.value)void openReview(e.target.value)}}><option value="">New review</option>{history.map(h=><option key={h.id} value={h.id}>{documents.find(d=>d.id===h.document_id)?.title||"Contract review"} · {new Date(h.created_at).toLocaleDateString()}</option>)}</select></label><label><span>Source document</span><select value={selectedDocument} onChange={event=>void loadDocument(event.target.value)}><option value="">Paste contract text</option>{documents.map(doc=><option value={doc.id} key={doc.id}>{doc.title} · {doc.status}</option>)}</select></label>{selectedDocument?<ToneBadge tone={contract?"green":"amber"}>{contract?"Source loaded":"Processing required"}</ToneBadge>:<ToneBadge>Private pasted source</ToneBadge>}</div>
    <div className="review-summary">{[["Document",loadedTitle],["Playbook","Core legal review"],["Findings",String(findings.length)],["Saved",reviewProjectId?"Yes":"Not yet"]].map(x=><div key={x[0]}><span>{x[0]}</span><b>{x[1]}</b></div>)}</div>
    <Textarea value={contract} onChange={event=>{setContract(event.target.value);if(selectedDocument){setSelectedDocument("");setLoadedTitle("Pasted agreement text")}resetResults()}} placeholder="Paste the agreement text, or select a processed vault document above..." aria-label="Contract text for review"/>
    <div className="findings">{findings.length?findings.map((finding,index)=><article key={`${finding.title}-${index}`}><i className={finding.risk}/><span><ToneBadge tone={finding.risk==="high"?"red":finding.risk==="low"?"green":finding.risk==="info"?"blue":"amber"}>{finding.risk[0].toUpperCase()+finding.risk.slice(1)}</ToneBadge><h3>{finding.title}</h3><p>{finding.whyItMatters}</p>{finding.originalText?<blockquote>{finding.originalText}</blockquote>:null}{finding.suggestedText?<div className="suggested-text"><small>Suggested lawyer-review wording</small><p>{finding.suggestedText}</p></div>:null}<small>{finding.clauseRef||"Contract text"} · {finding.status||"open"}</small>{finding.id&&<div className="row"><Button variant="outline" size="sm" onClick={()=>void decide(finding,"accepted")}>Accept finding</Button><Button variant="ghost" size="sm" onClick={()=>void decide(finding,"dismissed")}>Dismiss</Button><Button variant="ghost" size="sm" onClick={()=>void decide(finding,"open")}>Reopen</Button></div>}</span></article>):<div className="empty-live"><ClipboardCheck/><h2>No findings yet</h2><p>Select a processed private document or paste agreement text, then run the review.</p></div>}</div>
  </div>;
}

function LegalEye() {
  const [view,setView]=useState<View>("ask"), [command,setCommand]=useState(false), [count,setCount]=useState(0), [documentCount,setDocumentCount]=useState(0), [liveDocuments,setLiveDocuments]=useState<CorpusDocument[]>([]),[corpusStats,setCorpusStats]=useState<CorpusStats>({TZ:0,UK:0,EU:0,searchable:null}),[vaultDocuments,setVaultDocuments]=useState<VaultDocument[]>([]);
  const [researchSession,setResearchSession]=useState<string|null>(null),[jurisdictions,setJurisdictions]=useState<string[]>(["TZ"]),[privateContext,setPrivateContext]=useState(true),[navOpen,setNavOpen]=useState(false),[commandQuery,setCommandQuery]=useState(""),[theme,setTheme]=useState("dark"),[matterId,setMatterId]=useState<string|null>(null),[matters,setMatters]=useState<Array<{id:string;name:string}>>([]);
  const [researchQuery,setResearchQuery]=useState(""),[researchRun,setResearchRun]=useState(0);
  const [authOpen,setAuthOpen]=useState(false), [email,setEmail]=useState(""), [password,setPassword]=useState(""), [identity,setIdentity]=useState<WorkspaceIdentity|null>(null), [signingIn,setSigningIn]=useState(false);
  const refreshVault=async(current=identity)=>{if(!current){setVaultDocuments([]);return;}const response=await fetch(SUPABASE_URL+"/rest/v1/documents?select=id,title,file_name,status,created_at,size_bytes&organization_id=eq."+current.organization_id+"&order=created_at.desc&limit=500",{headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+current.access_token}});if(response.ok)setVaultDocuments(await response.json())};
  const signIn=async()=>{
    setSigningIn(true);
    try{
      const response=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{apikey:SUPABASE_KEY,"content-type":"application/json"},body:JSON.stringify({email,password})});
      const data=await response.json();
      if(!response.ok) throw new Error(data?.error_description||data?.msg||"Sign in failed");
      const membership=await fetch(SUPABASE_URL+`/rest/v1/organization_members?select=role,organization_id&user_id=eq.${data.user.id}&is_active=is.true&limit=1`,{headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+data.access_token}});
      const memberships=membership.ok?await membership.json():[];
      if(!memberships[0]?.organization_id)throw new Error("No active organization membership was found");
      const next={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:data.expires_at,user:data.user,role:memberships[0].role||"member",organization_id:memberships[0].organization_id};
      sessionStorage.setItem("legal-eye-session",JSON.stringify(next));setIdentity(next);setPassword("");setAuthOpen(false);await refreshVault(next);if(researchQuery.trim()){setResearchRun(x=>x+1);setView("research")}toast.success("Organization connected");
    }catch(error){toast.error(error instanceof Error?error.message:"Sign in failed")}finally{setSigningIn(false)}
  };
  const signOut=()=>{sessionStorage.removeItem("legal-eye-session");setIdentity(null);setVaultDocuments([]);setAuthOpen(false);toast("Signed out")};
  useEffect(()=>{try{const saved=sessionStorage.getItem("legal-eye-session");const parsed=saved?JSON.parse(saved):null;if(parsed?.organization_id)setTimeout(()=>setIdentity(parsed),0)}catch{sessionStorage.removeItem("legal-eye-session")}},[]);
  useEffect(()=>{if(!identity?.refresh_token)return;const session=identity;const renew=async()=>{try{const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{apikey:SUPABASE_KEY,"content-type":"application/json"},body:JSON.stringify({refresh_token:session.refresh_token})});const data=await r.json();if(!r.ok){if(r.status===400||r.status===401){sessionStorage.removeItem("legal-eye-session");setIdentity(null);toast.error("Your session expired. Sign in again.");}return;}const next={...session,access_token:data.access_token,refresh_token:data.refresh_token,expires_at:data.expires_at};sessionStorage.setItem("legal-eye-session",JSON.stringify(next));setIdentity(next);}catch{toast.error("Session refresh failed. Check your connection.");}};const delay=Math.max(1000,((session.expires_at||Date.now()/1000+300)-Date.now()/1000-60)*1000);const timer=window.setTimeout(()=>void renew(),delay);return()=>window.clearTimeout(timer)},[identity]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setCommand(x=>!x)}};document.addEventListener("keydown",key);const selected=new URLSearchParams(window.location.search).get("view");if(allNav.some(n=>n[0]===selected))setView(selected as View);const session=new URLSearchParams(window.location.search).get("research");if(session&&/^[0-9a-f-]{36}$/.test(session)){setResearchSession(session);setView("research")}const t=localStorage.getItem("legal-eye-theme")||"dark";setTheme(t);document.documentElement.dataset.theme=t;return()=>document.removeEventListener("keydown",key)},[]);
  useEffect(()=>{if(!SUPABASE_URL||!SUPABASE_KEY)return;let cancelled=false;const headers={apikey:SUPABASE_KEY,"content-type":"application/json",...(identity?{Authorization:"Bearer "+identity.access_token}:{})};fetch(SUPABASE_URL+"/rest/v1/rpc/legal_corpus_overview",{method:"POST",headers,body:"{}"}).then(async r=>{if(!r.ok)return;const d=await r.json();if(cancelled)return;setCount(d.sources);setDocumentCount(d.documents);setCorpusStats({TZ:d.jurisdictions?.TZ||0,UK:d.jurisdictions?.UK||0,EU:d.jurisdictions?.EU||0,searchable:d.chunks})}).catch(()=>undefined);fetch(SUPABASE_URL+"/rest/v1/legal_documents?select=title,citation,published_at,canonical_url,jurisdiction_code,document_type&order=published_at.desc.nullslast&limit=12",{headers}).then(async r=>{if(r.ok&&!cancelled)setLiveDocuments(await r.json())}).catch(()=>undefined);return()=>{cancelled=true}},[identity]);
  useEffect(()=>{if(!identity){setMatters([]);return}fetch(SUPABASE_URL+"/rest/v1/matters?select=id,name&organization_id=eq."+identity.organization_id+"&order=name",{headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+identity.access_token}}).then(async r=>{if(r.ok)setMatters(await r.json())}).catch(()=>undefined)},[identity,view]);

  useEffect(()=>{if(!identity)return;const current=identity;fetch(SUPABASE_URL+"/rest/v1/documents?select=id,title,file_name,status,created_at,size_bytes&organization_id=eq."+current.organization_id+"&order=created_at.desc&limit=500",{headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+current.access_token}}).then(async response=>{if(response.ok)setVaultDocuments(await response.json())}).catch(()=>null)},[identity]);
  const title=useMemo(()=>allNav.find(x=>x[0]===view)?.[1]||"Research",[view]), go=(v:View)=>{setView(v);setCommand(false);setNavOpen(false);const url=new URL(window.location.href);url.searchParams.set("view",v);if(v!=="research")url.searchParams.delete("research");window.history.replaceState(null,"",url)};
  const connect=()=>setAuthOpen(true);
  const rememberSession=(id:string)=>{setResearchSession(id);const u=new URL(window.location.href);u.searchParams.set("research",id);u.searchParams.set("view","research");window.history.replaceState({},"",u)};
  const ask=(question:string)=>{if(question.trim().length<3)return;setResearchSession(null);setResearchQuery(question);if(!identity){connect();return;}setResearchRun(x=>x+1);go("research")};
  const content=view==="research"?<ResearchLive key={researchRun} identity={identity} connect={connect} initialQuery={researchQuery} autoRun={researchRun} sessionId={researchSession} onSession={rememberSession} jurisdictions={jurisdictions} setJurisdictions={setJurisdictions} matterId={matterId} privateContext={privateContext}/>:view==="ask"?<ResearchHome identity={identity} navigate={v=>go(v as View)} go={ask} openSession={id=>{rememberSession(id);go("research")}} jurisdictions={jurisdictions} setJurisdictions={setJurisdictions} privateContext={privateContext} setPrivateContext={setPrivateContext}/>:view==="draft"?<EditorLive identity={identity} connect={connect}/>:view==="tables"?<TablesLive identity={identity} connect={connect} documents={vaultDocuments}/>:view==="agent"?<AgentLive identity={identity} connect={connect} documents={vaultDocuments}/>:view==="skills"?<SkillsLive identity={identity} connect={connect} documents={vaultDocuments}/>:view==="lists"?<ListsLive identity={identity} connect={connect} documents={vaultDocuments}/>:view==="monitor"?<MonitorsLive identity={identity} connect={connect} documents={liveDocuments} stats={corpusStats} total={documentCount}/>:view==="workflows"?<WorkflowsLive identity={identity} connect={connect} documents={vaultDocuments}/>:view==="matters"?<MattersLive identity={identity} connect={connect}/>:view==="vault"?<VaultView identity={identity} documents={vaultDocuments} connect={connect} refresh={()=>void refreshVault()}/>:view==="portal"?<PortalHostPro identity={identity} connect={connect} documents={vaultDocuments}/>:view==="trust"?<TrustLive identity={identity} connect={connect}/>:<ReviewView identity={identity} connect={connect} documents={vaultDocuments} refresh={()=>void refreshVault()}/>;
  return <div className={"legal-app view-"+view}>
    <header className="workspace-header"><button className="workspace-brand" onClick={()=>go("ask")} aria-label="Legal Eye home"><EyeMark/><b>Legal Eye</b></button><nav aria-label="Primary navigation">{[["ask","Ask"],["research","Research"],["draft","Editor"],["review","Review"],["vault","Library"]].map(([id,label])=><button key={id} aria-current={view===id?"page":undefined} onClick={()=>go(id as View)}>{label}</button>)}<button className="more-button" onClick={()=>setNavOpen(!navOpen)} aria-expanded={navOpen}>More <ChevronDown size={14}/></button></nav><div className="workspace-header-actions"><button aria-label="Search workspace" onClick={()=>setCommand(true)}><Search size={18}/></button><button aria-label={theme==="dark"?"Use light mode":"Use dark mode"} onClick={()=>{const t=theme==="dark"?"light":"dark";setTheme(t);document.documentElement.dataset.theme=t;localStorage.setItem("legal-eye-theme",t)}}>{theme==="dark"?<Sun size={18}/>:<Moon size={18}/>}</button><Button variant="outline" className="account-button" onClick={()=>setAuthOpen(true)}>{identity?"Account":"Sign in"}</Button><button className="mobile-menu" aria-label="Open navigation" onClick={()=>setNavOpen(!navOpen)}><Menu/></button></div></header>
    {navOpen&&<div className="workspace-menu"><div className="pane-heading"><h2>Workspace</h2><button aria-label="Close navigation" onClick={()=>setNavOpen(false)}><X/></button></div>{allNav.map(([id,label,Icon])=><button key={id} aria-current={view===id?"page":undefined} onClick={()=>go(id)}><Icon size={18}/>{label}<ChevronRight size={14}/></button>)}<a href="/office/word">Word add-in <ArrowUpRight size={14}/></a><a href="/office/outlook">Outlook add-in <ArrowUpRight size={14}/></a></div>}
    {view!=="ask"&&<div className="workspace-context"><span>{title}</span><label><BriefcaseBusiness size={15}/><select aria-label="Current matter" value={matterId||""} onChange={e=>setMatterId(e.target.value||null)}><option value="">All workspace matters</option>{matters.map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</select></label></div>}
    <main key={identity?.user.id||"signed-out"} className="workspace-main">{content}</main><footer className="workspace-footer"><span><i/> {corpusStats.searchable===null?"Corpus status unavailable":`${corpusStats.searchable.toLocaleString()} source passages`}</span><span>{documentCount.toLocaleString()} legal records</span><span>Legal work, grounded in evidence.</span></footer>
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">{[["ask","Ask",MessageSquareText],["research","History",Clock3],["vault","Files",Files],["matters","Matters",BriefcaseBusiness]].map(([id,label,Icon])=>{const I=Icon as typeof Search;return <button key={String(id)} aria-current={view===id?"page":undefined} onClick={()=>go(id as View)}><I size={19}/>{String(label)}</button>})}</nav>
    <Dialog open={command} onOpenChange={setCommand}><DialogContent className="command-dialog"><DialogHeader><DialogTitle>Go anywhere</DialogTitle><DialogDescription>Search Legal Eye or open a workspace.</DialogDescription></DialogHeader><div className="command-search"><Search/><Input autoFocus placeholder="Find a workspace…" value={commandQuery} onChange={e=>setCommandQuery(e.target.value)}/></div><div className="command-list">{allNav.filter(([,label])=>label.toLowerCase().includes(commandQuery.toLowerCase())).map(([id,label,Icon])=><button key={id} onClick={()=>go(id)}><Icon/><span>{label}</span><kbd>↵</kbd></button>)}</div></DialogContent></Dialog>
    <Dialog open={authOpen} onOpenChange={setAuthOpen}><DialogContent><DialogHeader><DialogTitle>{identity?"Organization access":"Sign in to Legal Eye"}</DialogTitle><DialogDescription>{identity?"Your secure organization session is active for this browser tab.":"Use the credentials issued by your Legal Eye organization owner."}</DialogDescription></DialogHeader>{identity?<div className="auth-session"><ShieldCheck/><div><b>{identity.user.email}</b><span>{identity.role} · private organization workspace</span></div><Button variant="outline" onClick={signOut}>Sign out</Button></div>:<div className="auth-form"><label>Email<Input type="email" value={email} onChange={event=>setEmail(event.target.value)} autoComplete="username"/></label><label>Password<Input type="password" value={password} onChange={event=>setPassword(event.target.value)} onKeyDown={event=>event.key==="Enter"&&signIn()} autoComplete="current-password"/></label><Button onClick={signIn} disabled={signingIn||!email||!password}>{signingIn?"Signing in…":"Sign in"}</Button></div>}</DialogContent></Dialog>
    <Toaster position="bottom-right" richColors/>
  </div>;
}
export default function Home(){return <LegalEye/>}
