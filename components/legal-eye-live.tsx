"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, Bot, Check, ChevronRight, ClipboardCheck, Download, FileText, FolderLock,
  Globe2, ListChecks, LockKeyhole, Play, Plus, RefreshCw, Search, ShieldCheck, Sparkles,
  Table2, Users, Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {downloadDocx} from "@/lib/legal/docx";

export type LiveIdentity = { access_token: string; user: { id: string; email?: string }; role: string; organization_id: string };
export type LiveVaultDocument = { id: string; title: string; file_name: string | null; status: string; created_at: string; size_bytes: number | null };
export type LiveCorpusDocument = { title: string; citation: string | null; published_at: string | null; canonical_url: string | null; jurisdiction_code: string; document_type: string };
export type LiveCorpusStats = { TZ: number; UK: number; EU: number; searchable: number | null };

type CommonProps = { identity: LiveIdentity | null; connect: () => void };
type Matter = { id: string; name: string; client_name: string | null; description: string | null; status: string; practice_area: string | null; jurisdiction_codes: string[]; created_at: string };
type Skill = { id: string; name: string; description: string | null; instructions: string; trigger_phrase: string | null; is_active: boolean; updated_at: string };
type ReviewTable = { id: string; name: string; description: string | null; columns: ExtractionColumn[]; updated_at: string };
type ReviewRow = { id: string; document_id: string | null; position: number; values: Record<string, ExtractedValue | string>; review_status: string; locked_fields: string[] };
type ExtractionColumn = { key: string; label: string; prompt: string };
type ExtractedValue = { value: string; source_quote?: string | null; page?: number | null; confidence?: number };
type Checklist = { id: string; name: string; description: string | null; matter_id: string | null; updated_at: string };
type ChecklistItem = { due_date?:string|null;assignee_id?:string|null;id: string; title: string; source_clause: string | null; source_page: number | null; status: "pending" | "in_progress" | "complete" | "blocked"; priority: string; category: string | null; notes: string | null };
type WorkflowRecord = { id: string; name: string; description: string | null; natural_language_spec: string | null; version: number; status: string; updated_at: string };
type WorkflowNode = { id: string; node_key: string; node_type: string; configuration: { title?: string; instructions?: string }; position: Record<string, unknown> };
type AgentRun = { id: string; objective: string; status: string; plan: AgentStep[]; result: { executive_summary?: string; deliverable?: string; uncertainties?: string[] } | null; created_at: string };
type AgentStep = { step: number; title: string; status: "complete" | "needs_review" | "blocked"; detail: string };
type Monitor = { id: string; name: string; monitor_type: string; jurisdiction_codes: string[]; topic_query: string | null; status: string; updated_at: string };
type MonitorEvent = { id: string; monitor_id: string; title: string; source_url: string | null; change_kind: string | null; summary: string | null; status: string; detected_at: string };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

function LiveHeader({ title, meta, action }: { title: string; meta: string; action?: React.ReactNode }) {
  return <div className="section-header"><div><h1>{title}</h1><p>{meta}</p></div>{action}</div>;
}

function tone(value: string) {
  if (["complete", "ready", "active", "low"].includes(value)) return "tone-green";
  if (["high", "blocked", "failed"].includes(value)) return "tone-red";
  if (["running", "in_progress", "needs_review", "testing"].includes(value)) return "tone-blue";
  return "tone-amber";
}

function Status({ value }: { value: string }) {
  return <Badge className={`tone-badge ${tone(value)}`}>{value.replaceAll("_", " ")}</Badge>;
}

