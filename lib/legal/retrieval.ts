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

const SEARCH_STOP_WORDS = new Set(
  "a an the is are was were be been being do does did what which who when where why how can could would should may might must shall i we you they it this that these those of for to from in on at by with without and or but as about under please explain compare between their our your also law legal makes make cite exact relevant provisions provide answer question tanzania tanzanian act acts statute statutes section sections case cases leading identify applicable company worked working work years year months month immediately alleged given paid one two three four five six seven eight nine ten".split(" "),
);

const LEGAL_CONCEPT_TERMS = new Set(
  "employment employee employer termination terminated dismissal dismissed misconduct disciplinary hearing notice unfair fairness procedural procedure substantive remedy remedies compensation reinstatement redundancy contract agreement breach confidentiality indemnity liability director directors fiduciary shareholder corporate negligence duty duties land property title lease tenant mortgage arbitration arbitral evidence admissibility civil criminal offence offense penal tax vat revenue banking competition insurance mining environmental probate succession estate privacy data protection divorce marriage injunction appeal jurisdiction limitation damages".split(" "),
);

const CANONICAL_TERM: Record<string, string> = {
  employee: "employment",
  employer: "employment",
  terminated: "termination",
  dismissal: "termination",
  dismissed: "termination",
  fairness: "unfair",
  procedure: "procedural",
  remedies: "remedy",
  directors: "director",
  duties: "duty",
  arbitral: "arbitration",
  offence: "criminal",
  offense: "criminal",
};

function canonicalize(term: string) {
  return CANONICAL_TERM[term] ?? term;
}

/** Private retrieval uses the caller JWT and matter RLS; public search enforces source display rights. */
export function searchTerms(question: string) {
  const raw = [
    ...new Set(
      (question.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
        .filter(word => word.length > 2 && !/^\d+$/.test(word) && !SEARCH_STOP_WORDS.has(word)),
    ),
  ];

  return raw
    .map((word, index) => ({ word: canonicalize(word), index, priority: LEGAL_CONCEPT_TERMS.has(word) ? 1 : 0 }))
    .filter((entry, index, all) => all.findIndex(candidate => candidate.word === entry.word) === index)
    .sort((a, b) => b.priority - a.priority || a.index - b.index)
    .slice(0, 8)
    .map(entry => entry.word);
}

export function buildSearchQueries(question: string) {
  const terms = searchTerms(question);
  if (!terms.length) return [question.trim()].filter(Boolean);

  const quoted = (values: string[], joiner: " " | " OR ") => values.map(term => `"${term}"`).join(joiner);
  const plans = [
    quoted(terms.slice(0, 2), " "),
    quoted(terms.slice(0, 2), " OR "),
    quoted(terms.slice(0, 4), " OR "),
  ].filter(Boolean);

  return [...new Set(plans)];
}

export async function retrieveEvidence(options: {url:string;key:string;authorization:string;query:string;jurisdictions:string[];organizationId:string;matterId?:string|null;privateContext?:boolean}) {
  const rpc = async (name:string,body:unknown) => {
    const result=await fetch(`${options.url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:options.key,authorization:options.authorization,'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
    if(!result.ok) {
      const scope = name === "search_legal_evidence" ? "Public legal" : "Private firm";
      throw new Error(`${scope} source search is temporarily unavailable (${result.status}). No legal conclusion was generated. Please retry.`);
    }
    return result.json();
  };

  const queries=buildSearchQueries(options.query);
  const publicSearch = async () => {
    let lastError: unknown = null;
    for (const pQuery of queries) {
      try {
        const rows = await rpc('search_legal_evidence',{
          p_query:pQuery,
          p_jurisdictions:options.jurisdictions.length?options.jurisdictions:null,
          p_limit:24,
        });
        if (rows.length) return rows;
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) throw lastError;
    return [];
  };

  const privateQuery=queries[0] || options.query;
  const [publicEvidence,privateEvidence]=await Promise.all([
    publicSearch(),
    options.privateContext ? rpc('search_private_text',{p_query:privateQuery,p_organization_id:options.organizationId,p_matter_id:options.matterId || null,p_limit:12}) : Promise.resolve([])
  ]);
  return {publicEvidence,privateEvidence,retrievalState:publicEvidence.length || privateEvidence.length ? 'retrieved' : 'no-evidence'};
}
