"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, BookOpen, Bot, BriefcaseBusiness, Check, ChevronDown,
  ChevronRight, CircleAlert, ClipboardCheck, Clock3, Columns3, Command as CommandIcon,
  FileClock, FilePenLine, Files, FolderLock, Gavel, Globe2, LibraryBig, ListChecks,
  LockKeyhole, MessageSquareText, MoreHorizontal, PanelRightOpen, Play, Plus, Search,
  ShieldCheck, Sparkles, Table2, Upload, Workflow, X,
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

type View = "ask"|"research"|"draft"|"review"|"tables"|"lists"|"matters"|"vault"|"agent"|"skills"|"workflows"|"monitor";
type Tone = "neutral"|"green"|"blue"|"amber"|"red";
type Source = { id:string; title:string; citation:string; court:string; date:string; treatment:string; tone:Tone; excerpt:string; note:string };
type CorpusDocument = { title:string; citation:string|null; published_at:string|null; canonical_url:string|null };
type CorpusPolicy = { name:string; policy_state:string; sync_enabled:boolean; last_synced_at:string|null; license_name:string|null };

const SUPABASE_URL = "https://ylkntvwvqzzmwstjejei.supabase.co";
const SUPABASE_KEY = "sb_publishable_qtlCHqeWzU-h_bfszdlb2g_P8_o-fXc";
const primary = [
  ["ask","Ask",MessageSquareText],["research","Research",Search],["draft","Draft",FilePenLine],
  ["review","Review",ClipboardCheck],["tables","Tables",Table2],["lists","Lists",ListChecks],
] as const;
const context = [["matters","Matters",BriefcaseBusiness],["vault","Vault",FolderLock]] as const;
const intelligence = [["agent","Agent",Bot],["skills","Skills",Sparkles],["workflows","Workflows",Workflow],["monitor","Monitor",Activity]] as const;
const allNav = [...primary,...context,...intelligence];

const sources:Source[] = [
  {id:"s1",title:"Employment and Labour Relations Act",citation:"Cap. 366 R.E. 2019, s 37",court:"United Republic of Tanzania",date:"Current at 3 Sep 2026",treatment:"Legislation",tone:"blue",excerpt:"A termination of employment is unfair if the employer fails to prove that the reason for the termination is valid, fair, and related to conduct, capacity, compatibility or operational requirements.",note:"Primary legislation · official version history retained"},
  {id:"s2",title:"Illustrative appellate authority",citation:"Sample citation · not a production authority",court:"Court of Appeal · demonstration record",date:"Sample record",treatment:"Unverified",tone:"amber",excerpt:"Procedural fairness is assessed from the record as a whole. A stated reason cannot cure an inquiry that denied the employee a meaningful opportunity to answer the allegation.",note:"Illustrative workspace record · not legal authority"},
  {id:"s3",title:"Illustrative labour authority",citation:"Sample citation · not a production authority",court:"High Court, Labour Division · demonstration",date:"Sample record",treatment:"Unverified",tone:"amber",excerpt:"The employer bears the evidential burden on both substantive justification and the fairness of the procedure adopted before dismissal.",note:"Illustrative workspace record · not legal authority"},
  {id:"s4",title:"Illustrative contrary authority",citation:"Sample citation · not a production authority",court:"High Court, Labour Division · demonstration",date:"Sample record",treatment:"Unverified",tone:"red",excerpt:"A procedural omission will not invariably invalidate termination where the employee admitted the material misconduct and no prejudice is shown.",note:"Illustrative workspace record · not legal authority"},
];

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
function Citation({n,onClick}:{n:number;onClick:()=>void}) {
  return <button className="citation-chip" onClick={onClick} aria-label={"Open source "+n}>{n}</button>;
}
function SourceViewer({source,onClose}:{source:Source;onClose?:()=>void}) {
  return <aside className="source-viewer">
    <div className="pane-title"><span>Source</span><div><Button variant="ghost" size="icon"><ArrowUpRight/></Button>{onClose&&<Button variant="ghost" size="icon" onClick={onClose}><X/></Button>}</div></div>
    <div className="source-body">
      <span className="eyebrow">{source.court}</span><h2>{source.title}</h2><p className="serif muted">{source.citation}</p>
      <div className="row spread source-meta"><ToneBadge tone={source.tone}>{source.treatment}</ToneBadge><span>{source.date}</span></div>
      <hr/><span className="eyebrow">Relevant passage</span><blockquote>{source.excerpt}</blockquote><small>Page 14 · paragraph 37</small>
      <hr/><div className="source-note"><ShieldCheck/><span>{source.note}</span></div>
      <div className="source-actions"><Button variant="outline" onClick={()=>toast.success("Source pinned to matter")}>Pin to matter</Button><Button variant="outline" onClick={()=>toast.success("Citation copied")}>Copy citation</Button></div>
    </div>
  </aside>;
}

