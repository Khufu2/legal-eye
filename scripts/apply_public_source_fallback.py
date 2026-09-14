from pathlib import Path

helper = r'''import { extractText, getDocumentProxy } from "unpdf";

type CatalogDocument = {
  id: string;
  title: string;
  citation?: string | null;
  canonical_url?: string | null;
  jurisdiction_code: string;
  document_type: string;
  published_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type OfficialEvidence = {
  legal_document_id: string;
  title: string;
  citation?: string;
  content: string;
  pageNumber: number;
  canonical_url: string | null;
  source_url: string;
  jurisdiction_code: string;
  document_type: string;
  source_kind: "official-on-demand";
  retrieval_score: number;
};

const STOP_WORDS = new Set([
  "what","when","where","which","who","whom","whose","why","how","does","do","did","can","could","would","should",
  "the","and","for","from","with","without","under","into","onto","about","that","this","these","those","are","was","were",
  "have","has","had","being","been","than","then","them","their","there","here","law","legal","tanzania","tanzanian","please",
]);

const DISCOVERY_EXPANSIONS: Array<[RegExp, string[]]> = [
  [/director|shareholder|company|companies|corporate|board/i,["companies"]],
  [/employee|employer|employment|labou?r|termination|redundancy/i,["employment","labour"]],
  [/privacy|personal data|data protection/i,["personal","data","protection"]],
  [/contract|breach|agreement/i,["contract"]],
  [/land|property|lease|tenant|mortgage/i,["land"]],
  [/arbitration|arbitral/i,["arbitration"]],
  [/marriage|divorce|matrimonial/i,["marriage"]],
  [/evidence|admissib/i,["evidence"]],
  [/civil procedure|injunction|plaint|summons/i,["civil","procedure"]],
  [/criminal|offence|offense|penal/i,["penal"]],
  [/tax|vat|income tax|revenue/i,["tax"]],
  [/bank|banking|financial institution/i,["banking","financial"]],
  [/competition|antitrust/i,["competition"]],
  [/insurance|insurer/i,["insurance"]],
  [/mining|mineral/i,["mining"]],
  [/environment|pollution/i,["environmental"]],
  [/probate|succession|estate|administrator/i,["probate","estate"]],
];

function queryTerms(query: string) {
  const values = query.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? [];
  const terms = values.filter(value => !STOP_WORDS.has(value) && value.length >= 4).slice(0, 8);
  for (const [pattern, extras] of DISCOVERY_EXPANSIONS) {
    if (pattern.test(query)) terms.push(...extras);
  }
  return [...new Set(terms)].slice(0, 10);
}

function scoreText(value: string, terms: string[]) {
  const haystack = value.toLowerCase();
  return terms.reduce((score, term) => score + (haystack.includes(term) ? (term.length >= 7 ? 4 : 2) : 0), 0);
}

function officialDownloadUrl(document: CatalogDocument) {
  const metadata = document.metadata ?? {};
  const host = typeof metadata.official_storage_host === "string" ? metadata.official_storage_host : "";
  const rawPath = typeof metadata.official_storage_path === "string" ? metadata.official_storage_path : "";
  if (host !== "oagmis.oag.go.tz" || !rawPath) return null;
  const parts = rawPath.split("/").filter(Boolean);
  if (!parts.length || parts.some(part => part === "." || part === "..")) return null;
  return `https://${host}/storage/${parts.map(part => encodeURIComponent(part)).join("/")}`;
}

function splitPassages(text: string, maxChars = 2400) {
  const paragraphs = text.split(/\n\s*\n|\n/).map(value => value.trim()).filter(Boolean);
  const output: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n${paragraph}` : paragraph;
    if (candidate.length <= maxChars) current = candidate;
    else {
      if (current) output.push(current);
      if (paragraph.length <= maxChars) current = paragraph;
      else {
        for (let index = 0; index < paragraph.length; index += maxChars) output.push(paragraph.slice(index, index + maxChars));
        current = "";
      }
    }
  }
  if (current) output.push(current);
  return output;
}

async function catalogCandidates(options: {
  query: string;
  jurisdictions: string[];
  token: string;
  supabaseUrl: string;
  supabaseKey: string;
}) {
  const terms = queryTerms(options.query);
  if (!terms.length) return { terms, documents: [] as CatalogDocument[] };
  const clauses = terms.flatMap(term => [`title.ilike.*${term}*`,`citation.ilike.*${term}*`]);
  const params = new URLSearchParams({
    select: "id,title,citation,canonical_url,jurisdiction_code,document_type,published_at,metadata",
    jurisdiction_code: `in.(${options.jurisdictions.map(value => value.replace(/[^A-Z0-9_-]/gi, "")).filter(Boolean).join(",")})`,
    or: `(${clauses.join(",")})`,
    order: "published_at.desc.nullslast",
    limit: "12",
  });
  const result = await fetch(`${options.supabaseUrl}/rest/v1/legal_documents?${params}`, {
    headers: { apikey: options.supabaseKey, authorization: `Bearer ${options.token}` },
    cache: "no-store",
  });
  if (!result.ok) return { terms, documents: [] as CatalogDocument[] };
  const rows = await result.json().catch(() => []) as CatalogDocument[];
  const ranked = rows
    .map(document => ({ document, score: scoreText(`${document.title} ${document.citation ?? ""}`, terms) }))
    .filter(item => officialDownloadUrl(item.document))
    .sort((a, b) => b.score - a.score || String(b.document.published_at ?? "").localeCompare(String(a.document.published_at ?? "")))
    .map(item => item.document);
  return { terms, documents: ranked };
}

async function extractCandidate(document: CatalogDocument, terms: string[]): Promise<OfficialEvidence[]> {
  const sourceUrl = officialDownloadUrl(document);
  if (!sourceUrl) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18_000);
  try {
    const source = await fetch(sourceUrl, {
      headers: { "user-agent": "LegalEye/0.3 official-source-research" },
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
    });
    if (!source.ok) return [];
    const resolved = new URL(source.url);
    if (resolved.protocol !== "https:" || resolved.hostname !== "oagmis.oag.go.tz") return [];
    const declaredSize = Number(source.headers.get("content-length") ?? 0);
    if (declaredSize > 30 * 1024 * 1024) return [];
    const bytes = new Uint8Array(await source.arrayBuffer());
    if (bytes.byteLength > 30 * 1024 * 1024 || bytes.byteLength < 5) return [];
    if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") return [];

    const pdf = await getDocumentProxy(bytes, { maxImageSize: 16_777_216 });
    if (pdf.numPages < 1 || pdf.numPages > 750) return [];
    const extraction = extractText(pdf, { mergePages: false });
    const { text } = await Promise.race([
      extraction,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("official_source_extract_timeout")), 24_000)),
    ]);
    const pages = Array.isArray(text) ? text : [text];
    const rankedPages = pages
      .map((page, index) => ({ page: String(page ?? "").trim(), pageNumber: index + 1, score: scoreText(String(page ?? ""), terms) }))
      .filter(item => item.page.length >= 40)
      .sort((a, b) => b.score - a.score || a.pageNumber - b.pageNumber)
      .slice(0, 8);

    const evidence: OfficialEvidence[] = [];
    for (const page of rankedPages) {
      for (const passage of splitPassages(page.page)) {
        if (passage.length < 40) continue;
        evidence.push({
          legal_document_id: document.id,
          title: document.title,
          citation: document.citation ?? undefined,
          content: passage,
          pageNumber: page.pageNumber,
          canonical_url: document.canonical_url ?? null,
          source_url: sourceUrl,
          jurisdiction_code: document.jurisdiction_code,
          document_type: document.document_type,
          source_kind: "official-on-demand",
          retrieval_score: page.score,
        });
        if (evidence.length >= 10) return evidence;
      }
    }
    return evidence;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchOfficialSourceEvidence(options: {
  query: string;
  jurisdictions: string[];
  token: string;
  supabaseUrl: string;
  supabaseKey: string;
}) {
  const catalog = await catalogCandidates(options);
  for (const document of catalog.documents.slice(0, 2)) {
    const evidence = await extractCandidate(document, catalog.terms);
    if (evidence.length) return evidence;
  }
  return [];
}
'''

