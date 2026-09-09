"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, BookOpen, ChevronRight, CircleAlert, ClipboardCheck,
  Command as CommandIcon, FilePenLine, Files, FolderLock, Globe2, LibraryBig,
  LoaderCircle, LockKeyhole, LogOut, Menu, MessageSquareText, Search,
  ShieldCheck, Sparkles, Upload, X,
} from "lucide-react";
import { MessageResponse } from "@/components/ai-elements/message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

type View = "ask" | "draft" | "review" | "vault" | "monitor";
type Session = {
  access_token: string;
  user: { id: string; email?: string };
  role: string;
  organization_id: string;
};
type Evidence = {
  id?: string;
  title?: string;
  citation?: string;
  content?: string;
  jurisdiction_code?: string;
  document_type?: string;
  canonical_url?: string;
  page_number?: number;
  source_node_ref?: string;
};
type ResearchResult = {
  answer: string;
  provider?: string;
  evidenceCount?: number;
  publicEvidence?: Evidence[];
  privateEvidence?: Evidence[];
};
type VaultDocument = {
  id: string;
  title: string;
  file_name: string | null;
  status: string;
  created_at: string;
  size_bytes: number | null;
};
type CorpusDocument = {
  id?: string;
  title: string;
  citation: string | null;
  published_at: string | null;
  canonical_url: string | null;
  jurisdiction_code: string;
  document_type: string;
};
type CorpusPolicy = {
  name: string;
  jurisdiction_code: string | null;
  policy_state: string;
  last_synced_at: string | null;
  license_name: string | null;
};
type Finding = {
  title: string;
  risk: "high" | "medium" | "low" | "info";
  clauseRef: string | null;
  whyItMatters: string;
  originalText?: string | null;
  suggestedText?: string | null;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const SESSION_KEY = "legal-eye-session";
const navigation = [
  ["ask", "Ask", MessageSquareText],
  ["draft", "Draft", FilePenLine],
  ["review", "Review", ClipboardCheck],
  ["vault", "Vault", FolderLock],
  ["monitor", "Sources", Globe2],
] as const;

function apiHeaders(token?: string) {
  return {
    apikey: SUPABASE_KEY,
    ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: `Bearer ${SUPABASE_KEY}` }),
  };
}

function formatBytes(value: number | null) {
  if (!value) return "Size unavailable";
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  return <Badge className={`hm-badge hm-${tone}`}>{children}</Badge>;
}

function EmptyState({ icon: Icon, title, copy, action }: { icon: typeof Files; title: string; copy: string; action?: React.ReactNode }) {
  return <div className="hm-empty"><span><Icon /></span><h2>{title}</h2><p>{copy}</p>{action}</div>;
}