function Research({source,setSource}:{source:Source;setSource:(s:Source)=>void}) {
  const [query,setQuery]=useState("What makes a termination unfair under Tanzanian employment law?");
  const [running,setRunning]=useState(false);
  const run=()=>{setRunning(true);setTimeout(()=>{setRunning(false);toast.success("Research completed",{description:"4 authorities checked across legislation and case law."})},1200)};
  return <div className="research-page">
    <div className="research-bar"><Search/><Input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&run()}/><ToneBadge tone="blue">TZ</ToneBadge><Button size="sm" onClick={run}>{running?"Checking…":"Research"}</Button></div>
    <div className="research-grid">
      <aside className="plan-pane"><div className="pane-title"><span>Research plan</span><MoreHorizontal/></div>
        <div className="plan-block"><span className="eyebrow">Question</span><p>When is dismissal substantively or procedurally unfair?</p></div>
        <div className="plan-block"><span className="eyebrow">Searches</span>{["statutory test for unfair termination","procedural fairness labour revision","burden of proof employer","prejudice exception dismissal"].map((x,i)=><div className="plan-step" key={x}><i>{i+1}</i><span>{x}</span><Check/></div>)}</div>
        <div className="plan-block"><div className="row spread"><span className="eyebrow">Authority set</span><small>4</small></div>{sources.map(s=><button className={"authority-mini "+(source.id===s.id?"active":"")} key={s.id} onClick={()=>setSource(s)}><span>{s.title}</span><small>{s.citation}</small></button>)}</div>
      </aside>
      <article className="answer-pane"><div className="answer-head"><div><span className="eyebrow">Sample answer</span><span className="verified"><ShieldCheck/> Demonstration record</span></div><Button variant="ghost" size="sm">Save</Button></div>
        <div className="answer-content">
          <h2>Fair termination requires both a valid reason and a fair process.</h2>
          <p className="standfirst">Under Tanzanian law, an employer must prove substantive justification and procedural fairness. Failure on either limb may render termination unfair.</p>
          <h3>Short answer</h3><p>Section 37 of the Employment and Labour Relations Act places the burden on the employer to establish a valid and fair reason connected to conduct, capacity, compatibility or operational requirements, and to show that a fair procedure was followed. <Citation n={1} onClick={()=>setSource(sources[0])}/></p>
          <h3>Analysis</h3><p>The inquiry is cumulative. A genuine reason does not cure a process that deprived the employee of notice, disclosure, a meaningful opportunity to respond, or an impartial decision. The Court of Appeal has treated the record as a whole while preserving both limbs of the statutory test. <Citation n={2} onClick={()=>setSource(sources[1])}/></p>
          <div className="proposition"><Gavel/><div><span>Core proposition</span><p>The employer bears the evidential burden on substantive justification and procedural fairness.</p></div><Citation n={3} onClick={()=>setSource(sources[2])}/></div>
          <h3>Contrary or limiting authority</h3><p>A High Court decision suggests a procedural omission may not be fatal where misconduct was admitted and no prejudice followed. Treat it narrowly where the employee contested the facts or the omission affected the result. <Citation n={4} onClick={()=>setSource(sources[3])}/></p>
          <h3>Practical test</h3><ol><li>Identify the stated reason at termination.</li><li>Test the reason against statute and evidence.</li><li>Audit notice, disclosure, hearing and decision-making.</li><li>Check the law effective on the termination date.</li></ol>
          <div className="answer-metrics"><div><span>Confidence</span><b>High · 92%</b></div><div><span>Coverage</span><b>1 Act · 3 cases</b></div><div><span>Law as at</span><b>3 Sep 2026</b></div></div>
        </div>
      </article>
      <SourceViewer source={source}/>
    </div>
  </div>;
}

