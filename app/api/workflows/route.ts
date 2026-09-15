import { z } from 'zod';
import { POST as legalAI } from '../legal-ai/route';
import { POST as legalWork } from '../legal-work/route';
import { orderWorkflow,needsApproval,type WorkflowNode,type WorkflowEdge,type StepResult } from '@/lib/legal/workflow';
export const maxDuration=60;
const inputSchema=z.object({organization_id:z.string().uuid(),workflow_id:z.string().uuid().optional(),run_id:z.string().uuid().optional(),command:z.enum(['start','advance','approve','cancel']),document_ids:z.array(z.string().uuid()).max(12).default([]),jurisdictions:z.array(z.string().min(2).max(16)).max(10).default(['TZ']),approval_note:z.string().trim().min(3).max(2000).optional()});
export async function POST(request:Request){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,authorization=request.headers.get('authorization')||'';
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
 if(!url||!key)return reply({error:'Server configuration is incomplete'},503);
 if(!authorization.startsWith('Bearer '))return reply({error:'Authentication required'},401);
 const headers={apikey:key,authorization,'content-type':'application/json',Prefer:'return=representation'};
 const db=async(path:string,body?:unknown,method=body?'POST':'GET')=>{const r=await fetch(`${url}/rest/v1/${path}`,{method,headers,body:body?JSON.stringify(body):undefined,cache:'no-store'});const data=await r.json().catch(()=>null);if(!r.ok)throw new Error(data?.message||'Workspace request failed');return data;};
 let claimed:{id:string;execution_revision:number}|null=null;
 try{
 const input=inputSchema.parse(await request.json());
 const auth=await fetch(`${url}/auth/v1/user`,{headers,cache:'no-store'});if(!auth.ok)return reply({error:'Session expired'},401);const user=await auth.json();
 const members=await db(`organization_members?select=role&organization_id=eq.${input.organization_id}&user_id=eq.${user.id}&is_active=is.true`);if(!members.length)return reply({error:'Organization access denied'},403);
 if(input.command==='start'){
  if(!input.workflow_id)return reply({error:'Choose a workflow'},400);
  const [workflow]=await db(`workflows?id=eq.${input.workflow_id}&organization_id=eq.${input.organization_id}`);if(!workflow)return reply({error:'Workflow not found'},404);
  const nodes=await db(`workflow_nodes?workflow_id=eq.${workflow.id}`) as WorkflowNode[],edges=await db(`workflow_edges?workflow_id=eq.${workflow.id}`) as WorkflowEdge[];
  const graph=orderWorkflow(nodes,edges);
  const [run]=await db('workflow_runs',{workflow_id:workflow.id,organization_id:input.organization_id,matter_id:workflow.matter_id,graph_version:workflow.version,status:'queued',started_by:user.id,input:{document_ids:input.document_ids,jurisdictions:input.jurisdictions,graph},checkpoint:{steps:[]},started_at:new Date().toISOString()});return reply({run});
 }
 if(!input.run_id)return reply({error:'Choose a run'},400);
 const [run]=await db(`workflow_runs?id=eq.${input.run_id}&organization_id=eq.${input.organization_id}`);if(!run)return reply({error:'Run not found'},404);
 if(run.started_by!==user.id)return reply({error:'Only the run owner can advance or approve this run'},403);
 if(input.command==='cancel'){const [cancelled]=await db(`workflow_runs?id=eq.${run.id}&execution_revision=eq.${run.execution_revision}`,{status:'cancelled',execution_revision:run.execution_revision+1,lease_until:null,completed_at:new Date().toISOString()},'PATCH');if(!cancelled)return reply({error:'Run changed. Refresh and retry.'},409);return reply({run:cancelled});}
 if(['complete','cancelled'].includes(run.status))return reply({run});
 if(run.lease_until&&new Date(run.lease_until).getTime()>Date.now())return reply({error:'This step is already running. Please wait before resuming.'},409);
 const graph=run.input?.graph as WorkflowNode[];if(!Array.isArray(graph)||!graph.length)return reply({error:'This legacy run has no immutable execution graph. Start a new run.'},409);
 const steps=(run.checkpoint?.steps||[]) as StepResult[];const node=graph.find(n=>!steps.some(s=>s.key===n.node_key));
 if(!node)return reply({error:'The run has no pending step. Start a new run if its state is inconsistent.'},409);
 if(needsApproval(node)&&input.command!=='approve'){
  const [waiting]=await db(`workflow_runs?id=eq.${run.id}&execution_revision=eq.${run.execution_revision}`,{status:'waiting_for_human',current_node_key:node.node_key,lease_until:null},'PATCH');return reply({run:waiting});
 }
 if(input.command==='approve'&&(!needsApproval(node)||!input.approval_note))return reply({error:'An approval checkpoint and a written approval note are required.'},400);
 const [locked]=await db(`workflow_runs?id=eq.${run.id}&execution_revision=eq.${run.execution_revision}`,{status:'running',execution_revision:run.execution_revision+1,lease_until:new Date(Date.now()+180000).toISOString(),current_node_key:node.node_key,error:null},'PATCH');
 if(!locked)return reply({error:'Another request changed this run. Refresh and retry.'},409);claimed=locked;
 const call=async(fn:typeof legalAI,body:Record<string,unknown>)=>{const r=await fn(new Request(new URL('/api/internal',request.url),{method:'POST',headers:{authorization,'content-type':'application/json'},body:JSON.stringify({organization_id:input.organization_id,...body})}));const data=await r.json();if(!r.ok)throw new Error(data.error||'The workflow step failed');return data;};
 const context=steps.map(s=>`## ${s.title}\n${s.output}`).join('\n\n').slice(-65000);
 const instructions=node.configuration.instructions||node.configuration.title||node.node_key;
 let output='';
 if(needsApproval(node))output=`Approved by the run owner. ${input.approval_note}`;
 else if(node.node_type==='trigger')output=`Run started with ${run.input.document_ids.length} selected document(s).`;
 else if(node.node_type==='delivery')output=context||'No generated output.';
 else if(node.node_type==='research'){const data=await call(legalAI,{action:'research',query:instructions.slice(0,4000),jurisdictions:run.input.jurisdictions,matter_id:run.matter_id,use_firm_knowledge:true});output=data.answer+'\n\n'+[...(data.publicEvidence||[]),...(data.privateEvidence||[])].map((e:{title:string;content:string;canonical_url?:string},i:number)=>`Source ${i+1}: ${e.title}\n${e.canonical_url||'Private document'}\n${e.content}`).join('\n\n');}
 else if(node.node_type==='draft'){const data=await call(legalAI,{action:'draft',instructions,context,jurisdictions:run.input.jurisdictions});output=data.content;}
 else {const documents=run.input.document_ids as string[];if(node.node_type==='review'&&!documents.length)throw new Error('This review step requires a selected processed document. Start a new run with its source files.');const data=await call(legalWork,{action:'run_agent',objective:instructions,document_ids:documents,skill_instructions:context.slice(-16000)});output=[data.executive_summary,data.deliverable,...(data.uncertainties||[])].join('\n\n');}
 const step:StepResult={key:node.node_key,title:node.configuration.title||node.node_key,type:node.node_type,status:'complete',output,completed_at:new Date().toISOString(),...(needsApproval(node)?{approved_by:user.id,approval_note:input.approval_note}: {})};
 const nextSteps=[...steps,step],next=graph.find(n=>!nextSteps.some(s=>s.key===n.node_key));
 const [saved]=await db(`workflow_runs?id=eq.${run.id}&execution_revision=eq.${locked.execution_revision}&status=eq.running`,{status:!next?'complete':needsApproval(next)?'waiting_for_human':'queued',current_node_key:next?.node_key||node.node_key,checkpoint:{steps:nextSteps},output:!next?{deliverable:output,steps:nextSteps}:null,lease_until:null,completed_at:!next?new Date().toISOString():null},'PATCH');
 if(!saved)return reply({error:'The run was cancelled or changed before this result was saved.'},409);claimed=null;return reply({run:saved});
 }catch(error){const message=error instanceof Error?error.message:'Workflow failed';if(claimed)await db(`workflow_runs?id=eq.${claimed.id}&execution_revision=eq.${claimed.execution_revision}&status=eq.running`,{status:'failed',error:{message},lease_until:null},'PATCH').catch(()=>undefined);return reply({error:message},error instanceof z.ZodError?400:502);}
}