Path("app/api/legal-ai/public-source-fallback.ts").write_text(helper)

route = Path("app/api/legal-ai/route.ts")
text = route.read_text()
import_line = 'import { fetchOfficialSourceEvidence } from "./public-source-fallback";\n'
if import_line not in text:
    text = text.replace('import { z } from "zod";\n', 'import { z } from "zod";\n' + import_line, 1)
old = '''      const publicEvidence = (evidence.publicEvidence ?? []) as Evidence[];
      const privateEvidence = (evidence.privateEvidence ?? []) as Evidence[];
      if (!publicEvidence.length && !privateEvidence.length) return response(evidence);'''
new = '''      let publicEvidence = (evidence.publicEvidence ?? []) as Evidence[];
      const privateEvidence = (evidence.privateEvidence ?? []) as Evidence[];
      if (!publicEvidence.length && !privateEvidence.length && (input.jurisdictions ?? ["TZ"]).includes("TZ")) {
        const onDemand = await fetchOfficialSourceEvidence({
          query: input.query,
          jurisdictions: input.jurisdictions ?? ["TZ"],
          token,
          supabaseUrl,
          supabaseKey,
        });
        if (onDemand.length) {
          publicEvidence = onDemand;
          evidence.publicEvidence = onDemand;
          evidence.retrievalState = "official-on-demand";
          evidence.retrieval_state = "official-on-demand";
          evidence.exactSourceFallback = true;
        }
      }
      if (!publicEvidence.length && !privateEvidence.length) return response(evidence);'''
if old not in text:
    raise SystemExit("Research evidence block was not found")
text = text.replace(old, new, 1)
route.write_text(text)
