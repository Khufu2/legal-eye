from pathlib import Path

page = Path('app/page.tsx')
text = page.read_text()
needle = 'import { Toaster } from "@/components/ui/sonner";\nimport { toast } from "sonner";\n'
replacement = needle + 'import { AgentLive, ListsLive, MattersLive, MonitorsLive, SkillsLive, TablesLive, WorkflowsLive } from "@/components/legal-eye-live";\n'
if 'from "@/components/legal-eye-live"' not in text:
    if needle not in text:
        raise SystemExit('page import anchor missing')
    text = text.replace(needle, replacement, 1)

old = '''view==="tables"?<EmptyFeature title="Tables" meta="Extract clauses and facts from your real matter documents." icon={Table2} identity={identity} connect={connect}/>:view==="agent"?<EmptyFeature title="Agent" meta="Run governed multi-step legal work with lawyer checkpoints." icon={Bot} identity={identity} connect={connect}/>:view==="skills"?<EmptyFeature title="Skills" meta="Version and approve your firm's reusable legal expertise." icon={Sparkles} identity={identity} connect={connect}/>:view==="lists"?<EmptyFeature title="Lists" meta="Build source-linked closing and compliance checklists." icon={ListChecks} identity={identity} connect={connect}/>:view==="monitor"?<MonitorView documents={liveDocuments} policies={corpusPolicies} total={documentCount} stats={corpusStats}/>:view==="workflows"?<EmptyFeature title="Workflows" meta="Build repeatable legal processes from real firm work." icon={Workflow} identity={identity} connect={connect}/>:view==="matters"?<EmptyFeature title="Matters" meta="Organize people, documents, research and approvals." icon={BriefcaseBusiness} identity={identity} connect={connect}/>'''
new = '''view==="tables"?<TablesLive identity={identity} connect={connect} documents={vaultDocuments}/>:view==="agent"?<AgentLive identity={identity} connect={connect} documents={vaultDocuments}/>:view==="skills"?<SkillsLive identity={identity} connect={connect} documents={vaultDocuments}/>:view==="lists"?<ListsLive identity={identity} connect={connect} documents={vaultDocuments}/>:view==="monitor"?<MonitorsLive identity={identity} connect={connect} documents={liveDocuments} stats={corpusStats} total={documentCount}/>:view==="workflows"?<WorkflowsLive identity={identity} connect={connect} documents={vaultDocuments}/>:view==="matters"?<MattersLive identity={identity} connect={connect}/>'''
if old not in text:
    raise SystemExit('content mapping anchor missing')
text = text.replace(old, new, 1)
page.write_text(text)

