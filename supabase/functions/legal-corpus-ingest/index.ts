import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { XMLParser } from "npm:fast-xml-parser@5.2.5";

const U=Deno.env.get("SUPABASE_URL")!;
const A=Deno.env.get("SUPABASE_ANON_KEY")!;
const S=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, apikey, content-type",
  "Access-Control-Allow-Methods":"POST,OPTIONS",
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"content-type":"application/json"}});
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:"@_",removeNSPrefix:true,parseTagValue:false,trimValues:true});

async function fetchText(url:string,accept:string){
  const response=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{
    accept,"user-agent":"LegalEye/0.1 (licensed corpus connector; contact=truckai.co@gmail.com)",
  }});
  if(!response.ok) throw new Error(`Upstream returned ${response.status}`);
  return {text:await response.text(),headers:{etag:response.headers.get("etag"),last_modified:response.headers.get("last-modified")}};
}

async function hash(value:string){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
}

function serviceHeaders(extra:Record<string,string>={}){
  return {apikey:S,authorization:`Bearer ${S}`,...extra};
}

async function service(path:string,init:RequestInit={}){
  const response=await fetch(`${U}/rest/v1/${path}`,{...init,headers:serviceHeaders(init.headers as Record<string,string>||{})});
  const body=await response.text();
  if(!response.ok) throw new Error(`Database operation failed: ${response.status}`);
  return body?JSON.parse(body):null;
}

async function authenticate(auth:string){
  const userResponse=await fetch(`${U}/auth/v1/user`,{headers:{apikey:A,authorization:auth}});
  if(!userResponse.ok) return null;
  const user=await userResponse.json();
  const membership=await fetch(`${U}/rest/v1/organization_members?select=organization_id,role&user_id=eq.${encodeURIComponent(user.id)}&is_active=is.true&role=in.(owner,admin)`,{headers:{apikey:A,authorization:auth}});
  const rows=await membership.json();
  return membership.ok&&rows?.length?user:null;
}

function oneOrMany<T>(value:T|T[]|undefined):T[]{
  return value===undefined?[]:Array.isArray(value)?value:[value];
}

