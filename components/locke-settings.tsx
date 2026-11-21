'use client';

import {useEffect,useState,type FormEvent} from 'react';
import {supabaseKey,supabaseUrl,workspace,type Identity} from '@/lib/legal/client';
import {LockeBilling} from './locke-billing';
import {Button} from './ui/button';
import {Input} from './ui/input';

type Props={
  identity:Identity|null;
  connect:()=>void;
  account:()=>void;
  theme:'light'|'dark';
  setTheme:(theme:'light'|'dark')=>void;
  billingVisible:boolean;
};

export function LockeSettings({identity,connect,account,theme,setTheme,billingVisible}:Props) {
  const [section,setSection]=useState('account');
  const [displayName,setDisplayName]=useState('');
  const [workspaceName,setWorkspaceName]=useState('');
  const [loaded,setLoaded]=useState(false);
  const [saving,setSaving]=useState(false);
  const [feedback,setFeedback]=useState<{error:boolean;text:string}|null>(null);
  const canRename=identity?.role==='owner'||identity?.role==='admin';

  useEffect(()=>{
    if(new URLSearchParams(window.location.search).get('view')==='billing'||
      new URLSearchParams(window.location.search).get('section')==='billing'){
      if(billingVisible)setSection('billing');
    }
  },[billingVisible]);

  useEffect(()=>{
    if(!identity)return;
    let active=true;
    Promise.all([
      getProfile(identity),
      workspace<{name:string}[]>(identity,'organizations?select=name&id=eq.'+identity.organization_id),
    ]).then(([profile,organizations])=>{
      if(!active)return;
      setDisplayName(profile.user_metadata?.display_name||'');
      setWorkspaceName(organizations[0]?.name||'');
      setLoaded(true);
    }).catch(()=>{if(active)setFeedback({error:true,text:'Account and workspace settings could not be loaded. Reload to try again.'});});
    return()=>{active=false;};
  },[identity]);

  async function save(event:FormEvent<HTMLFormElement>,field:'account'|'workspace'){
    event.preventDefault();
    if(!identity||saving)return;
    setSaving(true);
    setFeedback(null);
    try{
      if(field==='account'){
        const profile=await getProfile(identity,displayName.trim());
        setDisplayName(profile.user_metadata?.display_name||'');
      }else{
        const name=await workspace<string>(identity,'rpc/locke_rename_workspace',{
          method:'POST',body:JSON.stringify({p_org:identity.organization_id,p_name:workspaceName}),
        });
        setWorkspaceName(name);
      }
      setFeedback({error:false,text:'Changes saved.'});
    }catch{
      setFeedback({error:true,text:'Could not save changes. Check your connection and try again.'});
    }finally{
      setSaving(false);
    }
  }

  return <div className="view-pad locke-billing locke-settings">
    <div className="live-header"><div><h1>Settings</h1><p>Manage your account, workspace and plan.</p></div></div>
    <nav className="locke-settings-nav" aria-label="Settings sections">
      {(billingVisible?['account','workspace','appearance','billing']:['account','workspace','appearance']).map(item=>
        <Button key={item} variant={section===item?'default':'ghost'} aria-current={section===item?'page':undefined}
          onClick={()=>{setSection(item);if(loaded)setFeedback(null);}}>{item[0].toUpperCase()+item.slice(1)}</Button>)}
    </nav>
    {section==='billing'?
      <LockeBilling identity={identity} connect={connect} trialOnly={false} embedded continueToWorkspace={()=>undefined}/>:
      <section className="billing-checkout locke-settings-panel" aria-label={section}>
        {section==='appearance'?<>
          <h2>Appearance</h2>
          <p>Choose the theme for this browser.</p>
          <div className="locke-settings-actions">
            <Button variant={theme==='light'?'default':'outline'} aria-pressed={theme==='light'} onClick={()=>setTheme('light')}>Light</Button>
            <Button variant={theme==='dark'?'default':'outline'} aria-pressed={theme==='dark'} onClick={()=>setTheme('dark')}>Dark</Button>
          </div>
        </>:!identity?<>
          <h2>{section==='account'?'Account':'Workspace'}</h2><p>Sign in to manage these settings.</p><Button onClick={connect}>Sign in</Button>
        </>:<>
          {section==='account'?<>
            <h2>Account</h2>
            <p>Sign-in email <strong>{identity.user.email}</strong></p>
            <form onSubmit={event=>void save(event,'account')}>
              <label className="billing-field">Display name<Input value={displayName} onChange={event=>setDisplayName(event.target.value)} maxLength={100} disabled={!loaded}/></label>
              <div><Button type="submit" disabled={saving||!loaded}>Save profile</Button></div>
            </form>
          </>:<>
            <h2>Workspace</h2>
            <p>Role <strong>{identity.role}</strong></p>
            <form onSubmit={event=>void save(event,'workspace')}>
              <label className="billing-field">Workspace name<Input value={workspaceName} onChange={event=>setWorkspaceName(event.target.value)} required minLength={2} maxLength={100} disabled={!loaded||!canRename}/></label>
              {canRename?<div><Button type="submit" disabled={saving||!loaded}>Save workspace name</Button></div>:<p>Owners and administrators can rename this workspace.</p>}
            </form>
            <div className="locke-settings-actions"><Button variant="outline" onClick={account}>Switch workspace</Button>
              <a href="/?view=trust">Team access and invitations</a></div>
          </>}
          {!loaded&&!feedback&&<p role="status">Loading settings…</p>}
          {feedback&&<p role={feedback.error?'alert':'status'} className={feedback.error?'billing-error':undefined}>{feedback.text}</p>}
        </>}
      </section>}
  </div>;
}

async function getProfile(identity:Identity,displayName?:string):Promise<{user_metadata?:{display_name?:string}}> {
  const response=await fetch(supabaseUrl+'/auth/v1/user',{
    method:displayName===undefined?'GET':'PUT',
    headers:{apikey:supabaseKey,Authorization:'Bearer '+identity.access_token,'content-type':'application/json'},
    body:displayName===undefined?undefined:JSON.stringify({data:{display_name:displayName}}),
    cache:'no-store',
  });
  if(!response.ok)throw new Error('Profile request failed');
  return response.json();
}
