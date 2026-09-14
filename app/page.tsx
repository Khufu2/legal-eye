"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowUpRight, BookOpen, Bot, BriefcaseBusiness, Check, ChevronDown,
  ChevronRight, CircleAlert, ClipboardCheck, Clock3, Columns3, Command as CommandIcon,
  FileClock, FilePenLine, Files, FolderLock, Gavel, Globe2, LibraryBig, ListChecks,
  LockKeyhole, MessageSquareText, MoreHorizontal, PanelRightOpen, Play, Plus, Search,
  Database, Eye, KeyRound, Network, ShieldCheck, Sparkles, Table2, Upload, Users, Workflow, X,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

type View = "ask"|"research"|"draft"|"review"|"tables"|"lists"|"matters"|"vault"|"agent"|"skills"|"workflows"|"monitor"|"trust";
type Tone = "neutral"|"green"|"blue"|"amber"|"red";
type Source = { id:string; title:string; citation:string; court:string; date:string; treatment:string; tone:Tone; excerpt:string; note:string; url?:string; page?:number; paragraph?:string; sourceKind?:"public"|"private"; legalDocumentId?:string; privateDocumentId?:string; chunkId?:number; rank?:number };
type CorpusDocument = { title:string; citation:string|null; published_at:string|null; canonical_url:string|null; jurisdiction_code:string; document_type:string };
type CorpusPolicy = { name:string; jurisdiction_code:string|null; policy_state:string; sync_enabled:boolean; last_synced_at:string|null; license_name:string|null };
type VaultDocument = { id:string; title:string; file_name:string|null; status:string; created_at:string; size_bytes:number|null };
type DemoIdentity = { access_token:string; user:{ id:string; email?:string }; role:string; organization_id:string };
type CorpusStats = { TZ:number; UK:number; EU:number; searchable:number|null };
type Evidence = { id?:string; chunk_id?:number; legal_document_id?:string; document_id?:string; title?:string; citation?:string; court?:string; content?:string; jurisdiction_code?:string; document_type?:string; canonical_url?:string; page_number?:number; paragraph_number?:string; source_node_ref?:string; rank?:number };
type ReviewFinding = { title:string; clauseRef:string|null; risk:"high"|"medium"|"low"|"info"; whyItMatters:string; originalText?:string|null; suggestedText?:string|null };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const primary = [
  ["ask","Ask",MessageSquareText],["research","Research",Search],["draft","Draft",FilePenLine],
  ["review","Review",ClipboardCheck],["tables","Tables",Table2],["lists","Lists",ListChecks],
] as const;
const context = [["matters","Matters",BriefcaseBusiness],["vault","Vault",FolderLock]] as const;
const intelligence = [["agent","Agent",Bot],["skills","Skills",Sparkles],["workflows","Workflows",Workflow],["monitor","Monitor",Activity],["trust","Trust",ShieldCheck]] as const;
const allNav = [...primary,...context,...intelligence];

const sources:Source[] = [
  {id:"s1",title:"Employment and Labour Relations Act",citation:"Cap. 366 R.E. 2019, s 37",court:"United Republic of Tanzania",date:"Current at 3 Sep 2026",treatment:"Legislation",tone:"blue",excerpt:"A termination of employment is unfair if the employer fails to prove that the reason for the termination is valid, fair, and related to conduct, capacity, compatibility or operational requirements.",note:"Primary legislation · official version history retained"},
  {id:"s2",title:"Illustrative appellate authority",citation:"Sample citation · not a production authority",court:"Court of Appeal · demonstration record",date:"Sample record",treatment:"Unverified",tone:"amber",excerpt:"Procedural fairness is assessed from the record as a whole. A stated reason cannot cure an inquiry that denied the employee a meaningful opportunity to answer the allegation.",note:"Illustrative workspace record · not legal authority"},
  {id:"s3",title:"Illustrative labour authority",citation:"Sample citation · not a production authority",court:"High Court, Labour Division · demonstration",date:"Sample record",treatment:"Unverified",tone:"amber",excerpt:"The employer bears the evidential burden on both substantive justification and the fairness of the procedure adopted before dismissal.",note:"Illustrative workspace record · not legal authority"},
  {id:"s4",title:"Illustrative contrary authority",citation:"Sample citation · not a production authority",court:"High Court, Labour Division · demonstration",date:"Sample record",treatment:"Unverified",tone:"red",excerpt:"A procedural omission will not invariably invalidate termination where the employee admitted the material misconduct and no prejudice is shown.",note:"Illustrative workspace record · not legal authority"},
];
const emptySource:Source = {id:"none",title:"No source selected",citation:"Run live research to retrieve authority",court:"Governed corpus",date:"",treatment:"No evidence",tone:"neutral",excerpt:"The exact retrieved passage will appear here.",note:"No demonstration authority is being displayed."};

const tableRows = [
  ["Kibo Share Purchase Agreement","SPA","Consent required","Restricted","Change of control","High","96"],
  ["Mawingu Master Services Agreement","MSA","Notice only","Consent required","No right","Medium","92"],
  ["Victoria Data Processing Addendum","DPA","Not addressed","Affiliate permitted","30 days","Low","88"],
  ["Kilimanjaro Distribution Agreement","Distribution","Consent required","Restricted","Immediate","High","94"],
  ["Bahari Facilities Lease","Lease","Landlord consent","Restricted","90 days","Medium","90"],
];
const skillRows = [
  ["Review NDA","Firm confidentiality playbook","v4.2","18/18",ShieldCheck],
  ["Tax Dispute · Tanzania","Objection, appeal and authority map","v2.6","12/12",Gavel],
  ["Employment Opinion","ELRA and Labour Court analysis","v3.1","21/21",BriefcaseBusiness],
  ["SPA Buyer Review","Buyer-side risk and redline","v5.0","26/26",Files],
  ["Regulatory Update","Impact memo with affected clients","v1.8","9/9",Globe2],
  ["Closing Checklist","Extract and assign conditions","v3.4","15/15",ListChecks],
] as const;

