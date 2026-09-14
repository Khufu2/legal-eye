from pathlib import Path
p=Path('app/page.tsx')
s=p.read_text()
anchor='import { PortalHostPro } from "@/components/legal-eye-portal-host";\n'
if 'components/legal-eye-trust-live' not in s:
    if anchor not in s: raise SystemExit('portal host import anchor missing')
    s=s.replace(anchor,anchor+'import { TrustLive } from "@/components/legal-eye-trust-live";\n',1)
s=s.replace('view==="trust"?<TrustView/>','view==="trust"?<TrustLive identity={identity} connect={connect}/>',1)
p.write_text(s)
css=Path('app/refinement.css')
t=css.read_text()
if '/* Live Trust console */' not in t:
    t+='''\n\n/* Live Trust console */
.trust-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px}.trust-kpis article{display:flex;align-items:center;gap:12px;padding:17px;border:1px solid var(--le-soft-border);border-radius:14px}.trust-kpis article>svg{width:21px;height:21px;opacity:.8}.trust-kpis span{display:grid}.trust-kpis b{font-size:1.22rem}.trust-kpis small,.block-small{display:block;opacity:.6;margin-top:3px}.trust-live-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:16px}.trust-live-grid>section{min-width:0;padding:18px;border:1px solid var(--le-soft-border);border-radius:14px;overflow:auto}.trust-live-grid .subhead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.trust-live-grid .subhead>div{display:flex;align-items:center;gap:10px}.trust-live-grid .subhead span{display:grid}.trust-live-grid .subhead small{opacity:.6}.trust-live-grid table{min-width:620px}.empty-inline{padding:18px;text-align:center;opacity:.62}@media(max-width:1000px){.trust-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.trust-live-grid{grid-template-columns:1fr}}@media(max-width:560px){.trust-kpis{grid-template-columns:1fr}.trust-live-grid>section{padding:12px}}
'''
    css.write_text(t)
print('trust live activated')
# trigger