function authHeaders(identity: LiveIdentity, extra: Record<string, string> = {}) {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${identity.access_token}`, ...extra };
}

async function rest<T>(identity: LiveIdentity, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: authHeaders(identity, init.headers as Record<string, string> || {}),
    cache: "no-store",
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(body?.message || body?.hint || `Workspace request failed (${response.status})`);
  return body as T;
}

async function legalWork<T>(identity: LiveIdentity, body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/legal-work", {
    method: "POST",
    headers: { Authorization: `Bearer ${identity.access_token}`, "content-type": "application/json" },
    body: JSON.stringify({ ...body, organization_id: identity.organization_id }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Legal work request failed");
  return payload as T;
}

function SecureEmpty({ identity, connect, title, copy }: CommonProps & { title: string; copy: string }) {
  return <div className="empty-live"><LockKeyhole/><h2>{identity ? title : "Secure workspace required"}</h2><p>{identity ? copy : "Sign in to your organization to use this workspace."}</p>{!identity ? <Button onClick={connect}><ShieldCheck/> Sign in</Button> : null}</div>;
}

export function MattersLive({ identity, connect }: CommonProps) {
  const [items, setItems] = useState<Matter[]>([]), [name, setName] = useState(""), [client, setClient] = useState(""), [practice, setPractice] = useState("Corporate / M&A"), [busy, setBusy] = useState(false);
  const load = async () => {
    if (!identity) return setItems([]);
    try { setItems(await rest<Matter[]>(identity, `matters?select=id,name,client_name,description,status,practice_area,jurisdiction_codes,created_at&organization_id=eq.${identity.organization_id}&order=updated_at.desc`)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Matters could not be loaded"); }
  };
  useEffect(() => { void load(); }, [identity]);
  const create = async () => {
    if (!identity) return connect();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await rest(identity, "matters", { method: "POST", headers: { "content-type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ organization_id: identity.organization_id, name: name.trim(), client_name: client.trim() || null, practice_area: practice.trim() || null, jurisdiction_codes: ["TZ"], created_by: identity.user.id, status: "active" }) });
      setName(""); setClient(""); toast.success("Matter created"); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Matter could not be created"); } finally { setBusy(false); }
  };
  return <div className="view-pad"><LiveHeader title="Matters" meta="Secure legal contexts connecting people, documents, research, reviews and agents." action={<Button variant="outline" onClick={() => void load()} disabled={!identity}><RefreshCw/> Refresh</Button>}/>
    {!identity ? <SecureEmpty identity={identity} connect={connect} title="No matters yet" copy="Create your first matter."/> : <>
      <div className="live-create-bar"><Input placeholder="Matter name" value={name} onChange={e => setName(e.target.value)}/><Input placeholder="Client" value={client} onChange={e => setClient(e.target.value)}/><Input placeholder="Practice area" value={practice} onChange={e => setPractice(e.target.value)}/><Button onClick={create} disabled={busy || !name.trim()}><Plus/> {busy ? "Creating…" : "New matter"}</Button></div>
      <div className="matter-grid live-grid">{items.length ? items.map((item, index) => <article className="live-card" key={item.id}><i>{String(index + 1).padStart(2, "0")}</i><div><Status value={item.status}/><h2>{item.name}</h2><p>{item.client_name || "No client set"} · {item.practice_area || "General"}</p><small><Globe2/> {(item.jurisdiction_codes || ["TZ"]).join(" · ")} <Users/> Matter workspace</small></div><ChevronRight/></article>) : <SecureEmpty identity={identity} connect={connect} title="No matters yet" copy="Create your first live matter above. No sample matters are shown."/>}</div>
    </>}
  </div>;
}

export function SkillsLive({ identity, connect, documents }: CommonProps & { documents: LiveVaultDocument[] }) {
  const readyDocuments = documents.filter(d => d.status === "ready");
  const [skills, setSkills] = useState<Skill[]>([]), [selected, setSelected] = useState<string | null>(null), [selectedDocument, setSelectedDocument] = useState(""), [name, setName] = useState("NDA Review"), [instructions, setInstructions] = useState("Identify confidentiality scope, exclusions, permitted disclosure, term, remedies, governing law and unusual risk. Do not invent missing clauses."), [objective, setObjective] = useState("Apply this skill to the selected private document."), [result, setResult] = useState(""), [busy, setBusy] = useState(false);
  const load = async () => { if (!identity) return setSkills([]); try { const rows = await rest<Skill[]>(identity, `workflow_skills?select=id,name,description,instructions,trigger_phrase,is_active,updated_at&organization_id=eq.${identity.organization_id}&order=updated_at.desc`); setSkills(rows); if (!selected && rows[0]) setSelected(rows[0].id); } catch (error) { toast.error(error instanceof Error ? error.message : "Skills could not be loaded"); } };
  useEffect(() => { void load(); }, [identity]);
  const current = skills.find(s => s.id === selected);
  useEffect(() => { if (current) { setName(current.name); setInstructions(current.instructions); } }, [selected, skills]);
  useEffect(() => { if (!selectedDocument && readyDocuments[0]) setSelectedDocument(readyDocuments[0].id); }, [documents, selectedDocument]);
  const save = async () => {
    if (!identity) return connect(); setBusy(true);
    try {
      if (current) await rest(identity, `workflow_skills?id=eq.${current.id}`, { method: "PATCH", headers: { "content-type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ name, instructions, description: "Reusable firm legal skill", updated_at: new Date().toISOString() }) });
      else await rest(identity, "workflow_skills", { method: "POST", headers: { "content-type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ organization_id: identity.organization_id, name, instructions, description: "Reusable firm legal skill", trigger_phrase: name.toLowerCase(), created_by: identity.user.id, tool_policy: { public_research: true, private_knowledge: true, lawyer_checkpoint: true }, is_active: true }) });
      toast.success("Skill saved"); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Skill could not be saved"); } finally { setBusy(false); }
  };
  const run = async () => {
    if (!identity) return connect(); if (!instructions.trim()) return; setBusy(true); setResult("");
    try {
      const data = await legalWork<{ executive_summary: string; deliverable: string }>(identity, { action: "run_agent", objective, skill_instructions: instructions, document_ids: selectedDocument ? [selectedDocument] : [] });
      setResult(`${data.executive_summary}\n\n${data.deliverable}`); toast.success("Skill run completed");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Skill run failed"); } finally { setBusy(false); }
  };
  return <div className="view-pad"><LiveHeader title="Skills" meta="Save firm instructions and run them again." action={<Button onClick={() => { setSelected(null); setName("New legal skill"); setInstructions(""); }} disabled={!identity}><Plus/> New skill</Button>}/><div className="workspace-tip"><FileText/><span><b>Need a document?</b> Upload it in <a href="/?view=vault">Vault</a>, wait until it is <strong>Ready</strong>, then select it below.</span></div>
    {!identity ? <SecureEmpty identity={identity} connect={connect} title="No skills yet" copy="Create your first reusable skill."/> : <div className="skills-grid"><div className="skill-list">{skills.map(s => <button className={selected === s.id ? "active" : ""} key={s.id} onClick={() => setSelected(s.id)}><i><Sparkles/></i><span><b>{s.name}</b><small>{s.description || "Firm legal skill"}</small></span><ChevronRight/></button>)}</div><section className="skill-detail"><div className="skill-head"><div><span className="eyebrow">Firm skill</span><Input value={name} onChange={e => setName(e.target.value)}/><p>Instructions, permissions and lawyer checkpoints stay inside your organization.</p></div><div className="row"><Button variant="outline" onClick={save} disabled={busy || !name.trim() || !instructions.trim()}>Save</Button><Button onClick={run} disabled={busy || !instructions.trim()}><Play/> Run</Button></div></div><div className="instructions"><label className="skill-document-picker"><span>Private document</span><select value={selectedDocument} onChange={e=>setSelectedDocument(e.target.value)}><option value="">No private document</option>{readyDocuments.map(doc=><option value={doc.id} key={doc.id}>{doc.title}</option>)}</select></label><Textarea value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Define the firm's rules, fallback positions and output requirements…"/><Input value={objective} onChange={e => setObjective(e.target.value)} placeholder="Objective for this run"/>{result ? <div className="agent-result"><span className="eyebrow">Latest run</span><pre>{result}</pre></div> : null}</div></section></div>}
  </div>;
}

const DEFAULT_COLUMNS: ExtractionColumn[] = [
  { key: "governing_law", label: "Governing law", prompt: "Identify the governing law exactly as stated." },
  { key: "change_of_control", label: "Change of control", prompt: "State the change-of-control consent, notice or restriction position." },
  { key: "termination", label: "Termination", prompt: "Summarize termination rights, notice and triggers." },
];

export function TablesLive({ identity, connect, documents }: CommonProps & { documents: LiveVaultDocument[] }) {
  const ready = documents.filter(d => d.status === "ready");
  const [picked, setPicked] = useState<string[]>([]), [columns, setColumns] = useState<ExtractionColumn[]>(DEFAULT_COLUMNS), [newColumn, setNewColumn] = useState(""), [table, setTable] = useState<ReviewTable | null>(null), [rows, setRows] = useState<ReviewRow[]>([]), [busy, setBusy] = useState(false);
  const [savedTables,setSavedTables]=useState<ReviewTable[]>([]),[selectedTable,setSelectedTable]=useState(""),[filter,setFilter]=useState("");
  const load = async (id=selectedTable) => {
    if (!identity) return;
    try {
      const tables = await rest<ReviewTable[]>(identity, `review_tables?select=id,name,description,columns,updated_at&organization_id=eq.${identity.organization_id}&order=updated_at.desc&limit=100`);
      setSavedTables(tables);const active=tables.find(t=>t.id===id)||tables[0];setTable(active||null);setSelectedTable(active?.id||""); if (active) { setColumns(Array.isArray(active.columns) ? active.columns : DEFAULT_COLUMNS); setRows(await rest<ReviewRow[]>(identity, `review_table_rows?select=id,document_id,position,values,review_status,locked_fields&review_table_id=eq.${active.id}&order=position.asc`)); }
    } catch (error) { toast.error(error instanceof Error ? error.message : "Tabular review could not be loaded"); }
  };
  useEffect(() => { void load(); }, [identity]);
  const addColumn = () => { const label = newColumn.trim(); if (!label) return; const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); setColumns(prev => [...prev, { key: `${key}_${prev.length + 1}`, label, prompt: `Extract ${label} from the document and cite the source text.` }]); setNewColumn(""); };
  const build = async () => {
    if (!identity) return connect(); if (!picked.length) return toast.error("Select at least one processed private document."); setBusy(true);
    try {
      const data = await legalWork<{ rows: Array<{ document_id: string; values: Array<ExtractedValue & { key: string }> }> }>(identity, { action: "extract_table", document_ids: picked, columns });
      const created = await rest<ReviewTable[]>(identity, "review_tables", { method: "POST", headers: { "content-type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ organization_id: identity.organization_id, name: `Due diligence review · ${new Date().toLocaleDateString()}`, description: `${picked.length} private documents`, columns, created_by: identity.user.id }) });
      const reviewTable = created[0];
      const rowPayload = data.rows.map((row, index) => ({ review_table_id: reviewTable.id, document_id: row.document_id, position: index, values: Object.fromEntries(row.values.map(value => [value.key, value])), review_status: "in_review", locked_fields: [] }));
      if (rowPayload.length) await rest(identity, "review_table_rows", { method: "POST", headers: { "content-type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(rowPayload) });
      setTable(reviewTable); toast.success("Tabular review created", { description: `${rowPayload.length} documents extracted with source-backed cells.` }); await load(reviewTable.id);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Tabular review failed"); } finally { setBusy(false); }
  };
  const patchRow = async (row: ReviewRow, values: Partial<ReviewRow>) => { if (!identity) return; try { await rest(identity, `review_table_rows?id=eq.${row.id}`, { method: "PATCH", headers: { "content-type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(values) }); await load(); } catch (error) { toast.error(error instanceof Error ? error.message : "Row could not be updated"); } };
  const editCell=async(row:ReviewRow,column:ExtractionColumn)=>{if(row.locked_fields?.includes(column.key))return;const old=row.values[column.key];const value=window.prompt(`Edit ${column.label}`,typeof old==='string'?old:old?.value||'');if(value===null)return;await patchRow(row,{values:{...row.values,[column.key]:{...(typeof old==='object'?old:{}),value}},review_status:'in_review'});};
  const exportCsv = () => { if (!rows.length) return; const header = ["document", ...columns.map(c => c.label), "review_status"]; const lines = [header, ...rows.map(row => [documents.find(d => d.id === row.document_id)?.title || row.document_id || "Document", ...columns.map(col => { const cell = row.values?.[col.key]; return typeof cell === "string" ? cell : cell?.value || ""; }), row.review_status])].map(line => line.map(value => `"${String(value || "").replace(/^[=+@-]/,"\'$&").replaceAll('"', '""')}"`).join(",")); const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" })); const a = document.createElement("a"); a.href = url; a.download = "legal-eye-tabular-review.csv"; a.click(); URL.revokeObjectURL(url); };
  return <div className="view-pad"><LiveHeader title="Tabular Review" meta="Turn processed private documents into a source-backed review table, then lock and approve lawyer-reviewed cells." action={<div className="row"><Button variant="outline" onClick={exportCsv} disabled={!rows.length}><Download/> CSV</Button><Button onClick={build} disabled={busy || !picked.length}><Sparkles/> {busy ? "Extracting…" : "Build review"}</Button></div>}/>
    {!identity ? <SecureEmpty identity={identity} connect={connect} title="No review table" copy="Sign in and process private documents first."/> : <><div className="live-create-bar"><select aria-label="Saved review tables" value={selectedTable} onChange={e=>void load(e.target.value)}><option value="">Saved reviews</option>{savedTables.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><Input aria-label="Filter table rows" placeholder="Filter documents and extracted values…" value={filter} onChange={e=>setFilter(e.target.value)}/></div><div className="live-source-picker"><span className="eyebrow">Processed documents</span>{ready.length ? ready.map(doc => <label key={doc.id}><Checkbox checked={picked.includes(doc.id)} onCheckedChange={checked => setPicked(prev => checked ? [...new Set([...prev, doc.id])] : prev.filter(id => id !== doc.id))}/><span>{doc.title}</span></label>) : <p>No private document is ready yet. Upload one in Vault and allow processing to complete.</p>}</div><div className="live-create-bar"><Input placeholder="Add extraction column" value={newColumn} onChange={e => setNewColumn(e.target.value)} onKeyDown={e => e.key === "Enter" && addColumn()}/><Button variant="outline" onClick={addColumn}><Plus/> Column</Button><span className="column-pills">{columns.map(c => <Badge key={c.key}>{c.label}</Badge>)}</span></div>
      {table && rows.length ? <div className="legal-table live-table"><div className="row spread"><div><span className="eyebrow">Persisted review</span><h2>{table.name}</h2></div><Status value="in_progress"/></div><Table><TableHeader><TableRow><TableHead>Document</TableHead>{columns.map(col => <TableHead key={col.key}>{col.label}</TableHead>)}<TableHead>Review</TableHead></TableRow></TableHeader><TableBody>{rows.filter(row=>`${documents.find(d=>d.id===row.document_id)?.title} ${JSON.stringify(row.values)}`.toLowerCase().includes(filter.toLowerCase())).map(row => <TableRow key={row.id}><TableCell><b>{documents.find(d => d.id === row.document_id)?.title || "Private document"}</b></TableCell>{columns.map(col => { const cell = row.values?.[col.key]; const parsed = typeof cell === "string" ? { value: cell } : cell || { value: "Not found" }; return <TableCell key={col.key}><div className="source-cell"><b>{parsed.value}</b><Button size="sm" variant="ghost" disabled={row.locked_fields?.includes(col.key)} onClick={()=>void editCell(row,col)}>{row.locked_fields?.includes(col.key)?"Locked":"Edit value"}</Button>{parsed.source_quote ? <small>“{parsed.source_quote}”</small> : null}<em>{parsed.page ? `p. ${parsed.page} · ` : ""}{typeof parsed.confidence === "number" ? `${Math.round(parsed.confidence * 100)}% evidence confidence` : ""}</em></div></TableCell>; })}<TableCell><div className="table-actions"><Status value={row.review_status}/><Button size="sm" variant="outline" onClick={() => void patchRow(row, { review_status: row.review_status === "reviewed" ? "in_review" : "reviewed", reviewed_by: identity.user.id, reviewed_at: new Date().toISOString() } as Partial<ReviewRow>)}>{row.review_status === "reviewed" ? "Reopen" : "Mark reviewed"}</Button><Button size="sm" variant="ghost" onClick={() => void patchRow(row, { locked_fields: row.locked_fields?.length ? [] : columns.map(c => c.key) })}><LockKeyhole/> {row.locked_fields?.length ? "Unlock" : "Lock"}</Button></div></TableCell></TableRow>)}</TableBody></Table></div> : <SecureEmpty identity={identity} connect={connect} title="No tabular review yet" copy="Select processed documents and build a live extraction table."/>}</>}
  </div>;
}

export function ListsLive({ identity, connect, documents }: CommonProps & { documents: LiveVaultDocument[] }) {
  const ready = documents.filter(d => d.status === "ready");
  const [selectedDoc, setSelectedDoc] = useState(""), [list, setList] = useState<Checklist | null>(null), [items, setItems] = useState<ChecklistItem[]>([]), [busy, setBusy] = useState(false);
  const [savedLists,setSavedLists]=useState<Checklist[]>([]),[selectedList,setSelectedList]=useState("");
  const load = async (id=selectedList) => { if (!identity) return; try { const lists = await rest<Checklist[]>(identity, `checklists?select=id,name,description,matter_id,updated_at&organization_id=eq.${identity.organization_id}&order=updated_at.desc&limit=100`);setSavedLists(lists);const active=lists.find(l=>l.id===id)||lists[0];setList(active||null);setSelectedList(active?.id||"");if(active) setItems(await rest<ChecklistItem[]>(identity, `checklist_items?select=id,title,source_clause,source_page,status,priority,category,notes,due_date,assignee_id&checklist_id=eq.${active.id}&order=position.asc`)); else setItems([]); } catch (error) { toast.error(error instanceof Error ? error.message : "Lists could not be loaded"); } };
  useEffect(() => { void load(); }, [identity]);
  const generate = async () => { if (!identity) return connect(); if (!selectedDoc) return toast.error("Select a processed document."); setBusy(true); try { const data = await legalWork<{ name: string; items: Array<Omit<ChecklistItem, "id" | "status">> }>(identity, { action: "generate_checklist", document_id: selectedDoc }); const created = await rest<Checklist[]>(identity, "checklists", { method: "POST", headers: { "content-type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ organization_id: identity.organization_id, name: data.name, description: "AI-extracted source-linked legal checklist", created_by: identity.user.id }) }); const checklist = created[0]; const payload = data.items.map((item, index) => ({ checklist_id: checklist.id, title: item.title, source_document_id: selectedDoc, source_clause: item.source_clause, source_page: item.source_page, category: item.category, priority: item.priority, notes: item.notes, position: index, status: "pending" })); if (payload.length) await rest(identity, "checklist_items", { method: "POST", headers: { "content-type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(payload) }); toast.success("Checklist generated", { description: `${payload.length} source-linked items saved.` }); await load(checklist.id); } catch (error) { toast.error(error instanceof Error ? error.message : "Checklist generation failed"); } finally { setBusy(false); } };
  const cycle = async (item: ChecklistItem) => { if (!identity) return; const next: Record<string, ChecklistItem["status"]> = { pending: "in_progress", in_progress: "complete", complete: "pending", blocked: "in_progress" }; try { await rest(identity, `checklist_items?id=eq.${item.id}`, { method: "PATCH", headers: { "content-type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ status: next[item.status] }) }); await load(); } catch (error) { toast.error(error instanceof Error ? error.message : "Checklist item could not be updated"); } };
  const updateItem=async(item:ChecklistItem,values:Partial<ChecklistItem>)=>{if(!identity)return;try{await rest(identity,`checklist_items?id=eq.${item.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(values)});await load();}catch(e){toast.error(e instanceof Error?e.message:"Update failed");}};
  const completed = items.filter(item => item.status === "complete").length;
  return <div className="view-pad"><LiveHeader title="Lists" meta="Generate source-linked closing, compliance and diligence checklists from private documents." action={<Button onClick={generate} disabled={busy || !selectedDoc}><ListChecks/> {busy ? "Generating…" : "Generate list"}</Button>}/>
    {!identity ? <SecureEmpty identity={identity} connect={connect} title="No lists yet" copy="Sign in to generate a checklist."/> : <><div className="live-create-bar"><select aria-label="Saved lists" value={selectedList} onChange={e=>void load(e.target.value)}><option value="">Saved lists</option>{savedLists.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select><Button variant="outline" disabled={!items.length} onClick={()=>downloadDocx(list?.name||"Checklist",items.map(i=>`## ${i.title}\n${i.status} · Due ${i.due_date||"not set"}\n${i.notes||""}\nSource: ${i.source_clause||"Document text"}`).join("\n\n"))}><Download/> Export</Button><select value={selectedDoc} onChange={e => setSelectedDoc(e.target.value)}><option value="">Select processed source document</option>{ready.map(doc => <option key={doc.id} value={doc.id}>{doc.title}</option>)}</select></div>{list ? <><div className="list-summary"><div><span>Completion</span><b>{completed} / {items.length}</b></div><Progress value={items.length ? completed / items.length * 100 : 0}/><small>{list.name}</small></div><div className="checklist"><Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Source</TableHead><TableHead>Priority</TableHead><TableHead>Due</TableHead><TableHead>Owner</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{items.map(item => <TableRow key={item.id}><TableCell><b>{item.title}</b><small>{item.notes}</small></TableCell><TableCell>{item.source_clause || (item.source_page ? `Page ${item.source_page}` : "Document text")}</TableCell><TableCell><Status value={item.priority}/></TableCell><TableCell><Input aria-label={`Due date for ${item.title}`} type="date" value={item.due_date||""} onChange={e=>void updateItem(item,{due_date:e.target.value||null})}/></TableCell><TableCell><Button variant="ghost" onClick={()=>void updateItem(item,{assignee_id:item.assignee_id===identity.user.id?null:identity.user.id})}>{item.assignee_id===identity.user.id?"Assigned to you":item.assignee_id?"Assigned":"Assign to me"}</Button></TableCell><TableCell><Button variant="ghost" onClick={() => void cycle(item)}><Status value={item.status}/></Button></TableCell></TableRow>)}</TableBody></Table></div></> : <SecureEmpty identity={identity} connect={connect} title="No checklist yet" copy="Choose a processed document and generate the first source-linked list."/>}</>}
  </div>;
}

