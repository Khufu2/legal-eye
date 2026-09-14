from pathlib import Path

page=Path('app/page.tsx')
text=page.read_text()
anchor='import { EditorLive } from "@/components/legal-eye-editor";\n'
if 'components/legal-eye-portal' not in text:
    if anchor not in text: raise SystemExit('editor import anchor missing')
    text=text.replace(anchor,anchor+'import { PortalHost } from "@/components/legal-eye-portal";\n',1)
text=text.replace('type View = "ask"|"research"|"draft"|"review"|"tables"|"lists"|"matters"|"vault"|"agent"|"skills"|"workflows"|"monitor"|"trust";', 'type View = "ask"|"research"|"draft"|"review"|"tables"|"lists"|"matters"|"vault"|"portal"|"agent"|"skills"|"workflows"|"monitor"|"trust";',1)
text=text.replace('const context = [["matters","Matters",BriefcaseBusiness],["vault","Vault",FolderLock]] as const;', 'const context = [["matters","Matters",BriefcaseBusiness],["vault","Vault",FolderLock],["portal","Portal",Globe2]] as const;',1)
old='view==="matters"?<MattersLive identity={identity} connect={connect}/>:view==="vault"?<VaultView identity={identity} documents={vaultDocuments} connect={connect} refresh={()=>void refreshVault()}/>'
new='view==="matters"?<MattersLive identity={identity} connect={connect}/>:view==="vault"?<VaultView identity={identity} documents={vaultDocuments} connect={connect} refresh={()=>void refreshVault()}/>:view==="portal"?<PortalHost identity={identity} connect={connect} documents={vaultDocuments}/>'
if old not in text: raise SystemExit('portal mapping anchor missing')
text=text.replace(old,new,1)
page.write_text(text)

css=Path('app/refinement.css')
styles=css.read_text()
if '/* Secure client portal */' not in styles:
    styles += '''\n\n/* Secure client portal */
.portal-host-grid { display:grid; grid-template-columns:260px minmax(0,1fr); gap:18px; }
.portal-host-grid > aside { display:grid; align-content:start; gap:8px; }
.portal-host-grid > aside > button { display:grid; grid-template-columns:28px minmax(0,1fr) auto; gap:10px; align-items:center; padding:12px; border:1px solid var(--le-soft-border); border-radius:12px; text-align:left; }
.portal-host-grid > aside > button.active { background:var(--accent); }
.portal-host-grid > aside > button span { display:grid; gap:3px; }
.portal-host-grid > aside small { opacity:.58; }
.portal-host-grid > section { min-width:0; }
.portal-hero { display:flex; justify-content:space-between; gap:20px; align-items:flex-start; padding:22px; border:1px solid var(--le-soft-border); border-radius:14px; }
.portal-hero h2 { margin:5px 0; font-size:1.35rem; }
.portal-controls { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:14px 0; }
.portal-controls article { display:grid; grid-template-columns:28px minmax(0,1fr); gap:10px; padding:18px; border:1px solid var(--le-soft-border); border-radius:14px; }
.portal-controls article > input,.portal-controls article > select,.portal-controls article > button { grid-column:2; }
.portal-controls select { min-height:40px; padding:0 10px; border:1px solid var(--le-soft-border); border-radius:9px; background:var(--background); color:inherit; }
.portal-controls small { display:block; margin-top:4px; opacity:.62; }
.portal-table { display:grid; gap:10px; padding:18px; border:1px solid var(--le-soft-border); border-radius:14px; overflow:auto; }
.portal-table h3 { margin-top:10px; }
.portal-guest-shell { min-height:100svh; padding:clamp(24px,5vw,72px); background:var(--background); color:var(--foreground); }
.portal-login { width:min(480px,100%); margin:8vh auto 0; display:grid; gap:14px; padding:28px; border:1px solid var(--le-soft-border); border-radius:18px; }
.portal-brand { display:flex; align-items:center; gap:10px; }
.portal-brand > span { display:grid; place-items:center; width:38px; height:38px; border:1px solid var(--le-soft-border); border-radius:10px; font-weight:800; }
.portal-brand > div { display:grid; gap:2px; }
.portal-brand small { opacity:.6; }
.portal-login h1 { margin:10px 0 0; font-size:clamp(1.8rem,4vw,2.5rem); letter-spacing:-.035em; }
.portal-login p { line-height:1.6; opacity:.72; }
.portal-message { padding:10px 12px; border:1px solid var(--le-soft-border); border-radius:10px; }
.portal-mode { text-align:left; text-decoration:underline; opacity:.72; }
.portal-room { max-width:1400px; margin:0 auto; }
.portal-room > header { display:flex; justify-content:space-between; align-items:center; gap:14px; padding-bottom:20px; border-bottom:1px solid var(--le-soft-border); }
.portal-room-head { display:flex; justify-content:space-between; gap:20px; align-items:flex-start; margin:34px 0 22px; }
.portal-room-head h1 { margin:5px 0; font-size:clamp(2rem,4vw,3.2rem); letter-spacing:-.04em; }
.portal-resource-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:14px; }
.portal-resource-grid > article { border:1px solid var(--le-soft-border); border-radius:15px; overflow:hidden; }
.portal-resource-grid article > header { display:flex; gap:10px; align-items:center; padding:15px 17px; border-bottom:1px solid var(--le-soft-border); }
.portal-resource-grid article > header div { display:grid; gap:3px; }
.portal-resource-grid article small { opacity:.6; }
.portal-resource-grid pre { max-height:480px; overflow:auto; margin:0; padding:20px; white-space:pre-wrap; font:inherit; line-height:1.62; }
.portal-denied { width:min(620px,100%); margin:12vh auto; text-align:center; }
@media (max-width:850px){ .portal-host-grid{grid-template-columns:1fr} .portal-host-grid>aside{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))} .portal-controls{grid-template-columns:1fr} }
@media (max-width:560px){ .portal-guest-shell{padding:18px 14px 36px} .portal-login{padding:20px;margin-top:3vh} .portal-room-head,.portal-hero{flex-direction:column} .portal-resource-grid{grid-template-columns:1fr} }
'''
    css.write_text(styles)
print('activated portal workspace')
