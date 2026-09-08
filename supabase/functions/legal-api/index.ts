import "jsr:@supabase/functions-js/edge-runtime.d.ts";

function bundledKey(name:string){
  const raw=Deno.env.get(name);
  if(!raw) return "";
  try{
    const values=JSON.parse(raw) as Record<string,unknown>;
    const candidate=values.default||Object.values(values).find(value=>typeof value==="string");
    return typeof candidate==="string"?candidate:"";
  }catch{return "";}
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||bundledKey("SUPABASE_PUBLISHABLE_KEYS")||Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SECRET_KEY")||bundledKey("SUPABASE_SECRET_KEYS")||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
if(!SUPABASE_URL||!ANON||!SERVICE) throw new Error("Supabase runtime configuration is incomplete");
const WEB_ORIGIN=Deno.env.get("LEGAL_EYE_WEB_ORIGIN")||"https://legal-eye-six.vercel.app";
const cors = {
  "Access-Control-Allow-Origin": WEB_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

function json(data: unknown, status=200) {
  return new Response(JSON.stringify(data), {status, headers:{...cors,"content-type":"application/json"}});
}

async function rpc(name:string, body:unknown, auth:string) {
  const r = await fetch(SUPABASE_URL+"/rest/v1/rpc/"+name, {
    method:"POST",
    headers:{apikey:ANON,authorization:auth,"content-type":"application/json"},
    body:JSON.stringify(body)
  });
  const text=await r.text();
  if(!r.ok) throw new Error(text || r.statusText);
  return text ? JSON.parse(text) : null;
}

async function rest(path:string, auth:string, init:RequestInit={}) {
  const h:any={apikey:ANON,authorization:auth,"content-type":"application/json",...(init.headers||{})};
  const r=await fetch(SUPABASE_URL+"/rest/v1/"+path,{...init,headers:h});
  const text=await r.text();
  if(!r.ok) throw new Error(text || r.statusText);
  return text?JSON.parse(text):null;
}

type Classification = "public"|"internal"|"confidential"|"restricted";
type ModelContext = {
  action:string;
  auth:string;
  userId:string;
  organizationId?:string;
  matterId?:string;
  classification:Classification;
  structured:boolean;
};

const classificationRank:Record<Classification,number>={public:0,internal:1,confidential:2,restricted:3};

async function sha256(value:string){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
}

function serviceHeaders(extra:Record<string,string>={}){
  return {apikey:SERVICE,...(!SERVICE.startsWith("sb_")?{authorization:`Bearer ${SERVICE}`} : {}),...extra};
}

async function serviceInsert(table:string,row:Record<string,unknown>){
  const r=await fetch(`${SUPABASE_URL}/rest/v1/${table}`,{
    method:"POST",
    headers:serviceHeaders({"content-type":"application/json",Prefer:"return=minimal"}),
    body:JSON.stringify(row),
  });
  if(!r.ok) throw new Error(`Telemetry insert failed: ${table}`);
}

async function enabledProviders(){
  const r=await fetch(`${SUPABASE_URL}/rest/v1/ai_provider_registry?select=provider_key,priority,model_name,data_classification_ceiling&enabled=is.true&order=priority`,{
    headers:serviceHeaders(),
  });
  if(!r.ok) throw new Error("AI provider registry unavailable");
  return await r.json() as Array<{provider_key:"gemini"|"openrouter";priority:number;model_name:string;data_classification_ceiling:Classification}>;
}

function inspectDlp(value:string){
  const matches:string[]=[];
  const detectors:[string,RegExp,string][]=[
    ["credentials",/(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk|rk)-[A-Za-z0-9_-]{20,}|\bAIza[0-9A-Za-z_-]{20,}|\bAKIA[0-9A-Z]{16}\b)/g,"[REDACTED_CREDENTIAL]"],
    ["financial_account",/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b|\b(?:\d[ -]*?){13,19}\b/g,"[REDACTED_FINANCIAL_IDENTIFIER]"],
    ["government_id",/\b(?:passport|national id|ssn|tin)\s*(?:number|no\.?|#)?\s*[:=-]\s*[A-Z0-9-]{5,24}\b/gi,"[REDACTED_GOVERNMENT_ID]"],
  ];
  let sanitized=value;
  for(const [kind,pattern,replacement] of detectors){
    if(pattern.test(sanitized)){
      matches.push(kind);
      pattern.lastIndex=0;
      sanitized=sanitized.replace(pattern,replacement);
    }
  }
  return {decision:matches.includes("credentials")?"block":matches.length?"redact":"allow",matches,sanitized} as const;
}

async function recordGeneration(ctx:ModelContext, values:Record<string,unknown>){
  await serviceInsert("ai_generation_events",{
    organization_id:ctx.organizationId||null,matter_id:ctx.matterId||null,user_id:ctx.userId,
    action:ctx.action,data_classification:ctx.classification,...values,
  }).catch(()=>undefined);
}

async function routeModel(system:string,prompt:string,ctx:ModelContext) {
  const started=Date.now();
  const requestId=crypto.randomUUID();
  const combinedHash=await sha256(system+"\n"+prompt);
  const dlp=inspectDlp(prompt);
  await serviceInsert("dlp_events",{
    organization_id:ctx.organizationId||null,user_id:ctx.userId,request_id:requestId,
    decision:dlp.decision,detector_types:dlp.matches,content_sha256:combinedHash,
    metadata:{action:ctx.action,content_persisted:false},
  }).catch(()=>undefined);
  if(dlp.decision==="block"){
    await recordGeneration(ctx,{request_id:requestId,outcome:"blocked",prompt_sha256:combinedHash,
      latency_ms:Date.now()-started,dlp_decision:"block",error_code:"DLP_CREDENTIAL_DETECTED"});
    throw new Error("Request blocked because credential-like material was detected. Remove secrets and retry.");
  }

  const timeoutMs=Math.min(Math.max(Number(Deno.env.get("AI_REQUEST_TIMEOUT_MS")||"45000"),5000),120000);
  const maxOutputTokens=Math.min(Math.max(Number(Deno.env.get("AI_MAX_OUTPUT_TOKENS")||"5000"),256),16000);
  const attempts:{provider:string;status:number|string}[]=[];
  const registry=await enabledProviders();
  const providers=registry.map(row=>({
    key:row.provider_key,
    model:Deno.env.get(row.provider_key==="gemini"?"GEMINI_MODEL":"OPENROUTER_MODEL")||row.model_name,
    secret:Deno.env.get(row.provider_key==="gemini"?"GEMINI_API_KEY":"OPENROUTER_API_KEY"),
    ceiling:(Deno.env.get(row.provider_key==="gemini"?"GEMINI_DATA_CLASSIFICATION_CEILING":"OPENROUTER_DATA_CLASSIFICATION_CEILING")||row.data_classification_ceiling) as Classification,
  }));

  for(let index=0;index<providers.length;index++){
    const provider=providers[index];
    if(!provider.secret) continue;
    if(classificationRank[ctx.classification]>classificationRank[provider.ceiling]!) continue;
    try{
      let response:Response;
      if(provider.key==="gemini"){
        response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(provider.model)}:generateContent`,{
          method:"POST",signal:AbortSignal.timeout(timeoutMs),
          headers:{"x-goog-api-key":provider.secret,"content-type":"application/json"},
          body:JSON.stringify({
            systemInstruction:{parts:[{text:system}]},
            contents:[{role:"user",parts:[{text:dlp.sanitized}]}],
            generationConfig:{temperature:0.1,maxOutputTokens,...(ctx.structured?{responseMimeType:"application/json"}:{})},
          }),
        });
      }else{
        response=await fetch("https://openrouter.ai/api/v1/chat/completions",{
          method:"POST",signal:AbortSignal.timeout(timeoutMs),
          headers:{authorization:`Bearer ${provider.secret}`,"content-type":"application/json",
            "HTTP-Referer":Deno.env.get("OPENROUTER_SITE_URL")||WEB_ORIGIN,
            "X-OpenRouter-Title":Deno.env.get("OPENROUTER_APP_NAME")||"Legal Eye"},
          body:JSON.stringify({model:provider.model,temperature:0.1,max_tokens:maxOutputTokens,
            messages:[{role:"system",content:system},{role:"user",content:dlp.sanitized}],
            ...(ctx.structured?{response_format:{type:"json_object"}}:{})}),
        });
      }
      const payload=await response.json();
      if(!response.ok){attempts.push({provider:provider.key,status:response.status});continue;}
      const text=provider.key==="gemini"
        ? payload.candidates?.[0]?.content?.parts?.map((x:any)=>x.text||"").join("\n")||""
        : payload.choices?.[0]?.message?.content||"";
      if(!text){attempts.push({provider:provider.key,status:"empty"});continue;}
      const usage=provider.key==="gemini"
        ? {input_tokens:payload.usageMetadata?.promptTokenCount,output_tokens:payload.usageMetadata?.candidatesTokenCount}
        : {input_tokens:payload.usage?.prompt_tokens,output_tokens:payload.usage?.completion_tokens};
      const responseHash=await sha256(text);
      await recordGeneration(ctx,{request_id:requestId,provider_key:provider.key,model_name:provider.model,outcome:"success",
        fallback_used:index>0,prompt_sha256:combinedHash,response_sha256:responseHash,
        latency_ms:Date.now()-started,dlp_decision:dlp.decision,...usage,
        metadata:{attempts,content_persisted:false}});
      return {provider:provider.key,model:provider.model,text,fallbackUsed:index>0,dlpDecision:dlp.decision,usage};
    }catch(error){
      attempts.push({provider:provider.key,status:error instanceof DOMException?"timeout":"network_error"});
    }
  }
  const configured=providers.some(x=>Boolean(x.secret));
  await recordGeneration(ctx,{request_id:requestId,outcome:configured?"provider_error":"validation_error",
    fallback_used:false,prompt_sha256:combinedHash,latency_ms:Date.now()-started,dlp_decision:dlp.decision,
    error_code:configured?"ALL_PROVIDERS_FAILED":"NO_PROVIDER_CONFIGURED",metadata:{attempts,content_persisted:false}});
  if(configured && attempts.length) throw new Error("All permitted AI providers failed. The request was not completed.");
  return null;
}

function evidenceText(rows:any[], prefix:string){
  return rows.map((r:any,i:number)=>`[${prefix}${i+1}] ${r.title||"Untitled"} ${r.citation||""}\n${r.content||""}`).join("\n\n");
}

Deno.serve(async (req:Request)=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:cors});
  if(req.method!=="POST") return json({error:"POST required"},405);
  const auth=req.headers.get("authorization")||"";
  if(!auth.startsWith("Bearer ")) return json({error:"Authentication required"},401);

  try{
    const input=await req.json();
    const action=input.action;
    const userResponse=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:ANON,authorization:auth}});
    if(!userResponse.ok) return json({error:"Invalid or expired session"},401);
    const user=await userResponse.json();
    if(input.organization_id){
      const membership=await rest(`organization_members?select=organization_id&organization_id=eq.${encodeURIComponent(input.organization_id)}&user_id=eq.${encodeURIComponent(user.id)}&is_active=is.true`,auth);
      if(!membership?.length) return json({error:"Organization access denied"},403);
    }
    const classification=(['public','internal','confidential','restricted'].includes(input.data_classification)
      ? input.data_classification
      : input.organization_id?'confidential':'public') as Classification;
    const structured=['review','review_project','table_extract','checklist_extract'].includes(action);
    const callModel=(system:string,prompt:string)=>routeModel(system,prompt,{
      action,auth,userId:user.id,organizationId:input.organization_id,matterId:input.matter_id,
      classification,structured,
    });

    if(action==="record_gateway_generation"){
      if(!input.organization_id) return json({error:"Organization required"},400);
      const promptHash=String(input.prompt_sha256||"");
      const responseHash=String(input.response_sha256||"");
      if(!/^[a-f0-9]{64}$/.test(promptHash)||!/^[a-f0-9]{64}$/.test(responseHash)) return json({error:"Invalid generation digest"},400);
      await recordGeneration({
        action:String(input.source_action||"gateway"),auth,userId:user.id,organizationId:input.organization_id,
        classification:"confidential",structured:false,
      },{
        provider_key:null,model_name:String(input.model_name||"unknown"),outcome:"success",
        prompt_sha256:promptHash,response_sha256:responseHash,
        input_tokens:Number.isFinite(input.input_tokens)?Math.max(0,Math.floor(input.input_tokens)):null,
        output_tokens:Number.isFinite(input.output_tokens)?Math.max(0,Math.floor(input.output_tokens)):null,
        latency_ms:Math.min(Math.max(Number(input.latency_ms)||0,0),300000),dlp_decision:"allow",
        metadata:{provider_key:"vercel_gateway",transport:"vercel-ai-gateway",content_persisted:false},
      });
      return json({recorded:true});
    }

    if(action==="research"){
      const query=String(input.query||"").trim();
      if(!query) return json({error:"Query required"},400);
      const jurisdictions=Array.isArray(input.jurisdictions)&&input.jurisdictions.length?input.jurisdictions:["TZ"];
      const publicRows=await rpc("search_legal_text",{p_query:query,p_jurisdictions:jurisdictions,p_limit:24},auth);
      let privateRows:any[]=[];
      if(input.organization_id && input.use_firm_knowledge!==false){
        privateRows=await rpc("search_private_text",{p_query:query,p_organization_id:input.organization_id,p_matter_id:input.matter_id||null,p_limit:12},auth);
      }
      const all=[...(publicRows||[]),...(privateRows||[])];
      const system=`You are a legal research assistant. Use only supplied evidence. Never invent cases, statutes, quotes, paragraph numbers, or holdings. Separate binding, persuasive, private-firm, and unverified materials. If evidence is insufficient, state that clearly. This is lawyer decision-support, not a substitute for verification.`;
      const prompt=`Research question: ${query}\nJurisdictions: ${jurisdictions.join(", ")}\n\nPUBLIC EVIDENCE:\n${evidenceText(publicRows||[],"P")}\n\nPRIVATE FIRM EVIDENCE:\n${evidenceText(privateRows||[],"F")}\n\nReturn: Short Answer; Analysis; Key Authorities; Contrary/Limiting Authorities; Practical Implications; Uncertainties. Cite evidence labels exactly.`;
      const model=all.length?await callModel(system,prompt):null;
      const fallback=all.length
        ? "No generative model is configured for this deployment. Retrieved evidence is shown below for lawyer review; no synthesized legal conclusion has been generated."
        : "No verified evidence has been ingested yet for this query. Configure/ingest an approved legal source before relying on this research.";
      return json({answer:model?.text||fallback,provider:model?.provider||"evidence-only",publicEvidence:publicRows||[],privateEvidence:privateRows||[],evidenceCount:all.length});
    }

    if(action==="draft"){
      const instructions=String(input.instructions||"").trim();
      const docType=String(input.document_type||"Legal Memorandum");
      const context=String(input.context||"");
      const system="You are a senior legal drafting assistant. Draft conservatively, preserve placeholders where facts are missing, do not invent authorities, and clearly mark assumptions. Use professional legal structure.";
      const model=await callModel(system,`Document type: ${docType}\nJurisdiction: ${input.jurisdiction||"Tanzania"}\nInstructions: ${instructions}\nContext / verified research:\n${context}`);
      if(!model) return json({provider:"evidence-only",content:`# ${docType}\n\n**Drafting provider not configured.**\n\nInstructions captured:\n${instructions}\n\nAdd an approved model provider secret to generate a grounded first draft.`});
      return json({provider:model.provider,content:model.text});
    }

    if(action==="review"){
      const text=String(input.text||"");
      const playbook=JSON.stringify(input.playbook||[]);
      const system="You are a legal contract review assistant. Identify issues only from supplied contract text and playbook. Do not invent clauses or authorities. Return concise JSON only.";
      const model=await callModel(system,`Contract text:\n${text.slice(0,50000)}\n\nFirm playbook:\n${playbook}\n\nReturn JSON object with overallRisk and findings array. Each finding: title,risk,clauseRef,whyItMatters,originalText,suggestedText.`);
      if(!model) return json({provider:"evidence-only",overallRisk:null,findings:[],message:"Review model is not configured. Document is stored and ready for review once an approved model provider is enabled."});
      let parsed:any=null;
      try{ parsed=JSON.parse(model.text.replace(/^\`\`\`json\s*|\`\`\`$/g,"")); }catch{}
      return json({provider:model.provider,...(parsed||{raw:model.text})});
    }


    if(action==="review_project"){
      const projectRows=await rest("review_projects?select=*,documents(id,title),playbooks(rules)&id=eq."+encodeURIComponent(input.review_project_id),auth);
      if(!projectRows?.length) return json({error:"Review project not found"},404);
      const p=projectRows[0];
      const cs=await rest("document_chunks?select=clause_number,paragraph_number,page_number,content&document_id=eq."+p.document_id+"&order=id&limit=1000",auth);
      const contract=(cs||[]).map((x:any)=>"["+(x.clause_number||x.paragraph_number||x.page_number||"")+"] "+x.content).join("\n\n");
      const model=await callModel(
        "You are a senior contract-review lawyer. Use only the supplied contract and playbook. Do not invent clauses, facts, authorities or market standards. Return strict JSON.",
        "Contract:\n"+contract.slice(0,90000)+"\n\nPlaybook:\n"+JSON.stringify(p.playbooks?.rules||[])+"\n\nReturn {overallRisk:'high|medium|low|info',findings:[{title,risk,clauseRef,whyItMatters,originalText,suggestedText,sourcePage}]}."
      );
      if(!model) return json({provider:"evidence-only",message:"An approved model provider is required to generate review findings."},409);
      let obj:any; try{obj=JSON.parse(model.text.replace(/^```json\s*|```$/g,""));}catch{return json({error:"Review model did not return valid JSON",raw:model.text},502)}
      await rest("review_findings?review_project_id=eq."+p.id,auth,{method:"DELETE"});
      const findings=(obj.findings||[]).map((f:any)=>({review_project_id:p.id,title:f.title||"Finding",risk:["high","medium","low","info"].includes(f.risk)?f.risk:"info",clause_ref:f.clauseRef||null,why_it_matters:f.whyItMatters||null,original_text:f.originalText||null,suggested_text:f.suggestedText||null,source_page:f.sourcePage||null,metadata:{provider:model.provider}}));
      if(findings.length) await rest("review_findings",auth,{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify(findings)});
      await rest("review_projects?id=eq."+p.id,auth,{method:"PATCH",body:JSON.stringify({status:"complete",overall_risk:obj.overallRisk||"info",summary:{finding_count:findings.length,provider:model.provider},updated_at:new Date().toISOString()})});
      return json({provider:model.provider,overallRisk:obj.overallRisk,findings});
    }

    if(action==="table_extract"){
      const tableRows=await rest("review_tables?select=*&id=eq."+encodeURIComponent(input.review_table_id),auth);
      if(!tableRows?.length) return json({error:"Table not found"},404);
      const t=tableRows[0], docs=Array.isArray(input.document_ids)?input.document_ids.slice(0,50):[];
      const results:any[]=[];
      for(const docId of docs){
        const ds=await rest("documents?select=id,title&id=eq."+encodeURIComponent(docId),auth);
        if(!ds?.length) continue;
        const cs=await rest("document_chunks?select=clause_number,page_number,content&document_id=eq."+encodeURIComponent(docId)+"&order=id&limit=800",auth);
        const contract=(cs||[]).map((x:any)=>"["+(x.clause_number||x.page_number||"")+"] "+x.content).join("\n");
        const model=await callModel("Extract structured contract data. Use only supplied text. Return strict JSON with exactly the requested keys; use null when not found.",
          "Columns: "+JSON.stringify(t.columns||[])+"\nDocument:\n"+contract.slice(0,80000));
        if(!model){results.push({document_id:docId,error:"model_not_configured"});continue}
        let values:any={};try{values=JSON.parse(model.text.replace(/^```json\s*|```$/g,""));}catch{values={_raw:model.text}}
        const ins=await rest("review_table_rows",auth,{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({review_table_id:t.id,document_id:docId,position:results.length,values,review_status:"in_review"})});
        results.push(ins?.[0]||{document_id:docId,values});
      }
      return json({rows:results});
    }

    if(action==="checklist_extract"){
      const listRows=await rest("checklists?select=*&id=eq."+encodeURIComponent(input.checklist_id),auth);
      if(!listRows?.length) return json({error:"Checklist not found"},404);
      const cs=await rest("document_chunks?select=clause_number,page_number,content&document_id=eq."+encodeURIComponent(input.document_id)+"&order=id&limit=1000",auth);
      const text=(cs||[]).map((x:any)=>"["+(x.clause_number||x.page_number||"")+"] "+x.content).join("\n");
      const model=await callModel("Extract legal transaction tasks and conditions from the supplied document. Do not invent obligations. Return strict JSON.",
        "Document:\n"+text.slice(0,90000)+"\nReturn {items:[{title,sourceClause,sourcePage,category,priority,notes}]}.");
      if(!model) return json({provider:"evidence-only",message:"An approved model provider is required for checklist extraction."},409);
      let obj:any;try{obj=JSON.parse(model.text.replace(/^```json\s*|```$/g,""));}catch{return json({error:"Model did not return valid JSON"},502)}
      const items=(obj.items||[]).map((x:any,i:number)=>({checklist_id:input.checklist_id,title:x.title||"Task",source_document_id:input.document_id,source_clause:x.sourceClause||null,source_page:x.sourcePage||null,status:"pending",category:x.category||null,priority:x.priority||"normal",notes:x.notes||null,position:i,metadata:{provider:model.provider}}));
      if(items.length) await rest("checklist_items",auth,{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify(items)});
      return json({provider:model.provider,items});
    }

    if(action==="run_skill"){
      const skillRows=await rest("workflow_skills?select=*&id=eq."+encodeURIComponent(input.skill_id),auth);
      if(!skillRows?.length) return json({error:"Skill not found"},404);
      const skill=skillRows[0];
      const runRows=await rest("agent_runs",auth,{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({organization_id:skill.organization_id,matter_id:input.matter_id||null,created_by:input.user_id,skill_id:skill.id,objective:input.objective||skill.name,status:"running",started_at:new Date().toISOString(),plan:[{step:"Apply firm skill"},{step:"Verify output"}]})});
      const run=runRows[0];
      await rest("agent_events",auth,{method:"POST",body:JSON.stringify({agent_run_id:run.id,event_type:"skill_started",tool_name:"workflow_skill",summary:skill.name})});
      const model=await callModel("Follow this firm's legal workflow exactly. Never exceed the supplied authority or invent facts. Clearly mark missing information.\n\nFIRM SKILL:\n"+skill.instructions,
        "Objective: "+(input.objective||skill.name)+"\nContext:\n"+String(input.context||""));
      const result=model?{provider:model.provider,text:model.text}:{provider:"evidence-only",text:"An approved model provider is required to execute this Skill."};
      await rest("agent_runs?id=eq."+run.id,auth,{method:"PATCH",body:JSON.stringify({status:model?"complete":"blocked",result,completed_at:new Date().toISOString()})});
      await rest("agent_events",auth,{method:"POST",body:JSON.stringify({agent_run_id:run.id,event_type:model?"completed":"blocked",tool_name:"workflow_skill",summary:result.text.slice(0,500)})});
      return json({run_id:run.id,...result});
    }

    if(action==="source_status"){
      const rows=await rest("source_registry?select=name,jurisdiction_code,policy_state,sync_enabled,bulk_ingestion_allowed,embedding_allowed,last_synced_at&order=jurisdiction_code,name",auth);
      return json({sources:rows});
    }

    return json({error:"Unknown action"},400);
  }catch(e){
    console.error(e);
    return json({error:e instanceof Error?e.message:String(e)},500);
  }
});