function ToneBadge({children,tone="neutral"}:{children:React.ReactNode;tone?:Tone}) {
  return <Badge className={"tone-badge tone-"+tone}>{children}</Badge>;
}
function Header({title,meta,action}:{title:string;meta:string;action?:React.ReactNode}) {
  return <div className="section-header"><div><h1>{title}</h1><p>{meta}</p></div>{action}</div>;
}
function EmptyFeature({title,meta,icon:Icon,identity,connect}:{title:string;meta:string;icon:typeof Search;identity:DemoIdentity|null;connect:()=>void}) {
  return <div className="view-pad"><Header title={title} meta={meta}/><div className="empty-live"><Icon/><h2>{identity?`No ${title.toLowerCase()} yet`:"Secure workspace required"}</h2><p>{identity?`Create or import real workspace data to begin using ${title.toLowerCase()}. No demonstration records are shown.`:"Sign in to your organization to access this workspace."}</p>{!identity?<Button onClick={connect}><LockKeyhole/> Sign in</Button>:null}</div></div>;
}
function Citation({n,onClick}:{n:number;onClick:()=>void}) {
  return <button className="citation-chip" onClick={onClick} aria-label={"Open source "+n}>{n}</button>;
}
function SourceViewer({source,onClose}:{source:Source;onClose?:()=>void}) {
  return <aside className="source-viewer">
    <div className="pane-title"><span>Source</span><div><Button variant="ghost" size="icon" disabled={!source.url} onClick={()=>source.url&&window.open(source.url,"_blank","noopener,noreferrer")}><ArrowUpRight/></Button>{onClose&&<Button variant="ghost" size="icon" onClick={onClose}><X/></Button>}</div></div>
    <div className="source-body">
      <span className="eyebrow">{source.court}</span><h2>{source.title}</h2><p className="serif muted">{source.citation}</p>
      <div className="row spread source-meta"><ToneBadge tone={source.tone}>{source.treatment}</ToneBadge><span>{source.date}</span></div>
      <hr/><span className="eyebrow">Relevant passage</span><blockquote>{source.excerpt}</blockquote>{(source.page||source.paragraph)&&<small>{[source.page?`Page ${source.page}`:null,source.paragraph?`¶ ${source.paragraph}`:null].filter(Boolean).join(" · ")}</small>}
      <hr/><div className="source-note"><ShieldCheck/><span>{source.note}</span></div>
      <div className="source-actions"><Button variant="outline" onClick={async()=>{try{await navigator.clipboard.writeText(source.citation);toast.success("Citation copied")}catch{toast.error("Could not copy citation")}}}>Copy citation</Button></div>
    </div>
  </aside>;
}

function Research({source,setSource,identity,connect,query,setQuery,autoRun}:{source:Source;setSource:(s:Source)=>void;identity:DemoIdentity|null;connect:()=>void;query:string;setQuery:(value:string)=>void;autoRun:number}) {
  const [running,setRunning]=useState(false),[liveAnswer,setLiveAnswer]=useState<string|null>(null),[provider,setProvider]=useState<string|null>(null),[authorities,setAuthorities]=useState<Source[]>([]),[savedId,setSavedId]=useState<string|null>(null);
  const autoRunSeen=useRef(0);
  const saveResearch=async()=>{
    if(!identity||!liveAnswer||savedId)return;
    try{
      const response=await fetch(SUPABASE_URL+"/rest/v1/research_sessions",{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+identity.access_token,"content-type":"application/json",Prefer:"return=representation"},body:JSON.stringify({organization_id:identity.organization_id,created_by:identity.user.id,title:query.slice(0,160),jurisdiction_codes:["TZ","UK","EU"],mode:"deep",use_firm_knowledge:true,query,status:"complete",answer_markdown:liveAnswer,metadata:{provider,evidence:authorities.map(s=>({title:s.title,citation:s.citation,court:s.court,url:s.url,page:s.page,paragraph:s.paragraph,source_kind:s.sourceKind,legal_document_id:s.legalDocumentId,private_document_id:s.privateDocumentId,chunk_id:s.chunkId,rank:s.rank,excerpt:s.excerpt}))},completed_at:new Date().toISOString()})});
      const rows=await response.json();
      if(!response.ok||!rows?.[0]?.id)throw new Error(rows?.message||"Research could not be saved");
      setSavedId(rows[0].id);toast.success("Research saved",{description:"The answer and exact evidence snapshot are persisted to your workspace."});
    }catch(error){toast.error(error instanceof Error?error.message:"Research could not be saved")}
  };
  const run=async()=>{
    if(!identity){connect();toast("Sign in to your organization to run live research.");return;}
    setRunning(true);setLiveAnswer(null);setSavedId(null);
    try{
      const response=await fetch("/api/legal-ai",{method:"POST",headers:{Authorization:"Bearer "+identity.access_token,"content-type":"application/json"},body:JSON.stringify({action:"research",query,jurisdictions:["TZ","UK","EU"],organization_id:identity.organization_id,use_firm_knowledge:true})});
      const data=await response.json();
      if(!response.ok) throw new Error(data?.error||"Research request failed");
      const publicEvidence:Evidence[]=data.publicEvidence||[],privateEvidence:Evidence[]=data.privateEvidence||[];
      const mapEvidence=(item:Evidence,index:number,kind:"public"|"private"):Source=>({id:item.id||item.source_node_ref||`${kind}-${item.chunk_id||index}`,title:item.title||"Untitled authority",citation:item.citation||item.source_node_ref||(kind==="private"?"Private firm document":"Citation unavailable"),court:item.court||item.jurisdiction_code||(kind==="private"?"Firm knowledge":"Governed corpus"),date:item.page_number?`Page ${item.page_number}`:"",treatment:item.document_type||(kind==="private"?"Private evidence":"Evidence"),tone:"blue",excerpt:item.content||"Exact passage unavailable.",note:kind==="private"?"Exact passage retrieved from permission-filtered firm knowledge.":"Exact passage retrieved from the governed public corpus.",url:item.canonical_url,page:item.page_number,paragraph:item.paragraph_number,sourceKind:kind,legalDocumentId:item.legal_document_id,privateDocumentId:item.document_id,chunkId:item.chunk_id,rank:item.rank});
      const nextSources=[...publicEvidence.map((item,index)=>mapEvidence(item,index,"public")),...privateEvidence.map((item,index)=>mapEvidence(item,index,"private"))];
      setAuthorities(nextSources);if(nextSources[0])setSource(nextSources[0]);
      setLiveAnswer(data.answer);setProvider(data.provider);toast.success("Live research completed",{description:`${data.evidenceCount||0} exact passages retrieved.`});
    }catch(error){toast.error(error instanceof Error?error.message:"Research failed")}finally{setRunning(false)}
  };
  useEffect(()=>{if(autoRun>autoRunSeen.current&&query.trim()){autoRunSeen.current=autoRun;void run()}},[autoRun]);
  return <div className="research-page">
    <div className="research-bar"><Search/><Input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&run()}/><ToneBadge tone="blue">TZ</ToneBadge><Button size="sm" onClick={run}>{running?"Checking…":"Research"}</Button></div>
    <div className="research-grid">
      <aside className="plan-pane"><div className="pane-title"><span>Research plan</span><MoreHorizontal/></div>
        <div className="plan-block"><span className="eyebrow">Question</span><p>{query||"Enter a legal research question."}</p></div>
        <div className="plan-block"><span className="eyebrow">Searches</span>{["statutory test for unfair termination","procedural fairness labour revision","burden of proof employer","prejudice exception dismissal"].map((x,i)=><div className="plan-step" key={x}><i>{i+1}</i><span>{x}</span><Check/></div>)}</div>
        <div className="plan-block"><div className="row spread"><span className="eyebrow">Authority set</span><small>{authorities.length}</small></div>{authorities.length?authorities.map(s=><button className={"authority-mini "+(source.id===s.id?"active":"")} key={s.id} onClick={()=>setSource(s)}><span>{s.title}</span><small>{s.citation}</small></button>):<p className="muted">No evidence retrieved yet.</p>}</div>
      </aside>
      <article className="answer-pane"><div className="answer-head"><div><span className="eyebrow">{liveAnswer?"Live answer":"Research answer"}</span><span className="verified"><ShieldCheck/> {liveAnswer?`${provider} · governed request`:"Exact evidence required"}</span></div><Button variant="ghost" size="sm" onClick={()=>void saveResearch()} disabled={!liveAnswer||!!savedId}>{savedId?"Saved":"Save"}</Button></div>
        <div className="answer-content">
          {liveAnswer?<div className="live-answer"><span>Live research gateway</span><p>{liveAnswer}</p><div className="answer-metrics"><div><span>Evidence</span><b>{authorities.length} passages</b></div><div><span>Jurisdiction</span><b>Tanzania</b></div><div><span>Review</span><b>Lawyer required</b></div></div></div>:<div className="empty-live"><Search/><h2>Ask a question to begin</h2><p>Only live, source-grounded results will appear here.</p></div>}
          {false&&<>
          <h2>Fair termination requires both a valid reason and a fair process.</h2>
          <p className="standfirst">Under Tanzanian law, an employer must prove substantive justification and procedural fairness. Failure on either limb may render termination unfair.</p>
          <h3>Short answer</h3><p>Section 37 of the Employment and Labour Relations Act places the burden on the employer to establish a valid and fair reason connected to conduct, capacity, compatibility or operational requirements, and to show that a fair procedure was followed. <Citation n={1} onClick={()=>setSource(sources[0])}/></p>
          <h3>Analysis</h3><p>The inquiry is cumulative. A genuine reason does not cure a process that deprived the employee of notice, disclosure, a meaningful opportunity to respond, or an impartial decision. The Court of Appeal has treated the record as a whole while preserving both limbs of the statutory test. <Citation n={2} onClick={()=>setSource(sources[1])}/></p>
          <div className="proposition"><Gavel/><div><span>Core proposition</span><p>The employer bears the evidential burden on substantive justification and procedural fairness.</p></div><Citation n={3} onClick={()=>setSource(sources[2])}/></div>
          <h3>Contrary or limiting authority</h3><p>A High Court decision suggests a procedural omission may not be fatal where misconduct was admitted and no prejudice followed. Treat it narrowly where the employee contested the facts or the omission affected the result. <Citation n={4} onClick={()=>setSource(sources[3])}/></p>
          <h3>Practical test</h3><ol><li>Identify the stated reason at termination.</li><li>Test the reason against statute and evidence.</li><li>Audit notice, disclosure, hearing and decision-making.</li><li>Check the law effective on the termination date.</li></ol>
          <div className="answer-metrics"><div><span>Confidence</span><b>High · 92%</b></div><div><span>Coverage</span><b>1 Act · 3 cases</b></div><div><span>Law as at</span><b>3 Sep 2026</b></div></div></>}
        </div>
      </article>
      {authorities.length?<SourceViewer source={source}/>:<aside className="source-viewer"><div className="pane-title"><span>Source</span></div><div className="empty-live"><BookOpen/><h2>No source selected</h2><p>Retrieved authority will appear here.</p></div></aside>}
    </div>
  </div>;
}

