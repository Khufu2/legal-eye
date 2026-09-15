/** Explainable ranking inputs. Vector similarity is never authority by itself. */
export type LegalRetrievalSignals = {
  fullTextRank: number;
  trigramSimilarity: number;
  vectorSimilarity: number;
  metadataMatch: number;
  citationGraphRank: number;
  courtAuthorityRank: number;
  treatmentRank: number;
  temporallyValid: boolean;
  sourcePolicyApproved: boolean;
  permissionGranted: boolean;
};

export function eligibleForLegalAnswer(signals: LegalRetrievalSignals) {
  return signals.permissionGranted && signals.sourcePolicyApproved && signals.temporallyValid;
}

export function explainableHybridScore(signals: LegalRetrievalSignals) {
  if (!eligibleForLegalAnswer(signals)) return Number.NEGATIVE_INFINITY;
  return (
    signals.fullTextRank * 0.22 +
    signals.trigramSimilarity * 0.08 +
    signals.vectorSimilarity * 0.18 +
    signals.metadataMatch * 0.12 +
    signals.citationGraphRank * 0.14 +
    signals.courtAuthorityRank * 0.16 +
    signals.treatmentRank * 0.10
  );
}


/** Private retrieval uses the caller JWT and matter RLS; public search enforces source display rights. */
export function searchTerms(question: string) {
  const stop = new Set('a an the is are was were be been being do does did what which who when where why how can could would should may might must shall i we you they it this that these those of for to from in on at by with and or but as about under please explain compare between their our your also law legal'.split(' '));
  return [...new Set((question.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(w => w.length > 2 && !stop.has(w)))].slice(0,18);
}
export async function retrieveEvidence(options: {url:string;key:string;authorization:string;query:string;jurisdictions:string[];organizationId:string;matterId?:string|null;privateContext?:boolean}) {
  const rpc = async (name:string,body:unknown) => {
    const result=await fetch(`${options.url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:options.key,authorization:options.authorization,'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
    if(!result.ok) throw new Error(`Source search failed (${result.status}). Please retry.`);
    return result.json();
  };
  const terms=searchTerms(options.query);
  const query=terms.length ? terms.map(t=>`"${t}"`).join(' OR ') : options.query;
  const [publicEvidence,privateEvidence]=await Promise.all([
    rpc('search_legal_evidence',{p_query:query,p_jurisdictions:options.jurisdictions.length?options.jurisdictions:null,p_limit:24}),
    options.privateContext ? rpc('search_private_text',{p_query:query,p_organization_id:options.organizationId,p_matter_id:options.matterId || null,p_limit:12}) : Promise.resolve([])
  ]);
  return {publicEvidence,privateEvidence,retrievalState:publicEvidence.length || privateEvidence.length ? 'retrieved' : 'no-evidence'};
}