function PageHeader({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: React.ReactNode }) {
  return <header className="hm-page-header"><div><span>{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div>{action}</header>;
}

function AskPage({ session, requestSignIn }: { session: Session | null; requestSignIn: () => void }) {
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [selected, setSelected] = useState<Evidence | null>(null);
  const evidence = useMemo(() => [...(result?.publicEvidence ?? []), ...(result?.privateEvidence ?? [])], [result]);

  const run = async (question = query) => {
    const clean = question.trim();
    if (clean.length < 3) return toast.error("Enter a legal research question.");
    if (!session) { requestSignIn(); return; }
    setQuery(clean);
    setRunning(true);
    setResult(null);
    setSelected(null);
    try {
      const response = await fetch("/api/legal-ai", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "content-type": "application/json" },
        body: JSON.stringify({
          action: "research",
          query: clean,
          jurisdictions: ["TZ"],
          organization_id: session.organization_id,
          use_firm_knowledge: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Research failed");
      setResult(data);
      const first = [...(data.publicEvidence ?? []), ...(data.privateEvidence ?? [])][0];
      if (first) setSelected(first);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Research failed");
    } finally {
      setRunning(false);
    }
  };

  const prompts = [
    "What remedies are available for unfair termination in Tanzania?",
    "What makes an arbitration clause enforceable under Tanzanian law?",
    "Summarise the statutory duties of company directors in Tanzania.",
  ];

  return <div className="hm-ask">
    {!result ? <div className="hm-ask-intro">
      <span className="hm-kicker"><ShieldCheck /> Source-grounded legal intelligence</span>
      <h1>Start with the legal question.</h1>
      <p>Legal Eye searches governed public sources and your permitted firm knowledge, then shows the evidence behind its answer.</p>
      <div className="hm-composer">
        <Textarea value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void run(); }
        }} placeholder="Ask a question about Tanzanian law..." aria-label="Legal research question" />
        <footer><div><StatusBadge>Tanzania</StatusBadge><span><LockKeyhole /> Firm knowledge included when permitted</span></div><Button onClick={() => void run()} disabled={running || query.trim().length < 3}>{running ? <LoaderCircle className="hm-spin" /> : <ArrowRight />} {running ? "Researching" : "Ask Legal Eye"}</Button></footer>
      </div>
      <div className="hm-prompts"><span>Try a focused question</span>{prompts.map((prompt) => <button key={prompt} onClick={() => { setQuery(prompt); void run(prompt); }}><span>{prompt}</span><ArrowRight /></button>)}</div>
      {!session ? <div className="hm-auth-note"><ShieldCheck /><span><b>Secure workspace required</b> Sign in before research so permissions can be applied to every source.</span><Button variant="outline" onClick={requestSignIn}>Sign in</Button></div> : null}
    </div> : <div className="hm-research">
      <div className="hm-research-bar"><Search /><Input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void run()} /><Button onClick={() => void run()} disabled={running}>{running ? <LoaderCircle className="hm-spin" /> : "Research"}</Button></div>
      <div className="hm-research-layout">
        <aside className="hm-evidence-list"><header><span>Evidence</span><StatusBadge tone={evidence.length ? "good" : "warn"}>{evidence.length} passages</StatusBadge></header>
          {evidence.length ? evidence.map((item, index) => <button key={item.id ?? `${item.title}-${index}`} className={selected === item ? "active" : ""} onClick={() => setSelected(item)}><i>{index + 1}</i><span><b>{item.title || "Untitled authority"}</b><small>{item.citation || item.jurisdiction_code || "Citation pending"}</small></span><ChevronRight /></button>) : <div className="hm-inline-empty"><CircleAlert /><p>No matching verified passages are indexed yet. The answer is limited accordingly.</p></div>}
        </aside>
        <article className="hm-answer"><header><div><span>Research answer</span><small><ShieldCheck /> {result.provider || "governed retrieval"}</small></div><Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(result.answer).then(() => toast.success("Answer copied"))}>Copy</Button></header><div className="hm-answer-body"><MessageResponse>{result.answer}</MessageResponse><footer><CircleAlert /> Lawyer verification required. Open and confirm every authority before relying on this work.</footer></div></article>
        <aside className="hm-source"><header><span>Source detail</span>{selected ? <button onClick={() => setSelected(null)} aria-label="Close source"><X /></button> : null}</header>{selected ? <div><StatusBadge tone="good">Verified retrieval</StatusBadge><h2>{selected.title || "Untitled authority"}</h2><p className="hm-citation">{selected.citation || "Citation pending normalization"}</p><dl><div><dt>Jurisdiction</dt><dd>{selected.jurisdiction_code || "Not stated"}</dd></div><div><dt>Location</dt><dd>{selected.page_number ? `Page ${selected.page_number}` : selected.source_node_ref || "Exact span retained"}</dd></div></dl><blockquote>{selected.content || "No excerpt was returned."}</blockquote>{selected.canonical_url ? <Button variant="outline" onClick={() => window.open(selected.canonical_url, "_blank", "noopener,noreferrer")}><BookOpen /> Open official source</Button> : null}</div> : <EmptyState icon={BookOpen} title="Select an authority" copy="Choose a retrieved passage to inspect its citation and exact text." />}</aside>
      </div>
    </div>}
  </div>;
}

