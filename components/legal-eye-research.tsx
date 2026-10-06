"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowUpRight, BookOpen, Check, ChevronDown, Clock3, Download, FileText, Globe2, LoaderCircle, MessageSquareText, Plus, Search, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { action, downloadText, workspace, type Identity } from "@/lib/legal/client";
import { LegalAnswer } from "./legal-answer";

export const JURISDICTIONS = [["TZ", "Tanzania"], ["KE", "Kenya"], ["UG", "Uganda"], ["RW", "Rwanda"], ["ZA", "South Africa"], ["UK", "United Kingdom"], ["EU", "European Union"], ["CA", "Canada"], ["AU", "Australia"], ["US", "United States"]];
type Evidence = { label: string; chunk_id?: number; legal_document_id?: string; document_id?: string; title: string; citation?: string; content: string; canonical_url?: string; court?: string; jurisdiction_code?: string; page_number?: number; paragraph_number?: string; source_kind?: string };
type Treatment={target_citation:string;treatment:string;judgment_citation:string;court:string;evidence_quote:string;reviewed_at:string};
type Citator={entries:Treatment[];coverage:string;absence_means:string;current_good_law_verified:boolean};
type Turn = { firmCitator?:Citator; question: string; answer: string; evidence: Evidence[]; created_at: string };
type Session = { id: string; title: string; query: string; answer_markdown: string; jurisdiction_codes: string[]; matter_id?: string | null; metadata: { turns?: Turn[]; evidence?: Evidence[] }; updated_at: string; use_firm_knowledge?:boolean };
type Props = { identity: Identity | null; connect: () => void; initialQuery: string; autoRun: number; sessionId: string | null; onSession: (id: string) => void; onScope:(matterId:string|null)=>void; jurisdictions: string[]; setJurisdictions: (values: string[]) => void; matterId: string | null; privateContext: boolean };