css = Path('app/refinement.css')
styles = css.read_text()
marker = '/* Live Legora-class workspace wiring */'
if marker not in styles:
    styles += '''\n\n/* Live Legora-class workspace wiring */
.live-create-bar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin:0 0 20px; padding:14px; border:1px solid var(--le-soft-border); border-radius:14px; }
.live-create-bar > input { flex:1 1 180px; min-width:150px; }
.live-create-bar > select { min-height:40px; min-width:min(100%,360px); padding:0 12px; border:1px solid var(--le-soft-border); border-radius:10px; background:var(--background); color:inherit; }
.live-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(270px,1fr)); gap:14px; }
.live-card { display:grid; grid-template-columns:42px minmax(0,1fr) 20px; gap:14px; align-items:start; min-height:150px; padding:20px; border:1px solid var(--le-soft-border); border-radius:14px; background:color-mix(in srgb,var(--background) 96%,white 4%); }
.live-card > i { display:grid; place-items:center; width:38px; height:38px; border:1px solid var(--le-soft-border); border-radius:10px; font-style:normal; font-size:.72rem; }
.live-card h2 { margin:10px 0 4px; font-size:1.08rem; }
.live-card p { margin:0 0 12px; opacity:.72; }
.live-card small { display:flex; gap:6px; align-items:center; opacity:.62; }
.live-card small svg { width:14px; height:14px; }
.live-source-picker { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:16px; padding:14px 16px; border:1px solid var(--le-soft-border); border-radius:14px; }
.live-source-picker > label { display:flex; align-items:center; gap:8px; padding:8px 10px; border:1px solid var(--le-soft-border); border-radius:999px; font-size:.86rem; }
.live-source-picker > p { margin:0; opacity:.7; }
.column-pills { display:flex; gap:6px; flex-wrap:wrap; }
.live-table { padding:18px; border:1px solid var(--le-soft-border); }
.live-table h2 { font-size:1.2rem; margin-top:4px; }
.source-cell { display:grid; gap:7px; min-width:170px; max-width:310px; }
.source-cell small { opacity:.72; line-height:1.45; }
.source-cell em { font-size:.72rem; font-style:normal; opacity:.55; }
.table-actions { display:grid; gap:7px; min-width:126px; }
.agent-input { display:grid; gap:14px; margin-bottom:18px; }
.agent-result { display:grid; gap:8px; padding:16px; border:1px solid var(--le-soft-border); border-radius:12px; }
.agent-result pre, .agent-side pre { margin:0; white-space:pre-wrap; overflow-wrap:anywhere; font:inherit; line-height:1.62; }
.agent-side { padding:20px; border:1px solid var(--le-soft-border); border-radius:14px; overflow:auto; }
.agent-side > button { display:flex; justify-content:space-between; gap:12px; width:100%; padding:10px 0; text-align:left; border-top:1px solid var(--le-soft-border); }
.uncertainties { margin-top:18px; padding-top:14px; border-top:1px solid var(--le-soft-border); }
.live-workflow { min-height:560px; }
.live-workflow > aside:first-child { display:grid; align-content:start; gap:8px; padding:14px; }
.live-workflow > aside:first-child button { display:grid; gap:3px; padding:12px; border:1px solid var(--le-soft-border); border-radius:10px; text-align:left; }
.live-workflow > aside:first-child button.active { background:var(--accent); }
.live-workflow .graph { padding:28px; }
.live-workflow .connector { display:grid; place-items:center; min-height:44px; transform:rotate(90deg); opacity:.5; }
.monitor-live-grid { display:grid; grid-template-columns:minmax(270px,.75fr) minmax(0,1.45fr); gap:18px; }
.monitor-live-grid > aside, .monitor-live-grid > section { display:grid; align-content:start; gap:10px; }
.monitor-live-grid > aside > article { display:grid; grid-template-columns:32px minmax(0,1fr) auto auto; gap:10px; align-items:center; padding:14px; border:1px solid var(--le-soft-border); border-radius:12px; }
.monitor-live-grid > aside > article div { display:grid; gap:3px; }
.monitor-live-grid > aside > article small { opacity:.62; }
.monitor-live-grid > section > article { padding:18px; border:1px solid var(--le-soft-border); border-radius:14px; }
.monitor-live-grid > section > article > div:first-child, .monitor-live-grid footer { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; }
.monitor-live-grid h2 { margin:12px 0 6px; font-size:1.08rem; }
.monitor-live-grid p { line-height:1.55; opacity:.75; }
.workflow-prompt textarea { min-height:96px; }
.skills-grid textarea { min-height:240px; }
.checklist td small { display:block; margin-top:5px; opacity:.62; }
@media (max-width:900px) { .monitor-live-grid { grid-template-columns:1fr; } .live-workflow { display:block; } .live-workflow > aside { margin-bottom:12px; } }
@media (max-width:620px) { .live-create-bar { align-items:stretch; flex-direction:column; } .live-create-bar > * { width:100%; } .live-grid { grid-template-columns:1fr; } .monitor-live-grid > aside > article { grid-template-columns:28px minmax(0,1fr); } .monitor-live-grid > aside > article > :nth-child(n+3) { grid-column:2; justify-self:start; } }
'''
    css.write_text(styles)
print('wired live workspaces and styles')
