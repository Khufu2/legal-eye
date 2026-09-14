from pathlib import Path

p = Path("app/page.tsx")
s = p.read_text()

# Ask shortcuts route to their actual workspaces instead of submitting fake research queries.
start = s.index("function AskView(")
end = s.index("\n\nfunction Draft(", start)
ask = r'''function AskView({go,navigate}:{go:(question:string)=>void;navigate:(view:View)=>void}) {
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
}'''
s = s[:start] + ask + s[end:]

# Replace the drafting demo actions with real persisted draft/version actions.
start = s.index("function Draft(")
end = s.index("\n\nfunction TablesView", start)
draft = r'''function Draft({identity,connect}:{identity:DemoIdentity|null;connect:()=>void}) {
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
}'''
s = s[:start] + draft + s[end:]

# Remove Monitor controls that were only toasts; retain official-source navigation.
s = s.replace('action={<Button><Plus/> New monitor</Button>}', '')
s = s.replace('<footer><Button variant="outline" onClick={()=>r.canonical_url&&window.open(r.canonical_url,"_blank","noopener,noreferrer")}>Open official source</Button><Button variant="outline" onClick={()=>toast("Impact analysis activates after the configured processing and AI services complete.")}>Run impact analysis</Button><Button variant="ghost" onClick={()=>toast("Client matching requires an authenticated firm workspace.")}>Find clients</Button></footer>', '<footer><Button variant="outline" disabled={!r.canonical_url} onClick={()=>r.canonical_url&&window.open(r.canonical_url,"_blank","noopener,noreferrer")}>Open official source</Button></footer>')

# Replace fake header controls with status badges; Search remains interactive.
s = s.replace('<button className="context-pill"><Globe2/> Tanzania <ChevronDown/></button><button className="context-pill privacy-pill"><LockKeyhole/> Firm + matter</button>', '<span className="context-pill"><Globe2/> Tanzania</span><span className="context-pill privacy-pill"><LockKeyhole/> Firm + matter</span>')
s = s.replace('<button className="clock"><Clock3/></button>', '')

# Wire revised Ask/Draft components.
old = 'view==="research"?<Research source={source} setSource={setSource} identity={identity} connect={connect} query={researchQuery} setQuery={setResearchQuery} autoRun={researchRun}/>:view==="ask"?<AskView go={question=>{if(!question.trim())return;setResearchQuery(question);if(!identity){connect();toast("Sign in to ask Legal Eye.");return;}setResearchRun(x=>x+1);go("research")}}/>:view==="draft"?<Draft show={show} identity={identity} connect={connect}/>'
new = 'view==="research"?<Research source={source} setSource={setSource} identity={identity} connect={connect} query={researchQuery} setQuery={setResearchQuery} autoRun={researchRun}/>:view==="ask"?<AskView navigate={go} go={question=>{if(!question.trim())return;setResearchQuery(question);if(!identity){connect();toast("Sign in to ask Legal Eye.");return;}setResearchRun(x=>x+1);go("research")}}/>:view==="draft"?<Draft identity={identity} connect={connect}/>'
if old not in s:
    raise SystemExit("Main routing marker not found")
s = s.replace(old, new, 1)

p.write_text(s)
