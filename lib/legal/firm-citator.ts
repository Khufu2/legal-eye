/** Recognized neutral citations are lookup candidates, never verified by parsing. */
export function citationCandidates(query:string,evidence:Array<{citation?:unknown;[key:string]:unknown}>){
 const neutral=query.match(/\[\d{4}\]\s*[A-Z][A-Z0-9]{1,12}\s*\d{1,7}\b/g)||[];
 return [...new Set([...neutral,...evidence.map(e=>typeof e.citation==='string'?e.citation.trim():'')].filter(c=>c.length>=3&&c.length<=250))].slice(0,80);
}
export async function lookupFirmTreatment(options:{url:string;key:string;authorization:string;organizationId:string;query:string;jurisdictions:string[];evidence:Array<{citation?:unknown;[key:string]:unknown}>}){
 const citations=citationCandidates(options.query,options.evidence);
 if(!citations.length)return {entries:[],coverage:'No recognized authority citations to check',absence_means:'unknown',current_good_law_verified:false};
 try{const result=await fetch(`${options.url}/rest/v1/rpc/lookup_firm_citator`,{method:'POST',headers:{apikey:options.key,authorization:options.authorization,'content-type':'application/json'},body:JSON.stringify({p_organization_id:options.organizationId,p_citations:citations,p_jurisdictions:options.jurisdictions}),cache:'no-store',signal:AbortSignal.timeout(8000)});if(!result.ok)throw new Error('Citator lookup unavailable');return await result.json();}
 catch{return {entries:[],coverage:'Firm citator lookup unavailable; treatment requires manual checking',absence_means:'unknown',current_good_law_verified:false};}
}
