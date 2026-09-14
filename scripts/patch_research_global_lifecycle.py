from pathlib import Path

page=Path('app/page.tsx')
s=page.read_text()
s=s.replace('jurisdiction_codes:["TZ","UK","EU"]','jurisdiction_codes:["TZ","UK","EU","CA","AU"]')
s=s.replace('jurisdictions:["TZ","UK","EU"],organization_id:identity.organization_id','jurisdictions:["TZ","UK","EU","CA","AU"],organization_id:identity.organization_id')
s=s.replace('<ToneBadge tone="blue">TZ</ToneBadge><Button size="sm" onClick={run}>','<ToneBadge tone="blue">TZ · UK · EU · CA · AU</ToneBadge><Button size="sm" onClick={run}>')
needle='''      const publicEvidence:Evidence[]=data.publicEvidence||[],privateEvidence:Evidence[]=data.privateEvidence||[];\n      const mapEvidence=(item:Evidence,index:number,kind:"public"|"private"):Source=>({id:item.id||item.source_node_ref||`${kind}-${item.chunk_id||index}`,title:item.title||"Untitled authority",citation:item.citation||item.source_node_ref||(kind==="private"?"Private firm document":"Citation unavailable"),court:item.court||item.jurisdiction_code||(kind==="private"?"Firm knowledge":"Governed corpus"),date:item.page_number?`Page ${item.page_number}`:"",treatment:item.document_type||(kind==="private"?"Private evidence":"Evidence"),tone:"blue",excerpt:item.content||"Exact passage unavailable.",note:kind==="private"?"Exact passage retrieved from permission-filtered firm knowledge.":"Exact passage retrieved from the governed public corpus.",url:item.canonical_url,page:item.page_number,paragraph:item.paragraph_number,sourceKind:kind,legalDocumentId:item.legal_document_id,privateDocumentId:item.document_id,chunkId:item.chunk_id,rank:item.rank});'''
replacement='''      const publicEvidence:Evidence[]=data.publicEvidence||[],privateEvidence:Evidence[]=data.privateEvidence||[];
      type Lifecycle={id:string;current_status:string|null;effective_from:string|null;effective_to:string|null;repealed_at:string|null;version_label:string|null};
      const statusMap=new Map<string,Lifecycle>();
      const legalIds=[...new Set(publicEvidence.map(item=>item.legal_document_id).filter((id):id is string=>Boolean(id)))];
      if(legalIds.length){
        try{
          const lifecycleResponse=await fetch(`${SUPABASE_URL}/rest/v1/legal_documents?select=id,current_status,effective_from,effective_to,repealed_at,version_label&id=in.(${legalIds.join(",")})`,{headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+identity.access_token},cache:"no-store"});
          if(lifecycleResponse.ok){const rows=await lifecycleResponse.json() as Lifecycle[];rows.forEach(row=>statusMap.set(row.id,row));}
        }catch{/* evidence remains usable even if lifecycle metadata is unavailable */}
      }
      const mapEvidence=(item:Evidence,index:number,kind:"public"|"private"):Source=>{
        const lifecycle=item.legal_document_id?statusMap.get(item.legal_document_id):undefined;
        const today=new Date().toISOString().slice(0,10);
        const repealed=Boolean(lifecycle?.repealed_at)||(lifecycle?.effective_to?lifecycle.effective_to<today:false)||/repeal|revok|supersed|expired/i.test(lifecycle?.current_status||"");
        const lifecycleLabel=kind==="private"?"Private evidence":repealed?"Not current":lifecycle?.current_status?`Official · ${lifecycle.current_status}`:(item.document_type||"Official evidence");
        const lifecycleDate=[lifecycle?.effective_from?`effective ${lifecycle.effective_from}`:null,lifecycle?.repealed_at?`repealed ${lifecycle.repealed_at}`:lifecycle?.effective_to?`to ${lifecycle.effective_to}`:null,lifecycle?.version_label||null,item.page_number?`page ${item.page_number}`:null].filter(Boolean).join(" · ");
        const lifecycleNote=kind==="private"?"Exact passage retrieved from permission-filtered firm knowledge.":repealed?"Exact passage from the governed public corpus. Source metadata indicates this expression is no longer current; verify the current replacement before relying on it.":`Exact passage from the governed public corpus.${lifecycle?.version_label?` Official expression: ${lifecycle.version_label}.`:""}`;
        return {id:item.id||item.source_node_ref||`${kind}-${item.chunk_id||index}`,title:item.title||"Untitled authority",citation:item.citation||item.source_node_ref||(kind==="private"?"Private firm document":"Citation unavailable"),court:item.court||item.jurisdiction_code||(kind==="private"?"Firm knowledge":"Governed corpus"),date:lifecycleDate,treatment:lifecycleLabel,tone:repealed?"red":"blue",excerpt:item.content||"Exact passage unavailable.",note:lifecycleNote,url:item.canonical_url,page:item.page_number,paragraph:item.paragraph_number,sourceKind:kind,legalDocumentId:item.legal_document_id,privateDocumentId:item.document_id,chunkId:item.chunk_id,rank:item.rank};
      };'''
if needle not in s: raise SystemExit('research evidence anchor missing')
s=s.replace(needle,replacement,1)
page.write_text(s)

work=Path('app/api/legal-work/route.ts')
w=work.read_text().replace('jurisdictions: ["TZ", "UK", "EU"]','jurisdictions: ["TZ", "UK", "EU", "CA", "AU"]')
work.write_text(w)
print('global research and lifecycle labels activated')