export { WorkflowsLive } from "./legal-eye-workflows";

export function AgentLive({ identity, connect, documents }: CommonProps & { documents: LiveVaultDocument[] }) {
  const [objective, setObjective] = useState("Research the issue and prepare a lawyer-ready memo with verified Tanzanian primary law."), [picked, setPicked] = useState<string[]>([]), [runs, setRuns] = useState<AgentRun[]>([]), [current, setCurrent] = useState<AgentRun | null>(null), [busy, setBusy] = useState(false);
  const ready = documents.filter(d => d.status === "ready");
  const load = async () => { if (!identity) return; try { const rows = await rest<AgentRun[]>(identity, `agent_runs?select=id,objective,status,plan,result,created_at&organization_id=eq.${identity.organization_id}&order=created_at.desc&limit=10`); setRuns(rows); if (!current && rows[0]) setCurrent(rows[0]); } catch (error) { toast.error(error instanceof Error ? error.message : "Agent runs could not be loaded"); } };
  useEffect(() => { void load(); }, [identity]);
  const run = async () => { if (!identity) return connect(); setBusy(true); try { const data = await legalWork<{ plan: AgentStep[]; executive_summary: string; deliverable: string; uncertainties: string[] }>(identity, { action: "run_agent", objective, document_ids: picked }); const stored = await rest<AgentRun[]>(identity, "agent_runs", { method: "POST", headers: { "content-type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ organization_id: identity.organization_id, created_by: identity.user.id, objective, plan: data.plan, status: "needs_review", result: { executive_summary: data.executive_summary, deliverable: data.deliverable, uncertainties: data.uncertainties }, started_at: new Date().toISOString(), completed_at: new Date().toISOString() }) }); setCurrent(stored[0]); toast.success("Agent output saved for lawyer review", { description: "The timeline records tools that actually ran." }); await load(); } catch (error) { toast.error(error instanceof Error ? error.message : "Agent run failed"); } finally { setBusy(false); } };
  const progress = current?.plan?.length ? current.plan.filter(s => s.status === "complete").length / current.plan.length * 100 : 0;
  return <div className="view-pad"><LiveHeader title="Agent" meta="Give LOCKE an objective. Add private files only when needed." action={<Button onClick={run} disabled={busy || !objective.trim()}><Play/> {busy ? "Running…" : "Run agent"}</Button>}/><div className="workspace-tip"><FolderLock/><span><b>Private context is optional.</b> Upload files in <a href="/?view=vault">Vault</a>, wait for <strong>Ready</strong>, then tick them below. No selection means Agent works without firm documents.</span></div>{!identity ? <SecureEmpty identity={identity} connect={connect} title="No agent runs" copy="Sign in to run governed legal work."/> : <><div className="agent-input"><Textarea value={objective} onChange={e => setObjective(e.target.value)} /><div className="live-source-picker"><span className="eyebrow">Private context · {picked.length ? `${picked.length} selected` : "none selected"}</span>{ready.length?ready.map(doc => <label key={doc.id}><Checkbox checked={picked.includes(doc.id)} onCheckedChange={checked => setPicked(prev => checked ? [...new Set([...prev, doc.id])] : prev.filter(id => id !== doc.id))}/><span>{doc.title}</span></label>):<a className="inline-vault-link" href="/?view=vault">Upload a document in Vault</a>}</div></div><div className="agent-grid"><section className="agent-card">{current ? <><div className="run-head"><i><Bot/></i><div><span className="eyebrow">Persisted agent run</span><h2>{current.objective}</h2></div><Status value={current.status}/></div><div className="progress-block"><div className="row spread"><span>Execution</span><b>{Math.round(progress)}%</b></div><Progress value={progress}/></div><div className="timeline">{(current.plan || []).map(step => <div key={step.step} className={step.status === "complete" ? "done" : step.status === "needs_review" ? "active" : ""}><i>{step.status === "complete" ? <Check/> : step.step}</i><span><b>{step.title}</b><small>{step.detail}</small></span><Status value={step.status}/></div>)}</div></> : <SecureEmpty identity={identity} connect={connect} title="No agent run yet" copy="Define an objective and execute it."/>}</section><aside className="agent-side">{current?.result ? <><span className="eyebrow">Deliverable</span><Button variant="outline" onClick={()=>downloadDocx("LOCKE agent work product",`${current.result?.executive_summary||""}\n\n${current.result?.deliverable||""}`)}><Download/> Word</Button><h2>{current.result.executive_summary}</h2><pre>{current.result.deliverable}</pre>{current.result.uncertainties?.length ? <div className="uncertainties"><b>Uncertainties</b>{current.result.uncertainties.map(x => <p key={x}>{x}</p>)}</div> : null}</> : <p>Agent output will appear here.</p>}<hr/><span className="eyebrow">Recent runs</span>{runs.map(runItem => <button key={runItem.id} onClick={() => setCurrent(runItem)}><span>{runItem.objective}</span><Status value={runItem.status}/></button>)}</aside></div></>}
  </div>;
}

export function MonitorsLive({ identity, connect, documents, stats, total }: CommonProps & { documents: LiveCorpusDocument[]; stats: LiveCorpusStats; total: number }) {
  const [monitors, setMonitors] = useState<Monitor[]>([]), [events, setEvents] = useState<MonitorEvent[]>([]), [name, setName] = useState("Tanzania regulatory change"), [topic, setTopic] = useState("regulatory compliance"), [busy, setBusy] = useState(false);
  const load = async () => { if (!identity) return; try { const rows = await rest<Monitor[]>(identity, `monitors?select=id,name,monitor_type,jurisdiction_codes,topic_query,status,updated_at&organization_id=eq.${identity.organization_id}&order=updated_at.desc`); setMonitors(rows); if (rows.length) setEvents(await rest<MonitorEvent[]>(identity, `monitor_events?select=id,monitor_id,title,source_url,change_kind,summary,status,detected_at&monitor_id=in.(${rows.map(r => r.id).join(",")})&order=detected_at.desc&limit=50`)); else setEvents([]); } catch (error) { toast.error(error instanceof Error ? error.message : "Monitors could not be loaded"); } };
  useEffect(() => { void load(); }, [identity]);
  const create = async () => { if (!identity) return connect(); setBusy(true); try { await rest(identity, "monitors", { method: "POST", headers: { "content-type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ organization_id: identity.organization_id, name, monitor_type: "topic", jurisdiction_codes: ["TZ"], topic_query: topic, status: "active", created_by: identity.user.id }) }); toast.success("Monitor created"); await load(); } catch (error) { toast.error(error instanceof Error ? error.message : "Monitor could not be created"); } finally { setBusy(false); } };
  const scan = async (monitor: Monitor) => {if(!identity)return;setBusy(true);try{const count=await rest<number>(identity,"rpc/scan_legal_monitor",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({p_monitor_id:monitor.id})});toast.success("Monitor scan complete",{description:`${count} new source updates found.`});await load();}catch(e){toast.error(e instanceof Error?e.message:"Scan failed");}finally{setBusy(false);}};
  const toggleMonitor=async(monitor:Monitor)=>{if(!identity)return;try{await rest(identity,`monitors?id=eq.${monitor.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({status:monitor.status==='active'?'paused':'active'})});await load();}catch(e){toast.error(e instanceof Error?e.message:'Monitor update failed');}};
  const triage = async (event: MonitorEvent, status: string) => { if (!identity) return; try { await rest(identity, `monitor_events?id=eq.${event.id}`, { method: "PATCH", headers: { "content-type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ status, assigned_to: status === "assigned" ? identity.user.id : null }) }); await load(); } catch (error) { toast.error(error instanceof Error ? error.message : "Monitor event could not be updated"); } };
  return <div className="view-pad"><LiveHeader title="Monitors" meta="Source catalogue updates are checked every 15 minutes. Review their legal impact and assign the follow-up." action={<Button variant="outline" onClick={() => void load()} disabled={!identity}><RefreshCw/> Refresh</Button>}/><div className="corpus-strip"><div><i><Globe2/></i><span><small>Tanzania corpus</small><b>{stats.TZ.toLocaleString()}</b><em>official records</em></span></div><div><i><Globe2/></i><span><small>UK + EU</small><b>{(stats.UK + stats.EU).toLocaleString()}</b><em>governed records</em></span></div><div><i><Search/></i><span><small>Searchable chunks</small><b>{(stats.searchable || 0).toLocaleString()}</b><em>exact passages</em></span></div><div><i><Activity/></i><span><small>Total catalogue</small><b>{total.toLocaleString()}</b><em>records</em></span></div></div>{!identity ? <SecureEmpty identity={identity} connect={connect} title="No monitors yet" copy="Sign in to create a monitor."/> : <><div className="live-create-bar"><Input value={name} onChange={e => setName(e.target.value)} placeholder="Monitor name"/><Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Topic query"/><Button onClick={create} disabled={busy || !name.trim()}><Plus/> Monitor</Button></div><div className="monitor-live-grid"><aside>{monitors.map(m => <article key={m.id}><Activity/><div><b>{m.name}</b><small>{m.topic_query || m.monitor_type} · {(m.jurisdiction_codes || []).join(", ")}</small></div><Status value={m.status}/><Button size="sm" variant="ghost" onClick={()=>void toggleMonitor(m)}>{m.status==='active'?'Pause':'Resume'}</Button><Button size="sm" variant="outline" onClick={() => void scan(m)} disabled={busy||m.status!=="active"}>Scan</Button></article>)}</aside><section>{events.length ? events.map(event => <article key={event.id}><div><time>{new Date(event.detected_at).toLocaleDateString()}</time><Status value={event.status}/></div><h2>{event.title}</h2><p>{event.summary}</p><footer><Button variant="outline" disabled={!event.source_url} onClick={() => event.source_url && window.open(event.source_url, "_blank", "noopener,noreferrer")}>Official source</Button><Button variant="ghost" onClick={() => void triage(event, "triaged")}>Triage</Button><Button variant="ghost" onClick={() => void triage(event, "assigned")}>Assign to me</Button><Button variant="ghost" onClick={() => void triage(event, "resolved")}>Resolve</Button><Button variant="ghost" onClick={() => void triage(event, "dismissed")}>Dismiss</Button></footer></article>) : <SecureEmpty identity={identity} connect={connect} title="No monitor events yet" copy="Create a monitor and scan the governed corpus."/>}</section></div></>}
  </div>;
}
