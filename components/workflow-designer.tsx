'use client';
import {useState} from 'react';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {Textarea} from './ui/textarea';
import {workspace,type Identity} from '@/lib/legal/client';
export type DesignStep={key:string;type:string;title:string;instructions:string};
const types=['trigger','research','review','draft','skill','human_checkpoint','delivery'];
export function WorkflowDesigner({identity,initial,onSaved,onClose}:{identity:Identity;initial?:{name:string;steps:DesignStep[]};onSaved:(id:string)=>void;onClose:()=>void}){
 const [name,setName]=useState(initial?.name||'New workflow');
 const [steps,setSteps]=useState<DesignStep[]>(initial?.steps||[
  {key:'intake',type:'trigger',title:'Matter intake',instructions:'Confirm the selected source documents and scope of work.'},
  {key:'approval',type:'human_checkpoint',title:'Lawyer approval',instructions:'Review the matter and record your approval and qualifications.'},
  {key:'delivery',type:'delivery',title:'Prepare results',instructions:'Collect the approved results for export.'},
 ]);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 function change(index:number,field:keyof DesignStep,value:string){setSteps(old=>old.map((s,i)=>i===index?{...s,[field]:value}:s));}
 function move(index:number,delta:number){setSteps(old=>{const copy=[...old];[copy[index],copy[index+delta]]=[copy[index+delta],copy[index]];return copy;});}
 async function save(){setError('');if(!steps.some(s=>s.type==='human_checkpoint'))return setError('Add a lawyer approval step before saving.');setBusy(true);try{const row=await workspace<{id:string}>(identity,'rpc/create_workflow_design',{method:'POST',body:JSON.stringify({p_organization_id:identity.organization_id,p_name:name,p_description:'Firm-defined sequential workflow',p_spec:steps.map(s=>`${s.title}: ${s.instructions}`).join('\n'),p_nodes:steps})});onSaved(row.id);}catch(e){setError(e instanceof Error?e.message:'Could not save workflow');}finally{setBusy(false);}}
 return <section className="workflow-designer" aria-label="Workflow designer"><div className="live-header"><div><h2>{initial?'Edit a copy':'Create a workflow'}</h2><p>Arrange the steps and write the instructions your firm follows.</p></div><Button variant="outline" disabled={busy} onClick={onClose}>Close</Button></div><label>Workflow name<Input value={name} maxLength={200} disabled={busy} onChange={e=>setName(e.target.value)}/></label><ol>{steps.map((step,index)=><li key={step.key}><div className="designer-step-heading"><strong>Step {index+1}</strong><div><Button variant="ghost" aria-label={`Move step ${index+1} up`} disabled={busy||index===0} onClick={()=>move(index,-1)}>↑</Button><Button variant="ghost" aria-label={`Move step ${index+1} down`} disabled={busy||index===steps.length-1} onClick={()=>move(index,1)}>↓</Button><Button variant="ghost" disabled={busy||steps.length<=2} onClick={()=>setSteps(old=>old.filter(s=>s.key!==step.key))}>Remove</Button></div></div><div className="designer-step-fields"><label>Step type<select value={step.type} disabled={busy} onChange={e=>change(index,'type',e.target.value)}>{types.map(t=><option key={t} value={t}>{t.replaceAll('_',' ')}</option>)}</select></label><label>Title<Input value={step.title} disabled={busy} onChange={e=>change(index,'title',e.target.value)}/></label></div><label>Instructions<Textarea value={step.instructions} maxLength={12000} disabled={busy} onChange={e=>change(index,'instructions',e.target.value)}/></label></li>)}</ol><div className="designer-actions"><Button variant="outline" disabled={busy||steps.length>=20} onClick={()=>setSteps(old=>[...old,{key:crypto.randomUUID(),type:'review',title:'Review',instructions:''}])}>Add step</Button><Button disabled={busy||!name.trim()||steps.some(s=>!s.title.trim()||!s.instructions.trim())} onClick={()=>void save()}>{busy?'Saving…':initial?'Save as new workflow':'Save workflow'}</Button></div>{error&&<p role="alert" className="inline-error">{error}</p>}<p className="helper">Saved copies keep previous workflows and run history intact. Research, review, drafting and skill steps require AI access. Approval and export do not.</p></section>;
}
