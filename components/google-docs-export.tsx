'use client';

import Script from 'next/script';
import {useEffect,useRef,useState} from 'react';
import {createDocx} from '@/lib/legal/docx';
import {DOCX_MIME,DRIVE_SCOPE,GOOGLE_DOC_MIME} from '@/lib/legal/google-drive';
import {Button} from './ui/button';

type TokenResponse = {access_token?:string;error?:string};
type OAuth = {
  initTokenClient(options:{
    client_id:string;scope:string;include_granted_scopes:boolean;
    callback:(response:TokenResponse)=>void;error_callback:()=>void;
  }):{requestAccessToken(options:{prompt:string}):void};
  hasGrantedAllScopes(response:TokenResponse,scope:string):boolean;
  revoke(token:string,callback:()=>void):void;
};

export function GoogleDocsExport({title,text,disabled=false}:{title:string;text:string;disabled?:boolean}) {
  const [clientId,setClientId]=useState('');
  const [scriptReady,setScriptReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [fileId,setFileId]=useState('');
  const active=useRef(true);
  const running=useRef(false);
  const request=useRef<AbortController|null>(null);
  const enabled=process.env.NEXT_PUBLIC_LOCKE_GOOGLE_EXPORT_ENABLED==='1';

  useEffect(()=>{
    if(!enabled)return;
    active.current=true;
    const controller=new AbortController();
    fetch('/api/connections/google',{signal:controller.signal,cache:'no-store'})
      .then(response=>response.ok?response.json():null)
      .then(config=>{if(active.current&&config?.configured)setClientId(config.clientId);})
      .catch(()=>{});
    return ()=>{active.current=false;controller.abort();request.current?.abort();};
  },[enabled]);

  if(!enabled)return null;

  function save() {
    if(disabled||running.current||!text.trim()||!clientId)return;
    const oauth=(window as unknown as {google?:{accounts?:{oauth2?:OAuth}}}).google?.accounts?.oauth2;
    if(!oauth)return;
    const documentName=title.trim().slice(0,150)||'Locke document';
    const reviewedText=text;
    const aborter=new AbortController();
    request.current=aborter;
    running.current=true;
    setBusy(true);setFileId('');setMessage('');
    const done=()=>{if(request.current===aborter){running.current=false;if(active.current)setBusy(false);}};
    const timeout=setTimeout(()=>{
      aborter.abort();
      if(active.current&&request.current===aborter)setMessage('Google did not confirm the export. Check Drive before trying again.');
      done();
    },60_000);
    try{
      oauth.initTokenClient({
        client_id:clientId,scope:DRIVE_SCOPE,include_granted_scopes:false,
        error_callback:()=>{clearTimeout(timeout);if(active.current)setMessage('Google sign-in did not complete. Check pop-up permissions.');done();},
        callback:async response=>{
          const token=response.access_token;
          try{
            if(!active.current||aborter.signal.aborted)return;
            if(response.error||!token||!oauth.hasGrantedAllScopes(response,DRIVE_SCOPE))throw new Error('Authorize file access in Google to export this document.');
            const boundary='locke_'+crypto.randomUUID().replaceAll('-','');
            const parts=[
              `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
              JSON.stringify({name:documentName,mimeType:GOOGLE_DOC_MIME}),
              `\r\n--${boundary}\r\nContent-Type: ${DOCX_MIME}\r\n\r\n`,
              createDocx(documentName,reviewedText) as BlobPart,
              `\r\n--${boundary}--\r\n`,
            ];
            const uploaded=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{
              method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'multipart/related; boundary='+boundary},
              body:new Blob(parts),signal:aborter.signal,
            });
            const file=uploaded.ok?await uploaded.json():null;
            if(!file?.id||!/^[A-Za-z0-9_-]{1,200}$/.test(file.id))throw new Error('Google did not confirm the export. Check Drive and your firm’s Google permissions.');
            if(active.current&&!aborter.signal.aborted){setFileId(file.id);setMessage('A new Google Doc was created in the selected account’s Drive.');}
          }catch(error){
            if(active.current&&!aborter.signal.aborted)setMessage(error instanceof Error?error.message:'Could not export to Google Docs.');
          }finally{clearTimeout(timeout);if(token)oauth.revoke(token,()=>{});done();}
        },
      }).requestAccessToken({prompt:'select_account'});
    }catch{
      clearTimeout(timeout);setMessage('Google sign-in did not open. Check pop-up permissions.');done();
    }
  }

  return <div>
    {clientId&&<Script src="https://accounts.google.com/gsi/client" onReady={()=>setScriptReady(true)}/>}
    <Button variant="outline" disabled={disabled||busy||!text.trim()||!scriptReady} onClick={save}>
      {busy?'Exporting…':'Create Google Docs copy'}
    </Button>
    {message&&<p role="status">{message}</p>}
    {fileId&&<a href={'https://docs.google.com/document/d/'+fileId+'/edit'} target="_blank" rel="noreferrer">Open Google Doc ↗</a>}
  </div>;
}
