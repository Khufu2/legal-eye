from pathlib import Path

page = Path("app/page.tsx")
text = page.read_text()

old = 'if(!identity){connect();toast("Connect the test organization before uploading.");return;}'
new = 'if(!identity){connect();toast("Sign in to your organization before uploading.");return;}'
if old not in text:
    raise SystemExit("Vault sign-in copy marker not found")
text = text.replace(old, new, 1)

old = 'const display=documents.map(d=>[d.title,d.status,d.file_name||"Private document"]);'
new = 'const display=documents.map(d=>[d.id,d.title,d.status,d.file_name||"Private document"]);'
if old not in text:
    raise SystemExit("Vault display marker not found")
text = text.replace(old, new, 1)

old = 'display.length?display.map(x=><button key={x[0]}><i><FolderLock/></i><span><b>{x[0]}</b><small>{x[1]} · {x[2]}</small></span><ChevronRight/></button>)'
new = 'display.length?display.map(x=><div className="vault-document" key={x[0]}><i><FolderLock/></i><span><b>{x[1]}</b><small>{x[2]} · {x[3]}</small></span></div>)'
if old not in text:
    raise SystemExit("Vault fake button marker not found")
text = text.replace(old, new, 1)

old = '''  ] as const;
  return <div className="trust-view"><div className="trust-hero"><span className="eyebrow">Enterprise control plane</span><h1>Trust is part of the work product.</h1><p>Every source, model call, permission decision and human approval should be reviewable without asking Legal Eye to explain itself.</p><div><Button><ShieldCheck/> Export control report</Button><Button variant="outline">Open evidence register</Button></div></div>'''
new = '''  ] as const;
  const exportReport=()=>{
    const payload={product:"Legal Eye",generated_at:new Date().toISOString(),lawyer_verification_required:true,controls:controls.map(([title,status,copy])=>({title,status,description:copy}))};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
    const anchor=document.createElement("a");anchor.href=url;anchor.download=`legal-eye-control-report-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);toast.success("Control report exported");
  };
  return <div className="trust-view"><div className="trust-hero"><span className="eyebrow">Enterprise control plane</span><h1>Trust is part of the work product.</h1><p>Every source, model call, permission decision and human approval should be reviewable without asking Legal Eye to explain itself.</p><div><Button onClick={exportReport}><ShieldCheck/> Export control report</Button></div></div>'''
if old not in text:
    raise SystemExit("Trust controls marker not found")
text = text.replace(old, new, 1)

page.write_text(text)

css = Path("app/refinement.css")
styles = css.read_text()
insert = '''\n.vault-document { display:flex; align-items:center; gap:14px; min-height:76px; padding:18px; border:1px solid var(--le-soft-border); border-radius:12px; }\n.vault-document > i { display:grid; place-items:center; flex:0 0 36px; height:36px; border-radius:10px; border:1px solid var(--le-soft-border); }\n.vault-document > span { display:grid; gap:4px; min-width:0; }\n.vault-document b, .vault-document small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }\n'''
if '.vault-document {' not in styles:
    styles += insert
css.write_text(styles)
