type Passage={content?:string;ocr_requires_verification?:unknown};
const normalize=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
/** Accept individual, grouped and page-qualified references without trusting URLs. */
export function evidenceLabels(text:string):string[]{
 return [...new Set([...text.matchAll(/\[[^\]\n]{1,200}\]|\([PF]\d+\b[^)\n]{0,198}\)/g)].flatMap(group=>[...group[0].matchAll(/\b([PF]\d+)\b/g)].map(match=>match[1])))];
}
/** Checks evidence references and verbatim text, never the truth or currentness of law. */
export function auditResearchCitations(answer:string,publicRows:Passage[],privateRows:Passage[]){
 const sources=new Map<string,Passage>([...publicRows.map((row,i)=>[`P${i+1}`,row] as const),...privateRows.map((row,i)=>[`F${i+1}`,row] as const)]);
 const labels=evidenceLabels(answer);
 const unknownLabels=labels.filter(label=>!sources.has(label));
 const passages=[...sources.values()].map(row=>normalize(row.content||''));
 const unmatchedQuotes=[...answer.matchAll(/[“"]([^”"\n]{30,})[”"]/g)].map(match=>match[1]).filter(quote=>!passages.some(text=>text.includes(normalize(quote))));
 const warnings:string[]=[];
 if(!labels.length)warnings.push('The answer has no passage references. Verify every legal proposition against the sources.');
 if(unknownLabels.length)warnings.push(`Unknown evidence references: ${unknownLabels.join(', ')}.`);
 if(unmatchedQuotes.length)warnings.push(`${unmatchedQuotes.length} quotation(s) could not be matched verbatim to the supplied passages. Compare them with the originals.`);
 if(labels.some(label=>sources.get(label)?.ocr_requires_verification))warnings.push('Cited OCR text requires comparison with the original scan.');
 return {scope:'supplied-passages',labels,unknownLabels,unmatchedQuotationCount:unmatchedQuotes.length,warnings,requiresLawyerReview:true,currentnessVerified:false,passed:unknownLabels.length===0&&unmatchedQuotes.length===0&&labels.length>0};
}