function DraftPage({ session, requestSignIn }: { session: Session | null; requestSignIn: () => void }) {
  const [documentType, setDocumentType] = useState("Legal memorandum");
  const [instructions, setInstructions] = useState("");
  const [context, setContext] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const generate = async () => {
    if (!session) { requestSignIn(); return; }
    if (instructions.trim().length < 3) return toast.error("Add drafting instructions.");
    setRunning(true);
    try {
      const response = await fetch("/api/legal-ai", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "content-type": "application/json" }, body: JSON.stringify({ action: "draft", organization_id: session.organization_id, document_type: documentType, instructions, context }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Drafting failed");
      setOutput(data.content || "");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Drafting failed"); }
    finally { setRunning(false); }
  };
  return <div className="hm-page"><PageHeader eyebrow="Drafting workspace" title="Create a first draft" copy="Give precise instructions and verified context. Missing facts remain visible for lawyer completion." action={output ? <Button variant="outline" onClick={() => navigator.clipboard.writeText(output).then(() => toast.success("Draft copied"))}>Copy draft</Button> : undefined} />
    <div className="hm-two-column"><section className="hm-panel hm-form"><label>Document type<Input value={documentType} onChange={(event) => setDocumentType(event.target.value)} /></label><label>Instructions<Textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Describe the document, parties, position and outcome required..." /></label><label>Verified context <small>Optional</small><Textarea value={context} onChange={(event) => setContext(event.target.value)} placeholder="Paste approved facts, research or clauses. Do not include credentials." /></label><Button onClick={() => void generate()} disabled={running}>{running ? <LoaderCircle className="hm-spin" /> : <Sparkles />} {running ? "Preparing draft" : "Generate draft"}</Button></section><section className="hm-panel hm-output">{output ? <MessageResponse>{output}</MessageResponse> : <EmptyState icon={FilePenLine} title="No draft yet" copy="Your generated draft will appear here with a mandatory lawyer-review marker." />}</section></div>
  </div>;
}

function ReviewPage({ session, requestSignIn }: { session: Session | null; requestSignIn: () => void }) {
  const [text, setText] = useState("");
  const [playbook, setPlaybook] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [risk, setRisk] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const review = async () => {
    if (!session) { requestSignIn(); return; }
    if (text.trim().length < 10) return toast.error("Paste contract text to review.");
    setRunning(true);
    try {
      const response = await fetch("/api/legal-ai", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "content-type": "application/json" }, body: JSON.stringify({ action: "review", organization_id: session.organization_id, text, playbook: playbook.split("\n").map((line) => line.trim()).filter(Boolean) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Review failed");
      setFindings(data.findings ?? []); setRisk(data.overallRisk ?? null);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Review failed"); }
    finally { setRunning(false); }
  };
  return <div className="hm-page"><PageHeader eyebrow="Contract review" title="Review against the text" copy="Findings are constrained to the contract and the playbook rules you provide." action={<Button onClick={() => void review()} disabled={running}>{running ? <LoaderCircle className="hm-spin" /> : <Sparkles />} {running ? "Reviewing" : "Run review"}</Button>} />
    <div className="hm-review-grid"><section className="hm-panel hm-form"><label>Contract text<Textarea className="hm-contract-input" value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste contract text here..." /></label><label>Playbook rules <small>One rule per line</small><Textarea value={playbook} onChange={(event) => setPlaybook(event.target.value)} placeholder="Example: Flag unlimited liability and identify the affected clause." /></label></section><section className="hm-findings"><header><span>Findings</span>{risk ? <StatusBadge tone={risk === "high" ? "bad" : risk === "medium" ? "warn" : "good"}>{risk} overall risk</StatusBadge> : null}</header>{findings.length ? findings.map((finding, index) => <article key={`${finding.title}-${index}`}><div><StatusBadge tone={finding.risk === "high" ? "bad" : finding.risk === "medium" ? "warn" : "neutral"}>{finding.risk}</StatusBadge><small>{finding.clauseRef || "Text-supported finding"}</small></div><h2>{finding.title}</h2><p>{finding.whyItMatters}</p>{finding.originalText ? <blockquote>{finding.originalText}</blockquote> : null}{finding.suggestedText ? <div className="hm-suggestion"><span>Suggested lawyer-review wording</span><p>{finding.suggestedText}</p></div> : null}</article>) : <EmptyState icon={ClipboardCheck} title="No findings yet" copy="Paste a contract and run review. Legal Eye will not invent example findings." />}</section></div>
  </div>;
}

function VaultPage({ session, documents, refresh, requestSignIn }: { session: Session | null; documents: VaultDocument[]; refresh: () => Promise<void>; requestSignIn: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const upload = async (file?: File) => {
    if (!file) return;
    if (!session) { requestSignIn(); return; }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const storagePath = `${session.organization_id}/${crypto.randomUUID()}/${safeName}`;
      const stored = await fetch(`${SUPABASE_URL}/storage/v1/object/firm-vault/${storagePath.split("/").map(encodeURIComponent).join("/")}`, { method: "POST", headers: { ...apiHeaders(session.access_token), "content-type": file.type || "application/octet-stream", "x-upsert": "false" }, body: file });
      if (!stored.ok) throw new Error((await stored.json().catch(() => null))?.message || "Secure upload failed");
      const created = await fetch(`${SUPABASE_URL}/rest/v1/documents`, { method: "POST", headers: { ...apiHeaders(session.access_token), "content-type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ organization_id: session.organization_id, title: file.name.replace(/\.[^.]+$/, ""), file_name: file.name, mime_type: file.type || null, storage_path: storagePath, size_bytes: file.size, status: "uploaded", jurisdiction_codes: ["TZ"], uploaded_by: session.user.id, metadata: { upload_channel: "legal-eye-web", classification: "confidential" } }) });
      const rows = await created.json();
      if (!created.ok || !rows?.[0]) throw new Error(rows?.message || "Document record could not be created");
      const queued = await fetch(`${SUPABASE_URL}/functions/v1/legal-process-document`, { method: "POST", headers: { ...apiHeaders(session.access_token), "content-type": "application/json" }, body: JSON.stringify({ document_id: rows[0].id }) });
      const job = await queued.json().catch(() => ({}));
      if (!queued.ok) throw new Error(job.error || "Document processing could not be queued");
      toast.success("Document uploaded", { description: "Malware scanning and structured extraction have been queued." });
      await refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Upload failed"); }
    finally { setUploading(false); if (input.current) input.current.value = ""; }
  };
  return <div className="hm-page"><PageHeader eyebrow="Private knowledge" title="Document vault" copy="Organization-scoped files with malware scanning, parsing and searchable extraction." action={<><input ref={input} hidden type="file" accept=".pdf,.docx,.txt" onChange={(event) => void upload(event.target.files?.[0])} /><Button onClick={() => session ? input.current?.click() : requestSignIn()} disabled={uploading}>{uploading ? <LoaderCircle className="hm-spin" /> : <Upload />} {uploading ? "Uploading" : "Upload document"}</Button></>} />
    {!session ? <EmptyState icon={LockKeyhole} title="Sign in to view private documents" copy="The vault is protected by organization and document-level access controls." action={<Button onClick={requestSignIn}>Sign in</Button>} /> : documents.length ? <div className="hm-document-list">{documents.map((document) => <article key={document.id}><span><Files /></span><div><h2>{document.title}</h2><p>{document.file_name || "Private document"} · {formatBytes(document.size_bytes)}</p></div><StatusBadge tone={document.status === "indexed" ? "good" : document.status.includes("fail") ? "bad" : "warn"}>{document.status.replaceAll("_", " ")}</StatusBadge><time>{new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(document.created_at))}</time></article>)}</div> : <EmptyState icon={FolderLock} title="Your vault is empty" copy="Upload the first real document. No demonstration files are shown." />}
  </div>;
}

function SourcesPage({ documents, policies, total, searchable }: { documents: CorpusDocument[]; policies: CorpusPolicy[]; total: number; searchable: number }) {
  return <div className="hm-page"><PageHeader eyebrow="Public legal corpus" title="Governed sources" copy="Only source records and documents actually present in the live corpus are shown." />
    <div className="hm-stats"><div><span>Catalogued documents</span><b>{total.toLocaleString()}</b></div><div><span>Searchable passages</span><b>{searchable.toLocaleString()}</b></div><div><span>Source policies</span><b>{policies.length.toLocaleString()}</b></div></div>
    <div className="hm-source-grid"><section className="hm-panel"><header className="hm-panel-title">Latest corpus records</header>{documents.length ? documents.map((document) => <article className="hm-corpus-row" key={document.id ?? document.canonical_url ?? document.title}><i>{document.jurisdiction_code}</i><div><h2>{document.title}</h2><p>{document.citation || document.document_type.replaceAll("_", " ")}</p></div>{document.canonical_url ? <Button size="sm" variant="ghost" onClick={() => window.open(document.canonical_url!, "_blank", "noopener,noreferrer")}><ArrowRight /></Button> : null}</article>) : <EmptyState icon={LibraryBig} title="No public records returned" copy="Check the source registry and public catalog permissions." />}</section><aside className="hm-panel"><header className="hm-panel-title">Source governance</header>{policies.length ? policies.map((policy) => <article className="hm-policy" key={policy.name}><div><h3>{policy.name}</h3><p>{policy.license_name || "Rights metadata pending"}</p></div><StatusBadge tone={policy.policy_state === "approved" ? "good" : "warn"}>{policy.policy_state.replaceAll("_", " ")}</StatusBadge></article>) : <EmptyState icon={ShieldCheck} title="No policies returned" copy="Source policy records will appear here when accessible." />}</aside></div>
  </div>;
}

export default function Home() {
  const [view, setView] = useState<View>("ask");
  const [mobileNav, setMobileNav] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [vault, setVault] = useState<VaultDocument[]>([]);
  const [documents, setDocuments] = useState<CorpusDocument[]>([]);
  const [policies, setPolicies] = useState<CorpusPolicy[]>([]);
  const [documentCount, setDocumentCount] = useState(0);
  const [searchableCount, setSearchableCount] = useState(0);
  const title = navigation.find(([id]) => id === view)?.[1] ?? "Ask";

  const refreshVault = useCallback(async (current: Session | null) => {
    if (!current || !SUPABASE_URL || !SUPABASE_KEY) { setVault([]); return; }
    const response = await fetch(`${SUPABASE_URL}/rest/v1/documents?select=id,title,file_name,status,created_at,size_bytes&organization_id=eq.${current.organization_id}&order=created_at.desc&limit=50`, { headers: apiHeaders(current.access_token), cache: "no-store" });
    if (response.ok) setVault(await response.json());
  }, []);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      const parsed = stored ? JSON.parse(stored) as Session : null;
      if (parsed?.access_token && parsed.organization_id) {
        const restore = window.setTimeout(() => setSession(parsed), 0);
        return () => window.clearTimeout(restore);
      }
    } catch { sessionStorage.removeItem(SESSION_KEY); }
  }, []);

  useEffect(() => {
    if (!session) return;
    const refresh = window.setTimeout(() => void refreshVault(session), 0);
    return () => window.clearTimeout(refresh);
  }, [session, refreshVault]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen((open) => !open); }
    };
    document.addEventListener("keydown", keydown);
    if (!SUPABASE_URL || !SUPABASE_KEY) return () => document.removeEventListener("keydown", keydown);
    const headers = { ...apiHeaders(), Prefer: "count=exact" };
    const count = (path: string) => fetch(`${SUPABASE_URL}${path}`, { method: "HEAD", headers, cache: "no-store" }).then((response) => Number(response.headers.get("content-range")?.split("/")[1] || 0));
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/legal_documents?select=id,title,citation,published_at,canonical_url,jurisdiction_code,document_type&order=published_at.desc.nullslast&limit=20`, { headers, cache: "no-store" }),
      fetch(`${SUPABASE_URL}/rest/v1/source_registry?select=name,jurisdiction_code,policy_state,last_synced_at,license_name&order=name&limit=20`, { headers, cache: "no-store" }),
      count("/rest/v1/legal_documents?select=id"),
      count("/rest/v1/legal_document_chunks?select=id"),
    ]).then(async ([documentResponse, policyResponse, total, searchable]) => {
      if ((documentResponse as Response).ok) setDocuments(await (documentResponse as Response).json());
      if ((policyResponse as Response).ok) setPolicies(await (policyResponse as Response).json());
      setDocumentCount(total as number); setSearchableCount(searchable as number);
    }).catch(() => undefined);
    return () => document.removeEventListener("keydown", keydown);
  }, []);

  const signIn = async () => {
    if (!SUPABASE_URL || !SUPABASE_KEY) return toast.error("Supabase configuration is missing.");
    setSigningIn(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: SUPABASE_KEY, "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error_description || data.msg || "Sign in failed");
      const membership = await fetch(`${SUPABASE_URL}/rest/v1/organization_members?select=role,organization_id&user_id=eq.${data.user.id}&is_active=is.true&limit=1`, { headers: apiHeaders(data.access_token), cache: "no-store" });
      const memberships = membership.ok ? await membership.json() : [];
      if (!memberships[0]?.organization_id) throw new Error("No active organization membership was found.");
      const next: Session = { access_token: data.access_token, user: data.user, role: memberships[0].role || "member", organization_id: memberships[0].organization_id };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(next)); setSession(next); setPassword(""); setAuthOpen(false); toast.success("Secure workspace connected");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Sign in failed"); }
    finally { setSigningIn(false); }
  };

  const signOut = () => { sessionStorage.removeItem(SESSION_KEY); setSession(null); setVault([]); setAuthOpen(false); toast("Signed out"); };
  const go = (next: View) => { setView(next); setCommandOpen(false); setMobileNav(false); };
  const content = view === "ask" ? <AskPage session={session} requestSignIn={() => setAuthOpen(true)} /> : view === "draft" ? <DraftPage session={session} requestSignIn={() => setAuthOpen(true)} /> : view === "review" ? <ReviewPage session={session} requestSignIn={() => setAuthOpen(true)} /> : view === "vault" ? <VaultPage session={session} documents={vault} refresh={() => refreshVault(session)} requestSignIn={() => setAuthOpen(true)} /> : <SourcesPage documents={documents} policies={policies} total={documentCount} searchable={searchableCount} />;

  return <div className="hm-shell">
    <aside className={`hm-sidebar ${mobileNav ? "open" : ""}`}><header><span>LE</span><div><b>Legal Eye</b><small>Legal intelligence</small></div><button className="hm-mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X /></button></header><nav><span>Workspace</span>{navigation.map(([id, label, Icon]) => <button key={id} className={view === id ? "active" : ""} onClick={() => go(id)}><Icon /><span>{label}</span>{view === id ? <i /> : null}</button>)}</nav><footer><button onClick={() => setAuthOpen(true)}><i>{session?.user.email?.slice(0, 2).toUpperCase() || "IN"}</i><span><b>{session?.user.email || "Secure workspace"}</b><small>{session ? `${session.role} · connected` : "Sign in to continue"}</small></span><ChevronRight /></button></footer></aside>
    <section className="hm-main"><header className="hm-topbar"><button className="hm-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu /></button><div><span>Legal Eye</span><ChevronRight /><b>{title}</b></div><div><StatusBadge tone="good"><i className="hm-live-dot" /> Live corpus</StatusBadge><Button variant="outline" size="sm" onClick={() => setCommandOpen(true)}><CommandIcon /> Search <kbd>Ctrl K</kbd></Button></div></header><main>{content}</main><footer className="hm-system"><span><ShieldCheck /> Governed retrieval</span><span>{documentCount.toLocaleString()} public records · {searchableCount.toLocaleString()} searchable passages</span><span>{session ? "Private workspace connected" : "Public corpus mode"}</span></footer></section>
    {mobileNav ? <button className="hm-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation" /> : null}
    <Dialog open={commandOpen} onOpenChange={setCommandOpen}><DialogContent className="hm-command"><DialogHeader><DialogTitle>Go to workspace</DialogTitle><DialogDescription>Open a working Legal Eye capability.</DialogDescription></DialogHeader>{navigation.map(([id, label, Icon]) => <button key={id} onClick={() => go(id)}><Icon /><span>{label}</span><kbd>Enter</kbd></button>)}</DialogContent></Dialog>
    <Dialog open={authOpen} onOpenChange={setAuthOpen}><DialogContent><DialogHeader><DialogTitle>{session ? "Secure workspace" : "Sign in to Legal Eye"}</DialogTitle><DialogDescription>{session ? "Your organization-scoped session is active in this browser tab." : "Use credentials issued by your Legal Eye organization administrator."}</DialogDescription></DialogHeader>{session ? <div className="hm-session"><ShieldCheck /><div><b>{session.user.email}</b><span>{session.role} · organization access active</span></div><Button variant="outline" onClick={signOut}><LogOut /> Sign out</Button></div> : <div className="hm-login"><label>Email<Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" /></label><label>Password<Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void signIn()} autoComplete="current-password" /></label><Button onClick={() => void signIn()} disabled={signingIn || !email || !password}>{signingIn ? <LoaderCircle className="hm-spin" /> : <LockKeyhole />} {signingIn ? "Signing in" : "Sign in securely"}</Button></div>}</DialogContent></Dialog>
    <Toaster position="bottom-right" richColors />
  </div>;
}