function absoluteUrl(value:string|undefined){
  return value?.replace(/^http:\/\//,"https://");
}

async function ingestUkLegislation(source:any,runId:string,limit:number){
  const feedUrl=`https://www.legislation.gov.uk/all/data.feed?sort=published&page=1`;
  const feed=await fetchText(feedUrl,"application/atom+xml");
  const parsed=parser.parse(feed.text);
  const entries=oneOrMany(parsed?.feed?.entry).slice(0,limit);
  let inserted=0,updated=0,rejected=0;
  let newest:string|undefined;

  for(const entry of entries){
    try{
      const externalId=String(entry.id||"");
      const links=oneOrMany(entry.link);
      const canonical=absoluteUrl(String(links.find((x:any)=>!x?.["@_rel"])?.["@_href"]||externalId));
      if(!externalId||!canonical){rejected++;continue;}
      const currentUrl=canonical.endsWith("/made")||canonical.endsWith("/enacted")?canonical:`${canonical}/made`;
      let raw="";
      let rawHeaders:any={};
      try{
        const document=await fetchText(`${currentUrl}/data.xml`,"application/xml");
        raw=document.text;
        rawHeaders=document.headers;
      }catch{
        raw=JSON.stringify(entry);
      }
      const contentHash=await hash(raw);
      const title=typeof entry.title==="string"?entry.title:String(entry.title?.["#text"]||"Untitled legislation");
      const published=entry.published||entry.updated||null;
      newest=!newest||String(published)>newest?String(published):newest;
      const mainType=entry.DocumentMainType?.["@_Value"]||"legislation";
      const year=entry.Year?.["@_Value"];
      const number=entry.Number?.["@_Value"];

      const existing=await service(`legal_documents?select=id,content_hash&source_id=eq.${source.id}&canonical_source_id=eq.${encodeURIComponent(externalId)}`);
      const values={
        source_id:source.id,canonical_source_id:externalId,canonical_url:canonical,jurisdiction_code:"UK",
        document_type:String(mainType),title,citation:year&&number?`${mainType} ${year}/${number}`:null,
        published_at:published,current_status:"published",version_label:"official current expression",language:"en",
        structured_content:{format:"CLML",hierarchy_preserved:true,parser_state:"queued",feed_entry:entry},
        content_hash:contentHash,retrieved_at:new Date().toISOString(),
        metadata:{source:"UK Legislation",attribution:source.attribution_text,licence:source.license_name,raw_media_type:raw.startsWith("<")?"application/xml":"application/json"},
        updated_at:new Date().toISOString(),
      };
      let legalDocumentId:string;
      if(existing?.length){
        legalDocumentId=existing[0].id;
        if(existing[0].content_hash===contentHash) continue;
        await service(`legal_documents?id=eq.${legalDocumentId}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(values)});
        updated++;
      }else{
        const created=await service("legal_documents",{method:"POST",headers:{"content-type":"application/json",Prefer:"return=representation"},body:JSON.stringify(values)});
        legalDocumentId=created[0].id;
        inserted++;
      }
      await service("source_ingest_objects",{method:"POST",headers:{"content-type":"application/json",Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify({
        source_id:source.id,connector_run_id:runId,external_id:externalId,canonical_url:canonical,
        media_type:raw.startsWith("<")?"application/xml":"application/json",source_published_at:published,
        content_sha256:contentHash,byte_size:new TextEncoder().encode(raw).byteLength,raw_content:raw,
        headers:rawHeaders,provenance:{feed_url:feedUrl,retrieved_by:"legal-corpus-ingest",connector_version:"uk-legislation@1"},
        processing_state:"stored",
      })});
      await service("ingestion_jobs",{method:"POST",headers:{"content-type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({
        source_id:source.id,job_type:"legal_xml_parse",status:"queued",
        payload:{legal_document_id:legalDocumentId,format:"CLML",source_object_hash:contentHash,preserve_hierarchy:true},
      })});
    }catch{rejected++;}
  }
  return {discovered:entries.length,fetched:entries.length,inserted,updated,rejected,cursor:{published_before:newest,page:1},feedHeaders:feed.headers};
}

type OagCollection={
  key:string;
  endpoint:string;
  detailPath:string;
  downloadPath:string;
  documentType:string;
};

const OAG_COLLECTIONS:OagCollection[]=[
  {key:"acts",endpoint:"acts-ajax",detailPath:"acts",downloadPath:"acts",documentType:"act"},
  {key:"revised_acts",endpoint:"revised-acts-ajax",detailPath:"revised-acts",downloadPath:"acts/revised",documentType:"revised_act"},
  {key:"subsidiary_legislation",endpoint:"legislation-ajax",detailPath:"legislation",downloadPath:"legislation",documentType:"subsidiary_legislation"},
  {key:"annual_supplements",endpoint:"annual-supplements-ajax",detailPath:"annual-supplements",downloadPath:"annual-supplements",documentType:"annual_supplement"},
  {key:"bills",endpoint:"bills-ajax",detailPath:"bills",downloadPath:"bills",documentType:"bill"},
  {key:"guidelines",endpoint:"guidelines-ajax",detailPath:"guidelines",downloadPath:"guidelines",documentType:"guideline"},
  {key:"parliamentary_resolutions",endpoint:"bills-specific-resolutions",detailPath:"specific-resolutions",downloadPath:"specific-resolutions",documentType:"parliamentary_resolution"},
  {key:"international_instruments",endpoint:"bills-international-resolutions",detailPath:"international-resolutions",downloadPath:"international-resolutions",documentType:"international_instrument"},
];

function firstValue(item:any,keys:string[]){
  for(const key of keys) if(item?.[key]!==undefined&&item?.[key]!==null&&String(item[key]).trim()) return String(item[key]).trim();
  return null;
}

function batches<T>(items:T[],size=100){
  const result:T[][]=[];
  for(let index=0;index<items.length;index+=size) result.push(items.slice(index,index+size));
  return result;
}

async function ingestTanzaniaOag(source:any,runId:string){
  const base="https://oagmis.oag.go.tz/portal";
  const discovered:any[]=[];
  const collectionCounts:Record<string,number>={};
  const validators:Record<string,unknown>={};

  for(const collection of OAG_COLLECTIONS){
    const url=`${base}/${collection.endpoint}`;
    const response=await fetchText(url,"application/json");
    const payload=JSON.parse(response.text);
    const rows=Array.isArray(payload?.data)?payload.data:[];
    collectionCounts[collection.key]=Number(payload?.recordsTotal||rows.length);
    validators[collection.key]=response.headers;
    for(const item of rows) discovered.push({collection,item,feedUrl:url});
  }

  const existingRows=await service(`legal_documents?select=canonical_source_id&source_id=eq.${source.id}&limit=5000`);
  const existing=new Set((existingRows||[]).map((row:any)=>String(row.canonical_source_id)));
  const now=new Date().toISOString();
  const documents:any[]=[];
  const objects:any[]=[];
  const jobs:any[]=[];

  for(const {collection,item,feedUrl} of discovered){
    const id=String(item.id||"").trim();
    if(!id) continue;
    const externalId=`oag:${collection.key}:${id}`;
    const title=firstValue(item,["shortTitle","title","name","longTitle"])||`Tanzania ${collection.documentType} ${id}`;
    const publicationDate=firstValue(item,["publicationDate","issuedDate","resolutionDate","enactmentDate","created_at"]);
    const effectiveDate=firstValue(item,["commencementDate","proclamationDate"]);
    const chapter=firstValue(item,["chapterNumber"]);
    const number=firstValue(item,["enactmentNo","issuedNumber","billNumber","resolutionNumber"]);
    const citation=chapter?`Cap. ${chapter}${publicationDate?` R.E. ${publicationDate.slice(0,4)}`:""}`:number?`No. ${number}`:null;
    const canonicalUrl=`${base}/${collection.detailPath}/${id}`;
    const downloadUrl=`${base}/${collection.downloadPath}/${id}/download`;
    const raw=JSON.stringify(item);
    const contentHash=await hash(raw);
    const language=/^(sheria|kanuni|katiba)\b/i.test(title)?"sw":"en";
    documents.push({
      source_id:source.id,canonical_source_id:externalId,canonical_url:canonicalUrl,jurisdiction_code:"TZ",
      document_type:collection.documentType,title,citation,published_at:publicationDate,
      effective_from:effectiveDate,current_status:item.published===false?"unpublished":"published",
      version_label:collection.key==="revised_acts"?"official revised edition":"official source record",
      language,structured_content:{format:"OAG_METADATA",hierarchy_preserved:false,parser_state:"queued",oag:item},
      content_hash:contentHash,retrieved_at:now,updated_at:now,
      metadata:{source:"Tanzania Office of the Attorney General",collection:collection.key,download_url:downloadUrl,
        attribution:source.attribution_text,licence:source.license_name,approval_basis:source.terms_notes}
    });
    objects.push({
      source_id:source.id,connector_run_id:runId,external_id:externalId,canonical_url:canonicalUrl,
      media_type:"application/json",source_published_at:publicationDate,content_sha256:contentHash,
      byte_size:new TextEncoder().encode(raw).byteLength,raw_content:raw,headers:validators[collection.key]||{},
      provenance:{catalog_url:feedUrl,download_url:downloadUrl,retrieved_by:"legal-corpus-ingest",connector_version:"tz-oag@1"},
      processing_state:"stored"
    });
    if(!existing.has(externalId)) jobs.push({
      source_id:source.id,job_type:"official_pdf_fetch_parse",status:"queued",
      payload:{external_id:externalId,download_url:downloadUrl,jurisdiction_code:"TZ",document_type:collection.documentType,
        parser:"docling",preserve_pages:true,preserve_coordinates:true}
    });
  }

  for(const group of batches(documents)) await service("legal_documents?on_conflict=source_id,canonical_source_id",{
    method:"POST",headers:{"content-type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(group)
  });
  for(const group of batches(objects)) await service("source_ingest_objects?on_conflict=source_id,external_id,content_sha256",{
    method:"POST",headers:{"content-type":"application/json",Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify(group)
  });
  for(const group of batches(jobs)) await service("ingestion_jobs",{
    method:"POST",headers:{"content-type":"application/json",Prefer:"return=minimal"},body:JSON.stringify(group)
  });

  return {discovered:discovered.length,fetched:OAG_COLLECTIONS.length,inserted:documents.filter(x=>!existing.has(x.canonical_source_id)).length,
    updated:documents.filter(x=>existing.has(x.canonical_source_id)).length,rejected:discovered.length-documents.length,
    queued:jobs.length,collections:collectionCounts,cursor:{synced_at:now},feedHeaders:{}};
}

Deno.serve(async(request)=>{
  if(request.method==="OPTIONS") return new Response(null,{headers:cors});
  if(request.method!=="POST") return json({error:"POST required"},405);
  const auth=request.headers.get("authorization")||"";
  if(!auth.startsWith("Bearer ")) return json({error:"Authentication required"},401);
  const user=await authenticate(auth);
  if(!user) return json({error:"Corpus operator role required"},403);

  let runId:string|undefined;
  try{
    const input=await request.json();
    const adapter=String(input.adapter||"");
    const mode=String(input.mode||"incremental_sync");
    const limit=Math.min(Math.max(Number(input.limit||10),1),20);
    if(!["uk_legislation","tz_oag"].includes(adapter)) return json({error:"Connector is not enabled"},400);
    const rows=await service(`source_registry?select=*&adapter_key=eq.${encodeURIComponent(adapter)}`);
    const source=rows?.[0];
    if(!source) return json({error:"Source registry entry not found"},404);
    const capability=mode==="bulk_ingest"?"bulk_ingest":mode==="individual_fetch"?"individual_fetch":"discover";
    const allowed=await service(`rpc/source_capability_allowed`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({p_source_id:source.id,p_capability:capability})});
    if(allowed!==true) return json({error:"Source policy gate denied this operation",source:source.name,capability},403);

    const connectorVersion=adapter==="tz_oag"?"tz-oag@1":"uk-legislation@1";
    const runs=await service("connector_runs",{method:"POST",headers:{"content-type":"application/json",Prefer:"return=representation"},body:JSON.stringify({
      source_id:source.id,connector_version:connectorVersion,mode,status:"running",requested_by:user.id,
      started_at:new Date().toISOString(),policy_snapshot:{policy_state:source.policy_state,capability,licence:source.license_name,reviewed_at:source.last_legal_review},
    })});
    runId=runs[0].id;
    const result=adapter==="tz_oag"?await ingestTanzaniaOag(source,runId):await ingestUkLegislation(source,runId,limit);
    await service(`connector_runs?id=eq.${runId}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({
      status:result.rejected?"partial":"succeeded",discovered_count:result.discovered,fetched_count:result.fetched,
      inserted_count:result.inserted,updated_count:result.updated,rejected_count:result.rejected,
      cursor_after:result.cursor,completed_at:new Date().toISOString(),
    })});
    await service(`source_registry?id=eq.${source.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({last_synced_at:new Date().toISOString()})});
    await service("source_sync_cursors",{method:"POST",headers:{"content-type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({
      source_id:source.id,cursor:result.cursor,watermark:result.cursor.published_before,etag:result.feedHeaders.etag,last_modified:result.feedHeaders.last_modified,
      consecutive_failures:0,updated_at:new Date().toISOString(),
    })});
    return json({ok:true,run_id:runId,source:source.name,...result});
  }catch(error){
    if(runId) await service(`connector_runs?id=eq.${runId}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({status:"failed",error_summary:error instanceof Error?error.message:"Unknown error",completed_at:new Date().toISOString()})}).catch(()=>undefined);
    return json({error:"Corpus ingestion failed",run_id:runId},500);
  }
});