export function ResearchLive({ identity, connect, initialQuery, autoRun, sessionId, onSession, onScope, jurisdictions, setJurisdictions, matterId, privateContext }: Props) {
  const [question, setQuestion] = useState(initialQuery), [turns, setTurns] = useState<Turn[]>([]), [history, setHistory] = useState<Session[]>([]), [search, setSearch] = useState("");
  const [historyOpen,setHistoryOpen]=useState(false),[scope,setScope]=useState({matterId,privateContext});
  const [loadingSession, setLoadingSession] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [selected, setSelected] = useState<Evidence | null>(null), [saved, setSaved] = useState(true), [saving, setSaving] = useState(false);
  const seen = useRef(0), currentSession = useRef(sessionId), loadedSession = useRef<string | null>(null), inFlight = useRef(false);
  const latest = turns.at(-1);
  const loadHistory = async () => { if (identity) setHistory(await workspace<Session[]>(identity, `research_sessions?select=id,title,query,answer_markdown,jurisdiction_codes,matter_id,use_firm_knowledge,metadata,updated_at&organization_id=eq.${identity.organization_id}${matterId?`&matter_id=eq.${matterId}`:""}&order=updated_at.desc&limit=60`)); };
  useEffect(() => { void loadHistory().catch(() => undefined); }, [identity,matterId]);
  useEffect(() => {
    if (!identity || !sessionId || loadedSession.current === sessionId || inFlight.current) return;
    let cancelled = false;
    setLoadingSession(true); setError("");
    currentSession.current = sessionId;
    void workspace<Session[]>(identity, `research_sessions?select=id,title,query,answer_markdown,jurisdiction_codes,matter_id,use_firm_knowledge,metadata,updated_at&id=eq.${sessionId}&organization_id=eq.${identity.organization_id}`).then(rows => {
      if (cancelled) return;
      if (!rows[0]) throw new Error("This research session is unavailable.");
      const row = rows[0]; loadedSession.current = row.id;setScope({matterId:row.matter_id||null,privateContext:row.use_firm_knowledge??true});onScope(row.matter_id||null);setSelected(null);
      setTurns(row.metadata?.turns || [{ question: row.query, answer: row.answer_markdown, evidence: row.metadata?.evidence || [], created_at: row.updated_at }]);
      setJurisdictions(row.jurisdiction_codes || ["TZ"]); setQuestion(""); setSaved(true);
    }).catch(e => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setLoadingSession(false); });
    return () => { cancelled = true; };
  }, [sessionId, identity]);
  const persist = async (next: Turn[]) => {
    if (!identity || !next.length) return;
    setSaving(true);
    try {
      const body = { title: next[0].question.slice(0, 160), query: next[0].question, jurisdiction_codes: jurisdictions, matter_id: scope.matterId, mode: "deep", use_firm_knowledge: scope.privateContext, status: "complete", answer_markdown: next.at(-1)!.answer, metadata: { turns: next, evidence: next.at(-1)!.evidence }, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const rows = await workspace<Session[]>(identity, currentSession.current ? `research_sessions?id=eq.${currentSession.current}&organization_id=eq.${identity.organization_id}` : "research_sessions", { method: currentSession.current ? "PATCH" : "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(currentSession.current ? body : { ...body, organization_id: identity.organization_id, created_by: identity.user.id }) });
      if (!rows[0]) throw new Error("The answer is available, but your session could not be saved.");
      currentSession.current = rows[0].id; loadedSession.current = rows[0].id; onSession(rows[0].id); setSaved(true); setError(""); await loadHistory();
    } finally { setSaving(false); }
  };
  const run = async (value = question) => {
    if (!identity) return connect();
    if (inFlight.current || loadingSession || (sessionId && loadedSession.current !== sessionId) || value.trim().length < 3) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const result = await action<{ answer: string; publicEvidence: Evidence[]; privateEvidence: Evidence[]; firmCitator?:Citator }>(identity, "/api/legal-ai", { action: "research", query: value.trim(), jurisdictions, matter_id: scope.matterId, use_firm_knowledge: scope.privateContext, conversation: turns.slice(-4).map(t => ({ question: t.question, answer: t.answer.slice(0, 6000) })) });
      if (!result.answer) throw new Error("No answer was returned. Please try again.");
      const evidence = [...(result.publicEvidence || []).map((e, i) => ({ ...e, label: `P${i + 1}` })), ...(result.privateEvidence || []).map((e, i) => ({ ...e, label: `F${i + 1}` }))];
      const next = [...turns, { question: value.trim(), answer: result.answer, evidence, firmCitator:result.firmCitator, created_at: new Date().toISOString() }];
      setTurns(next); setQuestion(""); setSaved(false); setSelected(evidence[0] || null);
      await persist(next).catch(e => setError(`Answer generated. Save failed: ${e.message}`));
    } catch (e) { setError(e instanceof Error ? e.message : "Research failed. Your question has been kept."); }
    finally { setBusy(false); inFlight.current = false; }
  };
  useEffect(() => { if (autoRun > seen.current && initialQuery.trim() && identity && !sessionId) { seen.current = autoRun; void run(initialQuery); } }, [autoRun, identity]);
  const exportResearch = () => downloadText("legal-eye-research.md", turns.map(t => `# ${t.question}\n\n${t.answer}\n\n## Evidence\n\n${t.evidence.map(e => `[${e.label}] ${e.title}\n${e.citation || ""}\n${e.canonical_url || "Private workspace document"}\n${e.page_number ? `Page ${e.page_number}\n` : ""}\n> ${e.content.replaceAll("\n", "\n> ")}`).join("\n\n")}`).join("\n\n---\n\n"), "text/markdown;charset=utf-8");
  return <div className="research-workspace">
    <aside className={"research-history "+(historyOpen?"history-open":"")}><div className="pane-heading"><h2>Research</h2><Button className="history-toggle" variant="ghost" aria-label="Close research history" onClick={() => setHistoryOpen(false)}><X size={16}/></Button></div><Input aria-label="Search research history" placeholder="Search history…" value={search} onChange={e => setSearch(e.target.value)}/><div className="history-items">{history.filter(h => h.title.toLowerCase().includes(search.toLowerCase())).map(h => <button key={h.id} className={currentSession.current === h.id ? "active" : ""} disabled={busy || saving} onClick={() => { if (!saved && !window.confirm("Leave this unsaved research answer?")) return; onSession(h.id);setHistoryOpen(false); }}><MessageSquareText size={16}/><span>{h.title}<small>{new Date(h.updated_at).toLocaleDateString()}</small></span></button>)}</div>{!history.length && <p className="helper">Your saved research will appear here.</p>}</aside>
    <section className="research-thread"><div className="pane-heading"><Button className="history-toggle" variant="ghost" onClick={()=>setHistoryOpen(!historyOpen)}><Clock3 size={16}/> History</Button><span><Globe2 size={16}/> {jurisdictions.join(" · ") || "All jurisdictions"}</span><div className="row">{turns.length > 0 && <><span className="save-state">{saving ? "Saving…" : saved ? "Saved" : "Unsaved"}</span>{!saved && <Button variant="outline" disabled={saving || busy || loadingSession} onClick={() => void persist(turns).catch(e => setError(e.message))}>Retry save</Button>}<Button variant="ghost" onClick={exportResearch} aria-label="Export research"><Download size={16}/></Button></>}</div></div>
      <div className="thread-content">{loadingSession && <p role="status">Loading saved research…</p>}{!turns.length && !busy ? <div className="quiet-empty"><Search/><h1>Follow the evidence.</h1><p>Ask a precise legal question. Open any citation to inspect its source passage.</p>{!identity && <Button onClick={connect}>Sign in to research</Button>}</div> : turns.map((turn, i) => <article className="research-turn" key={turn.created_at}><h1>{turn.question}</h1><div className="answer-label"><ShieldCheck size={15}/> LOCKE <span>·</span> {turn.evidence.length} source passages</div><LegalAnswer text={turn.answer} onCitation={label => setSelected(turn.evidence.find(e => e.label === label) || null)}/>{turn.firmCitator&&<div className="workspace-tip"><div><b>Authority treatment · firm evidence</b><p>{turn.firmCitator.coverage}. No result means treatment is unknown. Current good-law status is not certified. This is a research-time snapshot; recheck Trust before relying on it.</p>{turn.firmCitator.entries.map((e,index)=><article key={index}><b>{e.target_citation} — {e.treatment.replaceAll("_"," ")}</b><p>{e.judgment_citation} · {e.court} · reviewed {e.reviewed_at}</p><blockquote>{e.evidence_quote}</blockquote></article>)}</div></div>}{turn.evidence.length > 0 && <div className="evidence-shelf">{turn.evidence.map(e => <button key={e.label} onClick={() => setSelected(e)}><span>{e.label}</span><b>{e.title}</b><small>{e.page_number ? `Page ${e.page_number}` : e.jurisdiction_code || "Firm document"}</small></button>)}</div>}{i < turns.length - 1 && <hr/>}</article>)}{busy && <div className="research-progress" role="status"><LoaderCircle className="spin"/><div><b>Researching your question</b><p>Searching sources and preparing an evidence-based answer.</p></div></div>}{error && <div className="inline-error" role="alert">{error}</div>}</div>
      <form className="followup-composer" onSubmit={e => { e.preventDefault(); void run(); }}><textarea aria-label="Research question" placeholder={latest ? "Ask a follow-up question…" : "What do you want to understand?"} value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void run(); } }}/><Button type="submit" disabled={busy || loadingSession || (Boolean(sessionId) && loadedSession.current !== sessionId) || question.trim().length < 3} aria-label="Send research question"><ArrowUp/></Button></form>
    </section>
    {selected && <aside className="evidence-panel"><div className="pane-heading"><span><BookOpen size={16}/> Source {selected.label}</span><Button variant="ghost" aria-label="Close source" onClick={() => setSelected(null)}><X/></Button></div><div className="evidence-panel-body"><span className="eyebrow">{selected.court || selected.jurisdiction_code || "Private firm knowledge"}</span><h2>{selected.title}</h2><p>{selected.citation}</p><div className="evidence-locator">{selected.page_number ? `Page ${selected.page_number}` : "Source passage"}{selected.paragraph_number && ` · ¶ ${selected.paragraph_number}`}</div><blockquote>{selected.content}</blockquote>{selected.canonical_url && /^https?:\/\//.test(selected.canonical_url) && <a className="source-original" href={selected.canonical_url} target="_blank" rel="noopener noreferrer">Open original source <ArrowUpRight size={16}/></a>}<p className="helper">Check the complete document, effective date, and authority treatment before relying on this passage.</p><Button variant="outline" onClick={() => void navigator.clipboard.writeText(`${selected.title}\n${selected.citation || ""}\n${selected.content}`).then(() => toast.success("Passage copied")).catch(() => toast.error("Could not copy passage"))}>Copy passage</Button></div></aside>}
  </div>;
}

type HomeProps = { identity: Identity | null; go: (question: string) => void; navigate: (view: string) => void; openSession: (id: string) => void; jurisdictions: string[]; setJurisdictions: (values: string[]) => void; privateContext: boolean; setPrivateContext: (value: boolean) => void };
export function ResearchHome({ identity, go, navigate, openSession, jurisdictions, setJurisdictions, privateContext, setPrivateContext }: HomeProps) {
  const [question, setQuestion] = useState(""), [filters, setFilters] = useState(false), [recent, setRecent] = useState<Session[]>([]);
  useEffect(() => { if (!identity) return setRecent([]); void workspace<Session[]>(identity, `research_sessions?select=id,title,updated_at&organization_id=eq.${identity.organization_id}&order=updated_at.desc&limit=6`).then(setRecent).catch(() => undefined); }, [identity]);
  return <div className="cathedral-home">
    <section className="home-hero"><div className="home-hero-core">
      <div className="home-hero-brand"><ShieldCheck size={16}/><span>Your legal workspace</span></div>
      <h1>What are we working on?</h1>
      <p className="home-subtitle">Research authority. Review agreements. Build work you can stand behind.</p>
        <form className="home-composer" onSubmit={e => { e.preventDefault(); go(question); }}>
          <label className="sr-only" htmlFor="legal-question">Ask a legal question</label>
          <textarea id="legal-question" placeholder="Ask a legal question…" value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(question); } }}/>
          <div className="composer-controls">
            <button type="button" aria-label="Upload private documents in Vault" title="Upload documents in Vault" onClick={() => navigate("vault")}><Plus/></button>
            <button type="button" onClick={() => setFilters(!filters)}><BookOpen size={16}/> {jurisdictions.length === 1 ? JURISDICTIONS.find(j => j[0] === jurisdictions[0])?.[1] : `${jurisdictions.length} jurisdictions`}<ChevronDown size={13}/></button>
            <button type="button" className={privateContext ? "context-active" : ""} onClick={() => setPrivateContext(!privateContext)}><ShieldCheck size={15}/>{privateContext ? "Firm + law" : "Public law"}</button>
            <span className="composer-spacer"/>
            <button type="button" onClick={() => setFilters(!filters)} aria-expanded={filters}><SlidersHorizontal size={16}/><span className="filter-label">Filter</span></button>
            <Button type="submit" aria-label="Ask LOCKE" disabled={question.trim().length < 3}><ArrowUp/></Button>
          </div>
          {filters && <div className="jurisdiction-picker"><span>Research jurisdictions</span>{JURISDICTIONS.map(([code, name]) => <label key={code}><input type="checkbox" checked={jurisdictions.includes(code)} onChange={e => setJurisdictions(e.target.checked ? [...jurisdictions, code] : jurisdictions.filter(j => j !== code).length ? jurisdictions.filter(j => j !== code) : [code])}/>{name}</label>)}<p>Coverage varies by source. Answers identify gaps in the retrieved evidence.</p></div>}
        </form>
        <div className="question-examples">{["Find controlling Tanzanian authority", "Compare directors’ duties: TZ vs UK", "Review a confidentiality clause"].map(q => <button key={q} onClick={() => setQuestion(q)}>{q}</button>)}</div>
    </div></section>
    <div className="desk-heading"><h2>Start with a task</h2><span>From evidence to work product</span></div>
    <div className="desk-cards">{[
      {view:"review",title:"Review an agreement",detail:"Find risks and inspect the original clauses.",Icon:ShieldCheck},
      {view:"draft",title:"Draft a document",detail:"Write, refine and save a versioned work product.",Icon:FileText},
      {view:"tables",title:"Compare documents",detail:"Extract key terms into a sourced comparison.",Icon:BookOpen},
      {view:"workflows",title:"Run a firm process",detail:"Reuse a workflow with lawyer checkpoints.",Icon:Clock3},
    ].map(({view,title,detail,Icon})=><button className="desk-card" key={view} onClick={()=>navigate(view)}><Icon/><b>{title}</b><p>{detail}</p><ArrowUpRight/></button>)}</div>
    <section className="desk-continue"><div className="desk-heading"><h2>Continue your research</h2><span>Saved to your firm</span></div>
      {recent.length ? <div className="recent-research">{recent.map(r => <button key={r.id} onClick={() => openSession(r.id)}><MessageSquareText size={16}/><b>{r.title}</b><time>{new Date(r.updated_at).toLocaleDateString()}</time><ArrowUpRight size={14}/></button>)}</div> : <p className="home-empty">{identity ? "Start a question above. Your saved research will appear here." : "Sign in to save research and work with private firm documents."}</p>}
    </section>
    <div className="desk-integrations"><a href="/?view=vault"><FileText size={14}/> Private document vault <ArrowUpRight size={12}/></a><a href="/office/word">LOCKE for Word <ArrowUpRight size={12}/></a><a href="/office/outlook">LOCKE for Outlook <ArrowUpRight size={12}/></a><a href="/?view=trust"><ShieldCheck size={14}/> Sources and governance <ArrowUpRight size={12}/></a></div>
  </div>;
}
export function LockeMark() { return <svg viewBox="0 0 32 32" width="28" height="28" fill="none" aria-hidden="true"><rect x="4.5" y="4.5" width="23" height="23" rx="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M11 9.5V22H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
export function EyeMark() { return <LockeMark/>; }
