import {FatalError,RetryableError,sleep} from 'workflow';
import {executeWorkflowCommand} from '../legal/workflow-handler';
type AuthorizedRun={runId:string;organizationId:string;authorization:string};
/** Vercel encrypts step inputs; no refresh token or service-role key is retained. */
async function inspectRun(input:AuthorizedRun){
 'use step';
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 const headers={apikey:key||'',authorization:input.authorization};
 const auth=await fetch(`${url}/auth/v1/user`,{headers,cache:'no-store'});
 if(!auth.ok){if(auth.status>=500)throw new RetryableError('Authentication service unavailable',{retryAfter:'30s'});throw new FatalError('Session expired or revoked. Sign in and resume the saved run.');}
 const response=await fetch(`${url}/rest/v1/workflow_runs?id=eq.${input.runId}&organization_id=eq.${input.organizationId}&select=status,input,checkpoint,started_by`,{headers,cache:'no-store'});
 if(!response.ok)throw new RetryableError('Workspace unavailable',{retryAfter:'30s'});
 const user=await auth.json();const [run]=await response.json();
 if(!run||run.started_by!==user.id)throw new FatalError('Run no longer accessible');
 const node=run.input?.graph?.find((n:{node_key:string})=>!(run.checkpoint?.steps||[]).some((s:{key:string})=>s.key===n.node_key));
 return {status:run.status,nodeKey:node?.node_key as string|undefined};
}
async function advanceStep(input:AuthorizedRun,nodeKey:string){
 'use step';
 const response=await executeWorkflowCommand(new Request('https://lockeslaw.sheenax.xyz/api/workflows',{method:'POST',headers:{authorization:input.authorization,'content-type':'application/json'},body:JSON.stringify({organization_id:input.organizationId,run_id:input.runId,command:'advance',expected_node_key:nodeKey})}));
 const data=await response.json();
 if(response.status===409)throw new RetryableError('Another execution owns the step lease',{retryAfter:'185s'});
 if([401,403,404].includes(response.status))throw new FatalError('Session expired or access revoked. Sign in and resume.');
 if(!response.ok)throw new RetryableError('Step failed; saved state remains available',{retryAfter:'30s'});
 return {status:String(data.run?.status||'failed')};
}
advanceStep.maxRetries=2;
export async function drainLegalWorkflow(input:AuthorizedRun){
 'use workflow';
 for(let index=0;index<64;index++){
  const state=await inspectRun(input);
  if(['complete','cancelled','waiting_for_human'].includes(state.status)||!state.nodeKey)return {runId:input.runId,status:state.status};
  const next=await advanceStep(input,state.nodeKey);
  if(['complete','cancelled','waiting_for_human'].includes(next.status))return {runId:input.runId,status:next.status};
  await sleep('1s');
 }
 throw new FatalError('Step budget reached. Review the saved run before resuming.');
}