function AskView({go,navigate}:{go:(question:string)=>void;navigate:(view:View)=>void}) {
  const [q,setQ]=useState("");
  const cards:[[string,string,typeof Search,View|null,string|null],[string,string,typeof Search,View|null,string|null],[string,string,typeof Search,View|null,string|null],[string,string,typeof Search,View|null,string|null]]=[
    ["Research an issue","Build an authority-backed answer across cases, legislation and firm knowledge.",Search,null,"What is the legal issue you want researched?"],
    ["Review documents","Apply a playbook to private contract text and persist every finding.",ClipboardCheck,"review",null],
    ["Prepare a draft","Generate lawyer-review drafting and save versioned work product.",FilePenLine,"draft",null],
    ["Private knowledge","Upload confidential documents for governed processing and retrieval.",FolderLock,"vault",null],
  ];
  return <div className="view-pad ask-view"><Header title="Ask Legal Eye" meta="Research public law and permitted firm knowledge in one place."/>
    <div className="composer"><Textarea value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if((e.metaKey||e.ctrlKey)&&e.key==="Enter")go(q)}} placeholder="Ask a legal question…"/><div className="row spread"><div className="row options"><ToneBadge tone="blue">Tanzania</ToneBadge><ToneBadge>Firm knowledge when permitted</ToneBadge></div><Button onClick={()=>go(q)} disabled={!q.trim()}>Ask <ArrowUpRight/></Button></div></div>
    <div className="prompt-grid">{cards.map(([title,copy,Icon,target,prompt])=><button key={title} onClick={()=>target?navigate(target):setQ(prompt||"")}><Icon/><strong>{title}</strong><span>{copy}</span><ChevronRight/></button>)}</div>
    <div className="recent"><div className="row spread"><h2>Continue working</h2></div><div className="empty-live"><FileClock/><h2>No recent work</h2><p>Your authenticated research, drafts and reviews will appear here after you save them.</p></div></div>
  </div>;
}

