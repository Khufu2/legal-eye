from pathlib import Path

# one-shot trigger
page=Path('app/page.tsx')
text=page.read_text()
old='import { AgentLive, ListsLive, MattersLive, MonitorsLive, SkillsLive, TablesLive, WorkflowsLive } from "@/components/legal-eye-live";\n'
new=old+'import { EditorLive } from "@/components/legal-eye-editor";\n'
if 'components/legal-eye-editor' not in text:
    if old not in text: raise SystemExit('live workspace import anchor missing')
    text=text.replace(old,new,1)
text=text.replace('["ask","Ask",MessageSquareText],["research","Research",Search],["draft","Draft",FilePenLine],','["ask","Ask",MessageSquareText],["research","Research",Search],["draft","Editor",FilePenLine],',1)
old_map='view==="draft"?<Draft identity={identity} connect={connect}/>'
new_map='view==="draft"?<EditorLive identity={identity} connect={connect}/>'
if old_map not in text: raise SystemExit('draft mapping anchor missing')
text=text.replace(old_map,new_map,1)
page.write_text(text)

css=Path('app/refinement.css')
styles=css.read_text()
if '/* Collaborative Editor live layer */' not in styles:
    styles += '''\n\n/* Collaborative Editor live layer */
.editor-live { padding:clamp(24px,3vw,48px); }
.editor-live-grid { display:grid; grid-template-columns:220px minmax(0,1fr) 300px; min-height:680px; border:1px solid var(--le-soft-border); border-radius:16px; overflow:hidden; }
.editor-library,.editor-collab { padding:16px; background:color-mix(in srgb,var(--background) 96%,white 4%); overflow:auto; }
.editor-library { border-right:1px solid var(--le-soft-border); }
.editor-collab { border-left:1px solid var(--le-soft-border); }
.editor-library > button,.version-list > button { display:flex; align-items:flex-start; gap:10px; width:100%; padding:11px; margin-top:7px; border:1px solid transparent; border-radius:10px; text-align:left; }
.editor-library > button.active { border-color:var(--le-soft-border); background:var(--accent); }
.editor-library > button svg,.version-list > button svg { width:16px; height:16px; margin-top:2px; }
.editor-library span,.version-list span { display:grid; gap:3px; min-width:0; }
.editor-library b,.editor-library small,.version-list b,.version-list small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.editor-library small,.version-list small { opacity:.58; }
.editor-document { padding:clamp(20px,3vw,42px); overflow:auto; }
.editor-title { margin-bottom:16px; min-height:48px; font-size:1.2rem; font-weight:650; }
.editor-document > textarea { min-height:480px; resize:vertical; font-family:Georgia,Cambria,serif; font-size:1rem; line-height:1.72; }
.editor-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:14px; }
.editor-suggestion { margin-top:16px; padding:18px; border:1px solid var(--le-soft-border); border-radius:12px; background:color-mix(in srgb,var(--background) 94%,white 6%); }
.editor-suggestion > div { display:flex; justify-content:space-between; gap:12px; align-items:center; }
.editor-suggestion pre { white-space:pre-wrap; font:inherit; line-height:1.62; margin:14px 0 0; }
.comment-compose { display:grid; gap:8px; margin:12px 0 16px; }
.comment-compose textarea { min-height:90px; }
.comments { display:grid; gap:10px; }
.comments article { display:grid; grid-template-columns:28px minmax(0,1fr); gap:9px; padding:10px 0; border-top:1px solid var(--le-soft-border); }
.comments article > i { display:grid; place-items:center; width:28px; height:28px; border:1px solid var(--le-soft-border); border-radius:999px; }
.comments p { margin:4px 0; line-height:1.5; }
.comments small { opacity:.55; }
.editor-collab hr { margin:18px 0; border:0; border-top:1px solid var(--le-soft-border); }
.version-list { margin-top:8px; }
@media (max-width:1050px){ .editor-live-grid{grid-template-columns:180px minmax(0,1fr)} .editor-collab{grid-column:1/-1;border-left:0;border-top:1px solid var(--le-soft-border);max-height:360px} }
@media (max-width:720px){ .editor-live{padding:20px 14px 34px} .editor-live-grid{display:block} .editor-library{border-right:0;border-bottom:1px solid var(--le-soft-border);max-height:220px} .editor-document{padding:20px 14px} .editor-document > textarea{min-height:360px} }
'''
    css.write_text(styles)
print('activated collaborative editor')