function AskView({go}:{go:()=>void}) {
  const [q,setQ]=useState("");
  const cards=[["Research an issue","Build an authority-backed answer across cases, legislation and firm knowledge.",Search],["Review documents","Apply a playbook and open every finding beside the exact source.",ClipboardCheck],["Prepare a draft","Create a first draft grounded in approved templates and current law.",FilePenLine],["Run a workflow","Coordinate research, review and delivery with visible checkpoints.",Workflow]] as const;
  return <div className="view-pad ask-view"><Header title="Ask Legal Eye" meta="Research public law and permitted firm knowledge in one place."/>
    <div className="composer"><Textarea value={q} onChange={e=>setQ(e.target.value)} placeholder="Ask a legal question, review a clause, or start a matter workflow…"/><div className="row spread"><div className="row options"><Button variant="outline" size="sm"><Globe2/> Tanzania <ChevronDown/></Button><Button variant="ghost" size="sm"><FolderLock/> Firm knowledge</Button><Button variant="ghost" size="sm"><Upload/> Documents</Button></div><Button onClick={go}>Ask <ArrowUpRight/></Button></div></div>
    <div className="prompt-grid">{cards.map(([title,copy,Icon])=><button key={title} onClick={go}><Icon/><strong>{title}</strong><span>{copy}</span><ChevronRight/></button>)}</div>
    <div className="recent"><div className="row spread"><h2>Continue working</h2><Button variant="ghost" size="sm">View all</Button></div>{[["Employment termination opinion","Research · Project Serengeti","12 min ago"],["Kibo acquisition due diligence","Agent · Project Kilimanjaro","Yesterday"],["Payment Services Circular impact","Monitor · Financial regulation","2 days ago"]].map(r=><button key={r[0]}><i><FileClock/></i><span><b>{r[0]}</b><small>{r[1]}</small></span><time>{r[2]}</time><ChevronRight/></button>)}</div>
  </div>;
}

