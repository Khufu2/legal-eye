"use client";

import {useEffect, useState} from "react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {workspace, type Identity} from "@/lib/legal/client";

type Member = {user_id:string;email:string;role:string;is_active:boolean};
type Invite = {id:string;email:string;role:string;expires_at:string;accepted_at:string|null;revoked_at:string|null};
const roles = ["admin","partner","senior_associate","associate","paralegal","viewer"];
const label = (role:string) => role.replaceAll("_"," ");

export function WorkspaceTeam({identity}:{identity:Identity}) {
  const [members,setMembers]=useState<Member[]>([]);
  const [invites,setInvites]=useState<Invite[]>([]);
  const [email,setEmail]=useState("");
  const [role,setRole]=useState("associate");
  const [link,setLink]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const isAdmin=["owner","admin"].includes(identity.role);
  const rpc=<T,>(name:string,body:Record<string,unknown>)=>workspace<T>(identity,`rpc/${name}`,{method:"POST",body:JSON.stringify(body)});
  async function load() {
    const [people,pending]=await Promise.all([
      rpc<Member[]>("list_workspace_members",{p_organization_id:identity.organization_id}),
      workspace<Invite[]>(identity,`workspace_invites?select=id,email,role,expires_at,accepted_at,revoked_at&organization_id=eq.${identity.organization_id}&order=created_at.desc&limit=100`),
    ]);
    setMembers(people);setInvites(pending);
  }
  useEffect(()=>{if(isAdmin)void load().catch(e=>setError(e instanceof Error?e.message:"Could not load team"));},[identity]);
  async function act(action:()=>Promise<void>) {
    if(busy)return;setBusy(true);setError("");
    try{await action();await load();}catch(e){setError(e instanceof Error?e.message:"Team update failed");}finally{setBusy(false);}
  }
  if(!isAdmin)return null;
  return <section className="workspace-team">
    <h2>Firm team</h2><p>Invite colleagues to this workspace. Invite links work only with the recipient’s verified email and expire after seven days. Use Portal for client access to selected matters.</p>
    {error&&<div className="inline-error" role="alert">{error}</div>}
    <form className="team-invite-form" onSubmit={e=>{e.preventDefault();void act(async()=>{const token=await rpc<string>("create_workspace_invite",{p_organization_id:identity.organization_id,p_email:email,p_role:role});setLink(`${window.location.origin}/#invite=${token}`);setEmail("");});}}>
      <label>Colleague’s email<Input required type="email" autoComplete="off" value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <label>Role<select value={role} onChange={e=>setRole(e.target.value)}>{roles.filter(r=>identity.role==="owner"||r!=="admin").map(r=><option key={r} value={r}>{label(r)}</option>)}</select></label>
      <Button type="submit" disabled={busy}>Create invite link</Button>
    </form>
    {link&&<div className="team-invite-link" role="status"><p>Share this link directly with your colleague. It has not been emailed.</p><Input readOnly aria-label="Invitation link" value={link}/><Button variant="outline" onClick={()=>void navigator.clipboard.writeText(link).catch(()=>setError("Copy the link from the field above."))}>Copy link</Button></div>}
    <div className="team-members">{members.map(member=><div className="team-member" key={member.user_id}>
      <span><b>{member.email}{member.user_id===identity.user.id?" (you)":""}</b><small>{label(member.role)} · {member.is_active?"active":"suspended"}</small></span>
      <select aria-label={`Role for ${member.email}`} value={member.role} disabled={busy||member.user_id===identity.user.id||(identity.role==="admin"&&["owner","admin"].includes(member.role))} onChange={e=>{const next=e.target.value;if(window.confirm(`Change ${member.email} to ${label(next)}?`))void act(async()=>{await rpc("set_workspace_member_access",{p_organization_id:identity.organization_id,p_user_id:member.user_id,p_role:next,p_active:member.is_active});});}}>
        {(identity.role==="owner"?["owner",...roles]:roles.filter(r=>r!=="admin").concat(["owner","admin"].includes(member.role)?[member.role]:[])).map(r=><option key={r} value={r}>{label(r)}</option>)}
      </select>
      <Button variant="outline" disabled={busy||member.user_id===identity.user.id||(identity.role==="admin"&&["owner","admin"].includes(member.role))} onClick={()=>{if(window.confirm(`${member.is_active?"Suspend":"Restore"} access for ${member.email}?`))void act(async()=>{await rpc("set_workspace_member_access",{p_organization_id:identity.organization_id,p_user_id:member.user_id,p_role:member.role,p_active:!member.is_active});});}}>{member.is_active?"Suspend access":"Restore access"}</Button>
    </div>)}</div>
    {invites.filter(i=>!i.accepted_at&&!i.revoked_at&&new Date(i.expires_at)>new Date()).map(invite=><div className="team-member" key={invite.id}><span><b>{invite.email}</b><small>{label(invite.role)} invitation · expires {new Date(invite.expires_at).toLocaleDateString()}</small></span><Button variant="ghost" disabled={busy} onClick={()=>void act(async()=>{await rpc("revoke_workspace_invite",{p_invite_id:invite.id});setLink("");})}>Revoke invite</Button></div>)}
  </section>;
}
