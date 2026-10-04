export async function GET() {
  const corpusUrl = process.env.LEGAL_CORPUS_URL?.trim();
  if (!corpusUrl) return Response.json({ error: 'Corpus provider is not configured' }, { status: 503 });
  try {
    const response = await fetch(`${corpusUrl.replace(/\/$/, '')}/stats`, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Corpus statistics unavailable');
    const data = await response.json();
    return Response.json({sources:data.jurisdictions?.length||0,documents:data.documents||0,chunks:data.chunks||0,jurisdictions:data.counts||{},latest:data.latest||[],as_of:data.as_of,coverage:data.coverage||data.state,provider:'cloudflare-r2'}, {headers:{'cache-control':'no-store'}});
  } catch { return Response.json({error:'Corpus statistics unavailable'}, {status:503}); }
}
