/** Build bounded public-law delta postings outside the Worker CPU budget. */
export function buildDeltaTokens(text:string):Record<string,number>{
 const counts=new Map<string,number>();
 for(const match of text.toLowerCase().matchAll(/[\p{L}\p{N}]{3,}/gu)){
  const term=match[0];if(term.length<=100)counts.set(term,(counts.get(term)||0)+1);
 }
 return Object.fromEntries([...counts].sort((a,b)=>b[1]-a[1]).slice(0,3000));
}