function Draft({identity,connect}:{identity:DemoIdentity|null;connect:()=>void}) {
  const [text,setText]=useState(""),[title,setTitle]=useState("Untitled document"),[generating,setGenerating]=useState(false),[saving,setSaving]=useState(false),[draftId,setDraftId]=useState<string|null>(null),[version,setVersion]=useState(0),[dirty,setDirty]=useState(false);
  const headers=identity?{apikey:SUPABASE_KEY,Authorization:"Bearer "+identity.access_token,"content-type":"application/json"}:null;
  const save=async()=>{
    if(!identity){connect();return;}
    if(!text.trim()){toast.error("Add drafting text before saving.");return;}
    setSaving(true);
    try{
      let current=draftId;
      if(!current){
        const created=await fetch(SUPABASE_URL+"/rest/v1/drafts",{method:"POST",headers:{...headers!,Prefer:"return=representation"},body:JSON.stringify({organization_id:identity.organization_id,created_by:identity.user.id,title:title.trim()||"Untitled document",document_type:"legal_document",jurisdiction_codes:["TZ"],content:{text},status:"draft",metadata:{source:"legal-eye-web",lawyer_review_required:true}})});
        const rows=await created.json();if(!created.ok||!rows?.[0]?.id)throw new Error(rows?.message||"Draft could not be saved");current=rows[0].id;setDraftId(current);
      }else{
        const updated=await fetch(SUPABASE_URL+`/rest/v1/drafts?id=eq.${encodeURIComponent(current)}`,{method:"PATCH",headers:{...headers!,Prefer:"return=minimal"},body:JSON.stringify({title:title.trim()||"Untitled document",content:{text},updated_at:new Date().toISOString()})});
        if(!updated.ok)throw new Error((await updated.json().catch(()=>null))?.message||"Draft could not be updated");
      }
      const nextVersion=version+1;
      const savedVersion=await fetch(SUPABASE_URL+"/rest/v1/draft_versions",{method:"POST",headers:{...headers!,Prefer:"return=minimal"},body:JSON.stringify({draft_id:current,version_number:nextVersion,content:{text},created_by:identity.user.id})});
      if(!savedVersion.ok)throw new Error((await savedVersion.json().catch(()=>null))?.message||"Draft version could not be saved");
      setVersion(nextVersion);setDirty(false);toast.success("Draft saved",{description:`Version ${nextVersion} is persisted in your workspace.`});
    }catch(error){toast.error(error instanceof Error?error.message:"Draft could not be saved")}finally{setSaving(false)}
  };
  const redraft=async()=>{
    if(!identity){connect();return;}
    if(!text.trim()){toast.error("Paste or write source drafting context first.");return;}
    setGenerating(true);
    try{
      const response=await fetch("/api/legal-ai",{method:"POST",headers:{Authorization:"Bearer "+identity.access_token,"content-type":"application/json"},body:JSON.stringify({action:"draft",organization_id:identity.organization_id,document_type:"Legal document",instructions:"Improve this drafting conservatively. Preserve all unknown deal facts as placeholders, do not invent authority or transaction facts, and make the result suitable for lawyer review.",context:text})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Draft failed");
      setText(data.content);setDirty(true);toast.success("AI draft prepared",{description:"Review the text, then save a version to persist it."});
    }catch(error){toast.error(error instanceof Error?error.message:"Draft failed")}finally{setGenerating(false)}
  };
  return <div className="draft-view"><div className="doc-toolbar"><div><span className="eyebrow">Drafting workspace</span><b>{title}</b></div><div className="row"><ToneBadge tone={dirty?"amber":draftId?"green":"neutral"}>{draftId?(dirty?"Unsaved changes":`Saved · v${version}`):"Not saved"}</ToneBadge><Button variant="outline" size="sm" onClick={()=>void save()} disabled={saving||!text.trim()}>{saving?"Saving…":"Save version"}</Button></div></div>
    <div className="editor-grid"><aside className="outline-pane"><div className="pane-title"><span>Document</span><FilePenLine/></div><div className="ai-card"><span className="eyebrow">Status</span><p>Each save creates an immutable version. AI output remains lawyer-review material.</p></div></aside>
      <article className="doc-canvas"><div className="doc-page"><small>DRAFT · LAWYER REVIEW REQUIRED</small><Input value={title} onChange={e=>{setTitle(e.target.value);setDirty(true)}} aria-label="Draft title"/><hr/><h2>Working text</h2><Textarea value={text} onChange={e=>{setText(e.target.value);setDirty(true)}} placeholder="Paste source clauses, instructions, or drafting context here..."/></div></article>
      <aside className="ai-pane"><div className="ai-head"><span className="brand-mark small">LE</span><b>Legal Eye</b><PanelRightOpen/></div><div className="ai-card"><span className="eyebrow">Draft safeguards</span><p>Legal Eye preserves placeholders for missing facts and will not treat generated text as verified authority.</p></div><div className="ai-card suggestion"><span className="eyebrow">Persistence</span><p>{draftId?`Draft saved with ${version} version${version===1?"":"s"}.`:"This draft has not been persisted yet."}</p></div><div className="ai-actions"><Button onClick={redraft} disabled={generating||!text.trim()}>{generating?"Drafting…":"Improve with AI"}</Button><Button variant="outline" onClick={()=>void save()} disabled={saving||!text.trim()}>Save version</Button></div></aside>
    </div>
  </div>;
}

function TablesView({show}:{show:()=>void}) {
  return <div className="tables-view"><div className="page-toolbar"><div><span className="eyebrow">Project Kilimanjaro</span><h1>Buyer due diligence</h1></div><div className="row"><ToneBadge tone="green">287 documents</ToneBadge><Button variant="outline" size="sm"><LockKeyhole/> Lock</Button><Button size="sm">Export</Button></div></div>
    <div className="table-toolbar"><Button variant="outline" size="sm"><Plus/> Documents</Button><Button variant="outline" size="sm"><Columns3/> Column</Button><Button variant="outline" size="sm"><Sparkles/> Ask AI</Button><span/><small>Review mode</small><Checkbox defaultChecked/></div>
    <div className="legal-table"><Table><TableHeader><TableRow><TableHead><Checkbox/> Document</TableHead><TableHead>Type</TableHead><TableHead>Change of control</TableHead><TableHead>Assignment</TableHead><TableHead>Termination</TableHead><TableHead>Risk</TableHead></TableRow></TableHeader><TableBody>{tableRows.map((r,row)=><TableRow key={r[0]}><TableCell><Checkbox/><div><b>{r[0]}</b><small>Reviewed {row+1}h ago</small></div></TableCell><TableCell><ToneBadge>{r[1]}</ToneBadge></TableCell>{r.slice(2,5).map((v,i)=><TableCell key={v}><button className="review-cell" onClick={show}><span>{v}</span><small><i/> {Number(r[6])-i}% <BookOpen/></small></button></TableCell>)}<TableCell><ToneBadge tone={r[5]==="High"?"red":r[5]==="Medium"?"amber":"green"}>{r[5]}</ToneBadge></TableCell></TableRow>)}</TableBody></Table></div>
    <div className="table-foot"><span>5 of 287 rows</span><span><ShieldCheck/> Every value retains its source and reviewer state.</span></div>
  </div>;
}

function AgentView() {
  const [run,setRun]=useState(false); const steps=["Understand transaction","Classify 287 documents","Extract key clauses","Review change of control","Review assignment and termination","Check Tanzanian law","Search firm playbook","Verify citations","Detect missing evidence","Deliver final report"];
  return <div className="view-pad"><Header title="Agent" meta="Complex legal work with a visible plan, evidence trail and lawyer checkpoints." action={<Button onClick={()=>setRun(true)}><Play/> {run?"Running":"Resume run"}</Button>}/>
    <div className="agent-grid"><section className="agent-card"><div className="run-head"><i><Bot/></i><div><span className="eyebrow">Agent run · LE-2841</span><h2>Prepare a buyer-side due diligence report across 287 agreements</h2></div><ToneBadge tone="blue">In progress</ToneBadge></div><div className="progress-block"><div className="row spread"><span>Evidence verification</span><b>{run?"84":"76"}%</b></div><Progress value={run?84:76}/></div><div className="timeline">{steps.map((s,i)=><button key={s} className={i<7?"done":i===7?"active":""} onClick={()=>toast(s,{description:i<7?"Open the evidence and tool record for this step.":"This step has not completed yet."})}><i>{i<7?<Check/>:i===7?<span/>:i+1}</i><span><b>{s}</b><small>{i<7?"Complete · evidence retained":i===7?"Checking against source text":"Queued"}</small></span><ChevronRight/></button>)}</div></section>
      <aside className="run-side"><div className="pane-title"><span>Run controls</span><ShieldCheck/></div>{[["Human checkpoints","2 required","High-risk findings and final delivery require approval."],["Matter","Project Kilimanjaro","Private context isolated to the matter team."],["Sources","287 private · 18 public","Tanzania · UK · OHADA"],["Estimated completion","6 minutes","The run can be paused safely."]].map(x=><div className="control" key={x[0]}><span>{x[0]}</span><b>{x[1]}</b><p>{x[2]}</p></div>)}<Button variant="outline" onClick={()=>toast("Run paused")}>Pause run</Button></aside></div>
  </div>;
}

function SkillsView() {
  const [pick,setPick]=useState(0); const selected=skillRows[pick];
  return <div className="view-pad"><Header title="Skills" meta="Versioned firm expertise lawyers can test, approve and reuse." action={<Button><Plus/> New skill</Button>}/><div className="skills-grid"><div className="skill-list">{skillRows.map((s,i)=>{const Icon=s[4];return <button className={pick===i?"active":""} key={s[0]} onClick={()=>setPick(i)}><i><Icon/></i><span><b>{s[0]}</b><small>{s[1]}</small></span><ChevronRight/></button>})}</div><section className="skill-detail"><div className="skill-head"><div><span className="eyebrow">Approved firm skill</span><h2>{selected[0]}</h2><p>{selected[1]}</p></div><Button onClick={()=>toast.success("Skill run created")}><Play/> Run skill</Button></div><div className="skill-tabs">{["Instructions","Knowledge","Playbook","Tools","Output","Permissions","Versions","Tests"].map((x,i)=><button className={i===0?"active":""} key={x}>{x}</button>)}</div><div className="instructions"><h3>Instructions</h3>{["Identify governing law, parties, purpose and transaction context.","Apply the current approved playbook and cite each deviation.","Check every legal proposition against effective primary authority.","Separate fact, inference and missing evidence. Never invent a citation."].map((x,i)=><div key={x}><span>0{i+1}</span><p>{x}</p></div>)}</div><footer>{[["Version",selected[2]],["Tests",selected[3]+" passing"],["Last approved","Anna Msuya · Partner"]].map(x=><div key={x[0]}><span>{x[0]}</span><b>{x[1]}</b></div>)}</footer></section></div></div>;
}

function ListsView({show}:{show:()=>void}) {
  const rows=[["Board approval","§4.1(a)","Anna","Complete"],["BRELA filing","§4.1(c)","James","In progress"],["Tax clearance","§5.2","Client","Pending"],["Legal opinion","§7.1","Legal Eye","Draft"],["Lender consent","Sch. 3","Neema","Blocked"]];
  return <div className="view-pad"><Header title="Closing · Project Kilimanjaro" meta="Conditions, owners and supporting clauses stay connected." action={<Button><Plus/> Add item</Button>}/><div className="list-summary"><div><span>Completion</span><b>1 / 5</b></div><Progress value={20}/><small>Target closing · 18 September 2026</small></div><div className="checklist"><Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Source</TableHead><TableHead>Owner</TableHead><TableHead>Status</TableHead><TableHead>Due</TableHead></TableRow></TableHeader><TableBody>{rows.map((r,i)=><TableRow key={r[0]}><TableCell><b>{r[0]}</b></TableCell><TableCell><button className="source-link" onClick={show}>{r[1]} <BookOpen/></button></TableCell><TableCell><i>{r[2].slice(0,2).toUpperCase()}</i>{r[2]}</TableCell><TableCell><ToneBadge tone={r[3]==="Complete"?"green":r[3]==="Blocked"?"red":r[3]==="In progress"?"blue":"neutral"}>{r[3]}</ToneBadge></TableCell><TableCell>{i<2?"6 Sep":i<4?"12 Sep":"14 Sep"}</TableCell></TableRow>)}</TableBody></Table></div></div>;
}

function MonitorView({documents,policies,total,stats}:{documents:CorpusDocument[];policies:CorpusPolicy[];total:number;stats:CorpusStats}) {
  const policyTone=(state:string):Tone=>state==="approved"?"green":state==="api_key_required"?"blue":state==="license_required"?"amber":"neutral";
  const policyLabel=(policy:CorpusPolicy)=>policy.policy_state==="approved"?(policy.last_synced_at?"Active":"Ready"):policy.policy_state.replaceAll("_"," ");
  const corpusCards=[
    {label:"Tanzania",value:stats.TZ.toLocaleString(),note:"Official OAG",icon:<Globe2/>},
    {label:"United Kingdom",value:stats.UK.toLocaleString(),note:"OGL v3",icon:<Globe2/>},
    {label:"European Union",value:stats.EU.toLocaleString(),note:"EUR-Lex",icon:<Globe2/>},
    {label:"Searchable chunks",value:stats.searchable===null?"Not deployed":stats.searchable.toLocaleString(),note:"Exact-span text only",icon:<Network/>},
  ];
  return <div className="view-pad"><Header title="Monitor" meta="Licensed source changes with provenance, policy gates and impact review." />
    <div className="corpus-strip">{corpusCards.map(card=><div key={card.label}><i>{card.icon}</i><span><small>{card.label}</small><b>{card.value}</b><em>{card.note}</em></span></div>)}</div>
    <div className="corpus-ops"><div><span className="eyebrow">Corpus operations</span><b>Policy-gated ingestion</b><p>Connectors can only perform capabilities approved in the source registry.</p></div>{policies.map(p=><div key={p.name}><span>{p.name}</span><ToneBadge tone={policyTone(p.policy_state)}>{policyLabel(p)}</ToneBadge><small>{p.license_name||"Rights review pending"}</small></div>)}</div>
    <div className="monitor-grid"><aside>{["Latest official legislation","Tanzania financial services","EU regulatory change","East Africa data protection","OHADA corporate law"].map((x,i)=><div className={i===0?"active":""} key={x}><Activity/><span>{x}<small>{i===0?`${total.toLocaleString()} catalogued records`:i===2?`${stats.EU.toLocaleString()} governed records`:"connector gated"}</small></span></div>)}</aside><section>{documents.length?documents.map((r,i)=><article key={r.canonical_url||r.title}><time>{r.published_at?new Intl.DateTimeFormat("en",{day:"numeric",month:"short"}).format(new Date(r.published_at)):"Current"}</time><div><header><i>{r.jurisdiction_code}</i><span><small>Official source</small><b>{r.jurisdiction_code==="TZ"?"Tanzania OAG":r.jurisdiction_code==="EU"?"EUR-Lex":"UK Legislation"}</b></span><ToneBadge tone={i===0?"blue":"green"}>{i===0?"Latest":"Ingested"}</ToneBadge></header><h2>{r.title}</h2><div className="impact"><span>{r.document_type.replaceAll("_"," ")}</span><p>{r.citation||"Official citation pending normalization"} · structured processing retains the source and rights record.</p></div><footer><Button variant="outline" disabled={!r.canonical_url} onClick={()=>r.canonical_url&&window.open(r.canonical_url,"_blank","noopener,noreferrer")}>Open official source</Button></footer></div></article>):<div className="empty-live"><ShieldCheck/><h2>No approved source records yet</h2><p>The connector will surface documents here after a licensed sync.</p></div>}</section></div></div>;
}

function WorkflowView() {
  const [text,setText]=useState("Whenever I upload an SPA, review it using our Buyer SPA playbook, build a risk table and prepare a client summary.");
  return <div className="view-pad"><Header title="Workflows" meta="Build repeatable legal processes visually or in natural language." action={<Button onClick={()=>toast.success("Workflow saved")}>Save workflow</Button>}/><div className="workflow-prompt"><Sparkles/><Input value={text} onChange={e=>setText(e.target.value)}/><Button onClick={()=>toast.success("Workflow regenerated")}>Build</Button></div><div className="workflow-canvas"><aside>{["Builder","Runs","Versions","Tests"].map((x,i)=><button className={i===0?"active":""} key={x}>{x}</button>)}</aside><section className="graph"><Flow icon={Upload} type="Trigger" title="SPA uploaded" copy="Any matter · DOCX or PDF"/><Connector/><div className="branches"><Flow icon={ClipboardCheck} type="Review" title="Buyer SPA playbook" copy="Find risk and propose redlines"/><Flow icon={Search} type="Research" title="Check governing law" copy="Effective primary authority"/></div><Connector/><Flow icon={Table2} type="Structure" title="Build risk table" copy="Source · confidence · reviewer"/><Connector/><Flow icon={FilePenLine} type="Deliver" title="Client summary" copy="Partner approval required"/></section><aside className="settings"><div className="pane-title">Step settings</div>{[["Skill","SPA Buyer Review · v5.0"],["Knowledge","Firm playbook + matter"],["Approval","Partner required"]].map(x=><div className="control" key={x[0]}><span>{x[0]}</span><b>{x[1]}</b></div>)}</aside></div></div>;
}
function Flow({icon:Icon,type,title,copy}:{icon:typeof Upload;type:string;title:string;copy:string}) {return <div className="flow"><i><Icon/></i><div><span>{type}</span><b>{title}</b><small>{copy}</small></div></div>}
function Connector(){return <div className="connector"><ChevronDown/></div>}

function MattersView() {
  const rows=[["Project Kilimanjaro","M&A","Tanzania · UK","18 members","Active"],["Kibo Employment Review","Employment","Tanzania","6 members","Active"],["Mawingu Financing","Banking","Kenya · Tanzania","11 members","Active"],["Victoria Data Programme","Privacy","East Africa · EU","8 members","On hold"]];
  return <div className="view-pad"><Header title="Matters" meta="The secure context shared by people, documents, research and agents." action={<Button><Plus/> New matter</Button>}/><div className="matter-grid">{rows.map((r,i)=><button key={r[0]}><i>{String(i+1).padStart(2,"0")}</i><div><ToneBadge tone={i===3?"neutral":"green"}>{r[4]}</ToneBadge><h2>{r[0]}</h2><p>{r[1]}</p><small><Globe2/>{r[2]} <LockKeyhole/>{r[3]}</small></div><ChevronRight/></button>)}</div></div>;
}
function VaultView({identity,documents,connect,refresh}:{identity:DemoIdentity|null;documents:VaultDocument[];connect:()=>void;refresh:()=>void}) {
  const input=useRef<HTMLInputElement>(null),[uploading,setUploading]=useState(false);
  const upload=async(file?:File)=>{
    if(!file)return;
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
  const display=documents.map(d=>[d.id,d.title,d.status,d.file_name||"Private document"]);
  return <div className="view-pad"><Header title="Private knowledge" meta="Permission-filtered firm work, isolated from the public authority graph." action={<><input ref={input} hidden type="file" accept=".pdf,.docx,.xlsx,.txt" onChange={event=>upload(event.target.files?.[0])}/><Button onClick={()=>identity?input.current?.click():connect()} disabled={uploading}><Upload/> {uploading?"Securing…":"Upload"}</Button></>}/><div className="vault-grid"><section>{display.length?display.map(x=><div className="vault-document" key={x[0]}><i><FolderLock/></i><span><b>{x[1]}</b><small>{x[2]} · {x[3]}</small></span></div>):<div className="empty-live"><FolderLock/><h2>{identity?"Your vault is empty":"Sign in to open the vault"}</h2><p>{identity?"Upload the first real client document.":"Private knowledge is available only to organization members."}</p></div>}</section><aside><ShieldCheck/><h2>Private Firm Intelligence</h2><p>Client content is permission-filtered before retrieval. Public and firm graphs stay separate and every agent action is auditable.</p>{[["Encryption","Supabase storage · private bucket"],["Data boundary","Organization + matter RLS"],["Model training","Disabled for private data"],["Parser","Docling + lightweight fallback"]].map(x=><div key={x[0]}><span>{x[0]}</span><b>{x[1]}</b></div>)}</aside></div></div>;
}
function TrustView() {
  const controls=[
    ["Tenant isolation","Enforced","Organization, matter and document-level RLS",ShieldCheck,"green"],
    ["AI data-loss prevention","Enforced","Credential blocking, identifier redaction and provider ceilings",Eye,"green"],
    ["Audit trail","Active","Immutable product, ingestion and AI-generation events",FileClock,"green"],
    ["SAML SSO","Configuration required","Provider registry exists; enterprise Supabase plan and IdP metadata required",KeyRound,"amber"],
    ["SCIM 2.0","Endpoint ready","Token issuance and IdP conformance testing remain",Users,"blue"],
    ["Customer-managed keys","Architecture ready","GCP KMS deployment and rotation evidence remain",Database,"amber"],
  ] as const;
  const exportReport=()=>{
    const payload={product:"Legal Eye",generated_at:new Date().toISOString(),lawyer_verification_required:true,controls:controls.map(([title,status,copy])=>({title,status,description:copy}))};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
    const anchor=document.createElement("a");anchor.href=url;anchor.download=`legal-eye-control-report-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);toast.success("Control report exported");
  };
  return <div className="trust-view"><div className="trust-hero"><span className="eyebrow">Enterprise control plane</span><h1>Trust is part of the work product.</h1><p>Every source, model call, permission decision and human approval should be reviewable without asking Legal Eye to explain itself.</p><div><Button onClick={exportReport}><ShieldCheck/> Export control report</Button></div></div><div className="trust-layout"><section><div className="trust-heading"><span>Controls</span><small>live implementation state</small></div>{controls.map(([title,status,copy,Icon,tone])=><article className="control-row" key={title}><i><Icon/></i><div><b>{title}</b><p>{copy}</p></div><ToneBadge tone={tone}>{status}</ToneBadge><ChevronRight/></article>)}</section><aside><span className="eyebrow">Procurement readiness</span><h2>Enterprise evidence room</h2><p>Architecture is implemented; independent operational proof is still required before bank-production acceptance.</p>{[["Identity & access","3 / 5"],["Data protection","4 / 7"],["Application security","5 / 8"],["AI governance","4 / 7"],["Resilience","1 / 5"]].map(([name,value],i)=><div className="readiness" key={name}><span>{name}<b>{value}</b></span><Progress value={[60,57,63,57,20][i]}/></div>)}<footer><CircleAlert/><span>Open gates: external penetration test, disaster-recovery exercise, GCP KMS, SAML conformance and completed legal evaluation sets.</span></footer></aside></div></div>;
}
function ReviewView({identity,connect,documents,refresh}:{identity:DemoIdentity|null;connect:()=>void;documents:VaultDocument[];refresh:()=>void}) {
  const [contract,setContract]=useState(""),[findings,setFindings]=useState<ReviewFinding[]>([]),[reviewing,setReviewing]=useState(false),[selectedDocument,setSelectedDocument]=useState(""),[reviewProjectId,setReviewProjectId]=useState<string|null>(null),[loadedTitle,setLoadedTitle]=useState("Pasted agreement text");
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
    refresh();
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
      const projectId=await persistReview(documentId,{...data,findings:next});setReviewProjectId(projectId);
      toast.success("Contract review saved",{description:`${next.length} text-supported findings were persisted for lawyer review.`});
    }catch(error){toast.error(error instanceof Error?error.message:"Review failed")}finally{setReviewing(false)}
  };
  const exportReview=()=>{
    if(!reviewProjectId)return;
    const payload={review_project_id:reviewProjectId,document:selectedDocument||loadedTitle,exported_at:new Date().toISOString(),lawyer_verification_required:true,findings};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
    const anchor=document.createElement("a");anchor.href=url;anchor.download=`legal-eye-review-${reviewProjectId}.json`;document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);toast.success("Review exported");
  };
  return <div className="view-pad"><Header title="Review" meta="Playbook-backed findings, saved results and exact document text in one workspace." action={<div className="row"><Button variant="outline" onClick={exportReview} disabled={!reviewProjectId}>Export JSON</Button><Button onClick={runReview} disabled={reviewing||contract.trim().length<20}><Sparkles/> {reviewing?"Reviewing…":"Run AI review"}</Button></div>}/>
    <div className="review-source-picker"><label><span>Source document</span><select value={selectedDocument} onChange={event=>void loadDocument(event.target.value)}><option value="">Paste contract text</option>{documents.map(doc=><option value={doc.id} key={doc.id}>{doc.title} · {doc.status}</option>)}</select></label>{selectedDocument?<ToneBadge tone={contract?"green":"amber"}>{contract?"Source loaded":"Processing required"}</ToneBadge>:<ToneBadge>Private pasted source</ToneBadge>}</div>
    <div className="review-summary">{[["Document",loadedTitle],["Playbook","Core legal review"],["Findings",String(findings.length)],["Saved",reviewProjectId?"Yes":"Not yet"]].map(x=><div key={x[0]}><span>{x[0]}</span><b>{x[1]}</b></div>)}</div>
    <Textarea value={contract} onChange={event=>{setContract(event.target.value);if(selectedDocument){setSelectedDocument("");setLoadedTitle("Pasted agreement text")}resetResults()}} placeholder="Paste the agreement text, or select a processed vault document above..." aria-label="Contract text for review"/>
    <div className="findings">{findings.length?findings.map((finding,index)=><article key={`${finding.title}-${index}`}><i className={finding.risk}/><span><ToneBadge tone={finding.risk==="high"?"red":finding.risk==="low"?"green":finding.risk==="info"?"blue":"amber"}>{finding.risk[0].toUpperCase()+finding.risk.slice(1)}</ToneBadge><h3>{finding.title}</h3><p>{finding.whyItMatters}</p>{finding.originalText?<blockquote>{finding.originalText}</blockquote>:null}{finding.suggestedText?<div className="suggested-text"><small>Suggested lawyer-review wording</small><p>{finding.suggestedText}</p></div>:null}<small>{finding.clauseRef||"Contract text"} · AI finding · lawyer verification required</small></span></article>):<div className="empty-live"><ClipboardCheck/><h2>No findings yet</h2><p>Select a processed private document or paste agreement text, then run the review.</p></div>}</div>
  </div>;
}

function LegalEye() {
  const [view,setView]=useState<View>("ask"), [source,setSource]=useState(emptySource), [sourceOpen,setSourceOpen]=useState(false), [command,setCommand]=useState(false), [count,setCount]=useState(0), [documentCount,setDocumentCount]=useState(0), [liveDocuments,setLiveDocuments]=useState<CorpusDocument[]>([]), [corpusPolicies,setCorpusPolicies]=useState<CorpusPolicy[]>([]),[corpusStats,setCorpusStats]=useState<CorpusStats>({TZ:0,UK:0,EU:0,searchable:null}),[vaultDocuments,setVaultDocuments]=useState<VaultDocument[]>([]);
  const [researchQuery,setResearchQuery]=useState(""),[researchRun,setResearchRun]=useState(0);
  const [authOpen,setAuthOpen]=useState(false), [email,setEmail]=useState(""), [password,setPassword]=useState(""), [identity,setIdentity]=useState<DemoIdentity|null>(null), [signingIn,setSigningIn]=useState(false);
  const refreshVault=async(current=identity)=>{if(!current){setVaultDocuments([]);return;}const response=await fetch(SUPABASE_URL+"/rest/v1/documents?select=id,title,file_name,status,created_at,size_bytes&organization_id=eq."+current.organization_id+"&order=created_at.desc&limit=12",{headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+current.access_token}});if(response.ok)setVaultDocuments(await response.json())};
  const signIn=async()=>{
    setSigningIn(true);
    try{
      const response=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{apikey:SUPABASE_KEY,"content-type":"application/json"},body:JSON.stringify({email,password})});
      const data=await response.json();
      if(!response.ok) throw new Error(data?.error_description||data?.msg||"Sign in failed");
      const membership=await fetch(SUPABASE_URL+`/rest/v1/organization_members?select=role,organization_id&user_id=eq.${data.user.id}&is_active=is.true&limit=1`,{headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+data.access_token}});
      const memberships=membership.ok?await membership.json():[];
      if(!memberships[0]?.organization_id)throw new Error("No active organization membership was found");
      const next={access_token:data.access_token,user:data.user,role:memberships[0].role||"member",organization_id:memberships[0].organization_id};
      sessionStorage.setItem("legal-eye-session",JSON.stringify(next));setIdentity(next);setPassword("");setAuthOpen(false);await refreshVault(next);if(researchQuery.trim()){setResearchRun(x=>x+1);setView("research")}toast.success("Organization connected");
    }catch(error){toast.error(error instanceof Error?error.message:"Sign in failed")}finally{setSigningIn(false)}
  };
  const signOut=()=>{sessionStorage.removeItem("legal-eye-session");setIdentity(null);setVaultDocuments([]);setAuthOpen(false);toast("Signed out")};
  useEffect(()=>{try{const saved=sessionStorage.getItem("legal-eye-session");const parsed=saved?JSON.parse(saved):null;if(parsed?.organization_id)setTimeout(()=>setIdentity(parsed),0)}catch{sessionStorage.removeItem("legal-eye-session")}},[]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setCommand(x=>!x)}};document.addEventListener("keydown",key);if(!SUPABASE_URL||!SUPABASE_KEY)return()=>document.removeEventListener("keydown",key);const headers={apikey:SUPABASE_KEY,Authorization:"Bearer "+SUPABASE_KEY,Prefer:"count=exact"};const counted=(path:string)=>fetch(SUPABASE_URL+path,{headers}).then(response=>response.ok?Number(response.headers.get("content-range")?.split("/")[1]||0):null);Promise.all([fetch(SUPABASE_URL+"/rest/v1/source_registry?select=id&limit=1",{headers}),fetch(SUPABASE_URL+"/rest/v1/legal_documents?select=title,citation,published_at,canonical_url,jurisdiction_code,document_type&order=published_at.desc.nullslast&limit=12",{headers}),fetch(SUPABASE_URL+"/rest/v1/source_registry?select=name,jurisdiction_code,policy_state,sync_enabled,last_synced_at,license_name&adapter_key=in.(tz_oag,uk_legislation,eurlex,laws_africa,courtlistener,govinfo)&order=name",{headers}),counted("/rest/v1/legal_documents?select=id&jurisdiction_code=eq.TZ&limit=1"),counted("/rest/v1/legal_documents?select=id&jurisdiction_code=eq.UK&limit=1"),counted("/rest/v1/legal_documents?select=id&jurisdiction_code=eq.EU&limit=1"),counted("/rest/v1/legal_document_chunks?select=id&limit=1")]).then(async([sourceResponse,documentResponse,policyResponse,tz,uk,eu,searchable])=>{const sourceRange=(sourceResponse as Response).headers.get("content-range"),documentRange=(documentResponse as Response).headers.get("content-range");if(sourceRange)setCount(Number(sourceRange.split("/")[1]));if(documentRange)setDocumentCount(Number(documentRange.split("/")[1]));if((documentResponse as Response).ok)setLiveDocuments(await (documentResponse as Response).json());if((policyResponse as Response).ok)setCorpusPolicies(await (policyResponse as Response).json());setCorpusStats({TZ:tz||0,UK:uk||0,EU:eu||0,searchable})}).catch(()=>null);return()=>document.removeEventListener("keydown",key)},[]);
  useEffect(()=>{if(!identity)return;const current=identity;fetch(SUPABASE_URL+"/rest/v1/documents?select=id,title,file_name,status,created_at,size_bytes&organization_id=eq."+current.organization_id+"&order=created_at.desc&limit=12",{headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+current.access_token}}).then(async response=>{if(response.ok)setVaultDocuments(await response.json())}).catch(()=>null)},[identity]);
  const title=useMemo(()=>allNav.find(x=>x[0]===view)?.[1]||"Research",[view]), go=(v:View)=>{setView(v);setCommand(false)}, show=()=>setSourceOpen(true);
  const connect=()=>setAuthOpen(true);
  const content=view==="research"?<Research source={source} setSource={setSource} identity={identity} connect={connect} query={researchQuery} setQuery={setResearchQuery} autoRun={researchRun}/>:view==="ask"?<AskView navigate={go} go={question=>{if(!question.trim())return;setResearchQuery(question);if(!identity){connect();toast("Sign in to ask Legal Eye.");return;}setResearchRun(x=>x+1);go("research")}}/>:view==="draft"?<Draft identity={identity} connect={connect}/>:view==="tables"?<EmptyFeature title="Tables" meta="Extract clauses and facts from your real matter documents." icon={Table2} identity={identity} connect={connect}/>:view==="agent"?<EmptyFeature title="Agent" meta="Run governed multi-step legal work with lawyer checkpoints." icon={Bot} identity={identity} connect={connect}/>:view==="skills"?<EmptyFeature title="Skills" meta="Version and approve your firm's reusable legal expertise." icon={Sparkles} identity={identity} connect={connect}/>:view==="lists"?<EmptyFeature title="Lists" meta="Build source-linked closing and compliance checklists." icon={ListChecks} identity={identity} connect={connect}/>:view==="monitor"?<MonitorView documents={liveDocuments} policies={corpusPolicies} total={documentCount} stats={corpusStats}/>:view==="workflows"?<EmptyFeature title="Workflows" meta="Build repeatable legal processes from real firm work." icon={Workflow} identity={identity} connect={connect}/>:view==="matters"?<EmptyFeature title="Matters" meta="Organize people, documents, research and approvals." icon={BriefcaseBusiness} identity={identity} connect={connect}/>:view==="vault"?<VaultView identity={identity} documents={vaultDocuments} connect={connect} refresh={()=>void refreshVault()}/>:view==="trust"?<TrustView/>:<ReviewView identity={identity} connect={connect} documents={vaultDocuments} refresh={()=>void refreshVault()}/>;
  return <SidebarProvider defaultOpen style={{"--sidebar-width":"11.75rem","--sidebar-width-icon":"3.35rem"} as React.CSSProperties}>
    <Sidebar collapsible="icon" className="legal-sidebar"><SidebarHeader className="brand-head"><span className="brand-mark">LE</span><span><b>Legal Eye</b><small>Global intelligence</small></span></SidebarHeader><SidebarContent>
      <Nav group={primary} view={view} go={go}/><Nav label="Context" group={context} view={view} go={go}/><Nav label="Intelligence" group={intelligence} view={view} go={go}/>
    </SidebarContent><SidebarFooter className="user-foot"><button onClick={()=>setAuthOpen(true)}><i>{identity?"LE":"IN"}</i><span><b>{identity?"Legal Eye workspace":"Secure workspace"}</b><small>{identity?`${identity.role} · connected`:"Sign in to organization"}</small></span><MoreHorizontal/></button></SidebarFooter></Sidebar>
    <SidebarInset className="app-inset"><header className="context-head"><div><SidebarTrigger/><span><b>Legal Eye Workspace</b> <ChevronRight/> {title}</span></div><div><span className="context-pill"><Globe2/> Tanzania</span><span className="context-pill privacy-pill"><LockKeyhole/> Firm + matter</span><Button variant="outline" size="sm" onClick={()=>setCommand(true)}><CommandIcon/><span>Search</span><kbd>⌘ K</kbd></Button></div></header><main>{content}</main><footer className="system-bar"><span><i/> {corpusStats.searchable&&corpusStats.searchable>0?"Exact search online":"Search indexing pending"}</span><span>{documentCount} governed records · {corpusStats.searchable??0} searchable chunks · {count} source policies</span><span>Live data · lawyer verification required</span></footer></SidebarInset>
    <Dialog open={command} onOpenChange={setCommand}><DialogContent className="command-dialog"><DialogHeader><DialogTitle>Go anywhere</DialogTitle><DialogDescription>Search Legal Eye or open a workspace.</DialogDescription></DialogHeader><div className="command-search"><Search/><Input autoFocus placeholder="Research, matters, documents or commands…"/></div><div className="command-list">{allNav.map(([id,label,Icon])=><button key={id} onClick={()=>go(id)}><Icon/><span>{label}</span><kbd>↵</kbd></button>)}</div></DialogContent></Dialog>
    <Dialog open={authOpen} onOpenChange={setAuthOpen}><DialogContent><DialogHeader><DialogTitle>{identity?"Organization access":"Sign in to Legal Eye"}</DialogTitle><DialogDescription>{identity?"Your secure organization session is active for this browser tab.":"Use the credentials issued by your Legal Eye organization owner."}</DialogDescription></DialogHeader>{identity?<div className="auth-session"><ShieldCheck/><div><b>{identity.user.email}</b><span>{identity.role} · private organization workspace</span></div><Button variant="outline" onClick={signOut}>Sign out</Button></div>:<div className="auth-form"><label>Email<Input type="email" value={email} onChange={event=>setEmail(event.target.value)} autoComplete="username"/></label><label>Password<Input type="password" value={password} onChange={event=>setPassword(event.target.value)} onKeyDown={event=>event.key==="Enter"&&signIn()} autoComplete="current-password"/></label><Button onClick={signIn} disabled={signingIn||!email||!password}>{signingIn?"Signing in…":"Sign in"}</Button></div>}</DialogContent></Dialog>
    <Sheet open={sourceOpen} onOpenChange={setSourceOpen}><SheetContent className="source-sheet" showCloseButton={false}><SheetHeader className="sr-only"><SheetTitle>Source</SheetTitle><SheetDescription>Authority and highlighted passage</SheetDescription></SheetHeader><SourceViewer source={source} onClose={()=>setSourceOpen(false)}/></SheetContent></Sheet>
    <Toaster position="bottom-right" richColors/>
  </SidebarProvider>;
}
function Nav({label,group,view,go}:{label?:string;group:readonly (readonly [View,string,typeof Search])[];view:View;go:(v:View)=>void}) {return <SidebarGroup>{label&&<SidebarGroupLabel>{label}</SidebarGroupLabel>}<SidebarGroupContent><SidebarMenu>{group.map(([id,label,Icon])=><SidebarMenuItem key={id}><SidebarMenuButton isActive={view===id} tooltip={label} onClick={()=>go(id)}><Icon/><span>{label}</span>{id==="monitor"&&<i className="nav-count">3</i>}</SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup>}
export default function Home(){return <LegalEye/>}
