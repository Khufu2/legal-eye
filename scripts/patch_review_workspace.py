from pathlib import Path

page = Path("app/page.tsx")
source = page.read_text()

evidence_marker = 'type Evidence = { id?:string; chunk_id?:number; legal_document_id?:string; document_id?:string; title?:string; citation?:string; court?:string; content?:string; jurisdiction_code?:string; document_type?:string; canonical_url?:string; page_number?:number; paragraph_number?:string; source_node_ref?:string; rank?:number };'
review_type = 'type ReviewFinding = { title:string; clauseRef:string|null; risk:"high"|"medium"|"low"|"info"; whyItMatters:string; originalText?:string|null; suggestedText?:string|null };'
if review_type not in source:
    if evidence_marker not in source:
        raise SystemExit("Evidence type marker not found")
    source = source.replace(evidence_marker, evidence_marker + "\n" + review_type, 1)

start = source.index("function ReviewView(")
end = source.index("\n\nfunction LegalEye()", start)
review_view = r'''function ReviewView({identity,connect,documents,refresh}:{identity:DemoIdentity|null;connect:()=>void;documents:VaultDocument[];refresh:()=>void}) {
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
}'''
source = source[:start] + review_view + source[end:]
old_call = '<ReviewView show={show} identity={identity} connect={connect}/>'
new_call = '<ReviewView identity={identity} connect={connect} documents={vaultDocuments} refresh={()=>void refreshVault()}/>'
if old_call in source:
    source = source.replace(old_call, new_call, 1)
elif new_call not in source:
    raise SystemExit("ReviewView invocation not found")
page.write_text(source)