function Draft({show}:{show:()=>void}) {
  const [text,setText]=useState("2.1 The Seller shall procure that the Company complies in all material respects with applicable law between the date of this Agreement and Completion.\n\n2.2 The Seller may disclose Confidential Information to any prospective funder without the Buyer’s prior written consent.\n\n2.3 Completion is conditional on receipt of all regulatory approvals listed in Schedule 4.");
  const act=(x:string)=>toast.success(x+" prepared",{description:"Ready for lawyer review."});
  return <div className="draft-view"><div className="doc-toolbar"><div><span className="eyebrow">Project Kilimanjaro</span><b>Share Purchase Agreement</b></div><div className="row"><ToneBadge tone="green">Saved</ToneBadge><Button variant="outline" size="sm">Share</Button><Button size="sm">Export</Button></div></div>
    <div className="editor-grid"><aside className="outline-pane"><div className="pane-title"><span>Outline</span><Plus/></div>{["Definitions","Sale and purchase","Conditions","Pre-completion undertakings","Warranties","Limitations","Confidentiality","Governing law"].map((x,i)=><button className={i===3?"active":""} key={x}><span>{i+1}</span>{x}</button>)}</aside>
      <article className="doc-canvas"><div className="doc-page"><small>DRAFT · PRIVILEGED & CONFIDENTIAL</small><h1>Share Purchase Agreement</h1><p>between</p><b>KIBO HOLDINGS LIMITED</b><p>and</p><b>VICTORIA CAPITAL PARTNERS</b><hr/><h2>2. Pre-completion undertakings</h2><Textarea value={text} onChange={e=>setText(e.target.value)}/><div className="clause-alert"><CircleAlert/> Clause 2.2 conflicts with the Buyer SPA playbook.</div></div></article>
      <aside className="ai-pane"><div className="ai-head"><span className="brand-mark small">LE</span><b>Legal Eye</b><PanelRightOpen/></div><div className="ai-card"><span className="eyebrow">Selected clause</span><p className="serif">2.2 · Confidentiality disclosure</p></div><div className="ai-card risk"><div className="row spread"><ToneBadge tone="red">Playbook conflict</ToneBadge><small>High</small></div><p>Disclosure to prospective funders is permitted without consent. The buyer playbook requires prior written consent and equivalent confidentiality obligations.</p><button onClick={show}><LibraryBig/> Buyer precedent · clause 18.4 <ChevronRight/></button></div><div className="ai-card suggestion"><span className="eyebrow">Suggested wording</span><p>“…to a bona fide prospective funder, provided that the Buyer has given prior written consent and the recipient is bound by obligations no less protective…”</p></div><div className="ai-actions"><Button onClick={()=>act("Change")}>Apply</Button><Button variant="outline" onClick={()=>act("Redline")}>Redline</Button><Button variant="outline" onClick={()=>act("Comment")}>Comment</Button></div><Button className="wide" variant="ghost" onClick={()=>act("Precedent")}>Save as precedent</Button></aside>
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

function MonitorView({documents,policies}:{documents:CorpusDocument[];policies:CorpusPolicy[]}) {
  const policyTone=(state:string):Tone=>state==="approved"?"green":state==="api_key_required"?"blue":state==="license_required"?"amber":"neutral";
  const policyLabel=(policy:CorpusPolicy)=>policy.policy_state==="approved"?(policy.last_synced_at?"Active":"Ready"):policy.policy_state.replaceAll("_"," ");
  return <div className="view-pad"><Header title="Monitor" meta="Licensed source changes with provenance, policy gates and impact review." action={<Button><Plus/> New monitor</Button>}/>
    <div className="corpus-ops"><div><span className="eyebrow">Corpus operations</span><b>Policy-gated ingestion</b><p>Connectors can only perform capabilities approved in the source registry.</p></div>{policies.map(p=><div key={p.name}><span>{p.name}</span><ToneBadge tone={policyTone(p.policy_state)}>{policyLabel(p)}</ToneBadge><small>{p.license_name||"Rights review pending"}</small></div>)}</div>
    <div className="monitor-grid"><aside>{["Latest official legislation","Tanzania financial services","East Africa data protection","OHADA corporate law"].map((x,i)=><button className={i===0?"active":""} key={x}><Activity/><span>{x}<small>{i===0?documents.length:"connector gated"}</small></span></button>)}</aside><section>{documents.length?documents.map((r,i)=><article key={r.canonical_url||r.title}><time>{r.published_at?new Intl.DateTimeFormat("en",{day:"numeric",month:"short"}).format(new Date(r.published_at)):"Current"}</time><div><header><i>UK</i><span><small>Official source</small><b>UK Legislation</b></span><ToneBadge tone={i===0?"blue":"green"}>{i===0?"Latest":"Ingested"}</ToneBadge></header><h2>{r.title}</h2><div className="impact"><span>Corpus status</span><p>{r.citation||"Official citation pending normalization"} · content fetch and structural parsing queued.</p></div><footer><Button variant="outline" onClick={()=>r.canonical_url&&window.open(r.canonical_url,"_blank","noopener,noreferrer")}>Open official source</Button><Button variant="outline" onClick={()=>toast("Impact analysis requires a configured AI provider and parsed source text.")}>Run impact analysis</Button><Button variant="ghost" onClick={()=>toast("Client matching requires an authenticated firm workspace.")}>Find clients</Button></footer></div></article>):<div className="empty-live"><ShieldCheck/><h2>No approved source records yet</h2><p>The connector will surface documents here after a licensed sync.</p></div>}</section></div></div>;
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
function VaultView() {
  return <div className="view-pad"><Header title="Vault" meta="Private documents stay isolated by organization, matter and document permission." action={<Button onClick={()=>toast("Upload ready",{description:"PDF, DOCX, XLSX, PPTX, HTML, images and TXT are supported."})}><Upload/> Upload</Button>}/><div className="vault-grid"><section>{[["Project Kilimanjaro",287],["Firm precedents",94],["Playbooks",18],["Client correspondence",126]].map(x=><button key={x[0]}><i><FolderLock/></i><span><b>{x[0]}</b><small>{x[1]} documents</small></span><ChevronRight/></button>)}</section><aside><ShieldCheck/><h2>Private Firm Intelligence</h2><p>Client content is permission-filtered before retrieval. Public and firm graphs stay separate and every agent action is auditable.</p>{[["Encryption","In transit & at rest"],["Data boundary","Organization + matter"],["Model training","Disabled for private data"]].map(x=><div key={x[0]}><span>{x[0]}</span><b>{x[1]}</b></div>)}</aside></div></div>;
}
function ReviewView({show}:{show:()=>void}) {
  const rows=[["Change of control consent","Clause 11.4","High","Counterparty consent is required before completion and no deemed-consent mechanism is provided."],["Unlimited data protection indemnity","Clause 18.2","High","Liability is uncapped and sits outside the aggregate cap despite the firm playbook position."],["Missing materiality threshold","Warranty 7.1","Medium","The compliance warranty is absolute and not qualified by materiality or knowledge."],["Governing law inconsistency","Clause 27.1","Medium","English law is selected while the arbitration seat and mandatory approvals are Tanzanian."]];
  return <div className="view-pad"><Header title="Review" meta="Playbook-backed findings, redlines and evidence in one workspace." action={<Button><Plus/> New review</Button>}/><div className="review-summary">{[["Document","Kibo Share Purchase Agreement"],["Playbook","SPA Buyer Review · v5.0"],["Findings","12 · 3 high risk"]].map(x=><div key={x[0]}><span>{x[0]}</span><b>{x[1]}</b></div>)}<Button variant="outline" onClick={show}>Open document</Button></div><div className="findings">{rows.map(r=><button key={r[0]} onClick={show}><i className={r[2].toLowerCase()}/><span><ToneBadge tone={r[2]==="High"?"red":"amber"}>{r[2]}</ToneBadge><h3>{r[0]}</h3><p>{r[3]}</p><small>{r[1]} · 96% confidence · source verified</small></span><ChevronRight/></button>)}</div></div>;
}

function LegalEye() {
  const [view,setView]=useState<View>("research"), [source,setSource]=useState(sources[0]), [sourceOpen,setSourceOpen]=useState(false), [command,setCommand]=useState(false), [count,setCount]=useState(136), [documentCount,setDocumentCount]=useState(0), [liveDocuments,setLiveDocuments]=useState<CorpusDocument[]>([]), [corpusPolicies,setCorpusPolicies]=useState<CorpusPolicy[]>([]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setCommand(x=>!x)}};document.addEventListener("keydown",key);const headers={apikey:SUPABASE_KEY,Authorization:"Bearer "+SUPABASE_KEY,Prefer:"count=exact"};Promise.all([fetch(SUPABASE_URL+"/rest/v1/source_registry?select=id&limit=1",{headers}),fetch(SUPABASE_URL+"/rest/v1/legal_documents?select=title,citation,published_at,canonical_url&order=published_at.desc.nullslast&limit=8",{headers}),fetch(SUPABASE_URL+"/rest/v1/source_registry?select=name,policy_state,sync_enabled,last_synced_at,license_name&adapter_key=in.(uk_legislation,eurlex,laws_africa,courtlistener)&order=name",{headers})]).then(async([sourceResponse,documentResponse,policyResponse])=>{const sourceRange=sourceResponse.headers.get("content-range"),documentRange=documentResponse.headers.get("content-range");if(sourceRange)setCount(Number(sourceRange.split("/")[1]));if(documentRange)setDocumentCount(Number(documentRange.split("/")[1]));if(documentResponse.ok)setLiveDocuments(await documentResponse.json());if(policyResponse.ok)setCorpusPolicies(await policyResponse.json())}).catch(()=>null);return()=>document.removeEventListener("keydown",key)},[]);
  const title=useMemo(()=>allNav.find(x=>x[0]===view)?.[1]||"Research",[view]), go=(v:View)=>{setView(v);setCommand(false)}, show=()=>{setSource(sources[1]);setSourceOpen(true)};
  const content=view==="research"?<Research source={source} setSource={setSource}/>:view==="ask"?<AskView go={()=>go("research")}/>:view==="draft"?<Draft show={show}/>:view==="tables"?<TablesView show={show}/>:view==="agent"?<AgentView/>:view==="skills"?<SkillsView/>:view==="lists"?<ListsView show={show}/>:view==="monitor"?<MonitorView documents={liveDocuments} policies={corpusPolicies}/>:view==="workflows"?<WorkflowView/>:view==="matters"?<MattersView/>:view==="vault"?<VaultView/>:<ReviewView show={show}/>;
  return <SidebarProvider defaultOpen style={{"--sidebar-width":"12.75rem","--sidebar-width-icon":"3.5rem"} as React.CSSProperties}>
    <Sidebar collapsible="icon" className="legal-sidebar"><SidebarHeader className="brand-head"><span className="brand-mark">LE</span><span><b>Legal Eye</b><small>Global intelligence</small></span></SidebarHeader><SidebarContent>
      <Nav group={primary} view={view} go={go}/><Nav label="Context" group={context} view={view} go={go}/><Nav label="Intelligence" group={intelligence} view={view} go={go}/>
    </SidebarContent><SidebarFooter className="user-foot"><button><i>DE</i><span><b>Demo workspace</b><small>Private enterprise preview</small></span><MoreHorizontal/></button></SidebarFooter></Sidebar>
    <SidebarInset className="app-inset"><header className="context-head"><div><SidebarTrigger/><span><b>Project Kilimanjaro</b> <ChevronRight/> {title}</span></div><div><button className="context-pill"><Globe2/> Tanzania <ChevronDown/></button><button className="context-pill privacy-pill"><LockKeyhole/> Firm + matter</button><Button variant="outline" size="sm" onClick={()=>setCommand(true)}><CommandIcon/><span>Search</span><kbd>⌘ K</kbd></Button><button className="clock"><Clock3/></button></div></header><main>{content}</main><footer className="system-bar"><span><i/> Legal graph online</span><span>{documentCount} governed records · {count} source policies</span><span>Private preview · illustrative workspaces labelled</span></footer></SidebarInset>
    <Dialog open={command} onOpenChange={setCommand}><DialogContent className="command-dialog"><DialogHeader><DialogTitle>Go anywhere</DialogTitle><DialogDescription>Search Legal Eye or open a workspace.</DialogDescription></DialogHeader><div className="command-search"><Search/><Input autoFocus placeholder="Research, matters, documents or commands…"/></div><div className="command-list">{allNav.map(([id,label,Icon])=><button key={id} onClick={()=>go(id)}><Icon/><span>{label}</span><kbd>↵</kbd></button>)}</div></DialogContent></Dialog>
    <Sheet open={sourceOpen} onOpenChange={setSourceOpen}><SheetContent className="source-sheet" showCloseButton={false}><SheetHeader className="sr-only"><SheetTitle>Source</SheetTitle><SheetDescription>Authority and highlighted passage</SheetDescription></SheetHeader><SourceViewer source={source} onClose={()=>setSourceOpen(false)}/></SheetContent></Sheet>
    <Toaster position="bottom-right" richColors/>
  </SidebarProvider>;
}
function Nav({label,group,view,go}:{label?:string;group:readonly (readonly [View,string,typeof Search])[];view:View;go:(v:View)=>void}) {return <SidebarGroup>{label&&<SidebarGroupLabel>{label}</SidebarGroupLabel>}<SidebarGroupContent><SidebarMenu>{group.map(([id,label,Icon])=><SidebarMenuItem key={id}><SidebarMenuButton isActive={view===id} tooltip={label} onClick={()=>go(id)}><Icon/><span>{label}</span>{id==="monitor"&&<i className="nav-count">3</i>}</SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup>}
export default function Home(){return <LegalEye/>}
