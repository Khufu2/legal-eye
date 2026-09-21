"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowUp, Bot, FileUp, MessageCircle, Sparkles, X } from "lucide-react";

type Identity = { access_token:string; organization_id:string; user:{email?:string} } | null;
type Document = { title:string; status:string };
type Matter = { id:string; name:string };

type ChatMessage = { role:"user"|"assistant"; content:string };

export function LockeAssistant({
  identity,
  view,
  matterId,
  matters,
  documents,
  connect,
  navigate,
}:{
  identity:Identity;
  view:string;
  matterId:string|null;
  matters:Matter[];
  documents:Document[];
  connect:()=>void;
  navigate:(view:string)=>void;
}) {
  const [open,setOpen]=useState(false);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [chat,setChat]=useState<ChatMessage[]>([]);
  const inputRef=useRef<HTMLTextAreaElement>(null);
  const activeMatter=useMemo(()=>matters.find(m=>m.id===matterId)?.name??null,[matters,matterId]);
  const readyCount=documents.filter(d=>d.status==="ready").length;

  const ask=async(text=message)=>{
    const clean=text.trim();
    if(!clean)return;
    if(!identity){connect();return;}
    const next=[...chat,{role:"user" as const,content:clean}];
    setChat(next);setMessage("");setBusy(true);
    try{
      const response=await fetch("/api/locke-assistant",{
        method:"POST",
        headers:{Authorization:`Bearer ${identity.access_token}`,"content-type":"application/json"},
        body:JSON.stringify({
          organization_id:identity.organization_id,
          message:clean,
          current_view:view,
          active_matter:activeMatter,
          documents:documents.slice(0,50).map(d=>({title:d.title,status:d.status})),
          history:chat.slice(-8),
        }),
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"LOCKE Guide is unavailable");
      setChat([...next,{role:"assistant",content:String(data.answer||"")}]);
    }catch(error){
      setChat([...next,{role:"assistant",content:error instanceof Error?error.message:"LOCKE Guide is unavailable"}]);
    }finally{setBusy(false);setTimeout(()=>inputRef.current?.focus(),50)}
  };

  return <>
    <button className="locke-guide-fab" aria-label="Open LOCKE Guide" onClick={()=>setOpen(true)}>
      <span className="locke-guide-mark"><Sparkles size={18}/></span>
      <span>Ask LOCKE</span>
    </button>
    {open&&<aside className="locke-guide-panel" aria-label="LOCKE Guide">
      <header><div className="locke-guide-logo"><span><Sparkles/></span><div><b>LOCKE Guide</b><small>Context-aware help</small></div></div><button aria-label="Close LOCKE Guide" onClick={()=>setOpen(false)}><X/></button></header>
      <div className="locke-guide-context"><span>{view}</span>{activeMatter&&<span>{activeMatter}</span>}<span>{readyCount} ready file{readyCount===1?"":"s"}</span></div>
      <div className="locke-guide-body">
        {!chat.length&&<>
          <div className="locke-guide-welcome"><div className="guide-orb"><Bot/></div><h2>How can I help?</h2><p>I know which LOCKE page you’re on and what private files are ready.</p></div>
          <div className="locke-guide-starters">
            <button onClick={()=>void ask("How do I use this page?")}>How do I use this page?</button>
            <button onClick={()=>void ask("Where do I upload documents?")}>Where do I upload documents?</button>
            <button onClick={()=>void ask("What can I do with the files that are ready?")}>What can I do with my files?</button>
          </div>
          {!readyCount&&<button className="locke-guide-upload" onClick={()=>{navigate("vault");setOpen(false)}}><FileUp/> Upload documents in Vault</button>}
        </>}
        {chat.map((item,index)=><div className={"locke-guide-message "+item.role} key={index}><span>{item.role==="assistant"?"LOCKE":"You"}</span><p>{item.content}</p></div>)}
        {busy&&<div className="locke-guide-thinking"><i/><i/><i/></div>}
      </div>
      <form onSubmit={e=>{e.preventDefault();void ask()}}>
        <textarea ref={inputRef} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Ask about this workspace…" rows={2} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void ask()}}}/>
        <button type="submit" aria-label="Send" disabled={busy||!message.trim()}><ArrowUp/></button>
      </form>
    </aside>}
  </>;
}
