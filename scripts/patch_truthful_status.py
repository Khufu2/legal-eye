from pathlib import Path
p=Path('app/page.tsx')
s=p.read_text()
old='''<div className="monitor-grid"><aside>{["Latest official legislation","Tanzania financial services","EU regulatory change","East Africa data protection","OHADA corporate law"].map((x,i)=><button className={i===0?"active":""} key={x}><Activity/><span>{x}<small>{i===0?`${total.toLocaleString()} records`:i===2?`${stats.EU.toLocaleString()} governed records`:"connector gated"}</small></span></button>)}</aside>'''
new='''<div className="monitor-grid"><aside>{["Latest official legislation","Tanzania financial services","EU regulatory change","East Africa data protection","OHADA corporate law"].map((x,i)=><div className={i===0?"active":""} key={x}><Activity/><span>{x}<small>{i===0?`${total.toLocaleString()} catalogued records`:i===2?`${stats.EU.toLocaleString()} governed records`:"connector gated"}</small></span></div>)}</aside>'''
if old not in s: raise SystemExit('Monitor dead-control marker not found')
s=s.replace(old,new,1)
old='<footer className="system-bar"><span><i/> Legal graph online</span><span>{documentCount} governed records · {count} source policies</span><span>Live data · lawyer verification required</span></footer>'
new='<footer className="system-bar"><span><i/> {corpusStats.searchable&&corpusStats.searchable>0?"Exact search online":"Search indexing pending"}</span><span>{documentCount} governed records · {corpusStats.searchable??0} searchable chunks · {count} source policies</span><span>Live data · lawyer verification required</span></footer>'
if old not in s: raise SystemExit('System status marker not found')
s=s.replace(old,new,1)
p.write_text(s)

css=Path('app/refinement.css')
t=css.read_text()
extra='''\n.monitor-grid > aside > div { display:flex; align-items:center; gap:12px; min-height:58px; padding:12px 14px; border-radius:10px; }\n.monitor-grid > aside > div > span { display:grid; gap:3px; min-width:0; }\n.monitor-grid > aside > div small { opacity:.65; }\n'''
if '.monitor-grid > aside > div {' not in t: t+=extra
css.write_text(t)
