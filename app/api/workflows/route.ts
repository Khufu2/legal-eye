import {z} from 'zod';
import {start} from 'workflow/api';
import {executeWorkflowCommand} from '@/lib/legal/workflow-handler';
import {drainLegalWorkflow} from '@/lib/workflow/legal-workflow';
export const maxDuration=60;
export async function POST(request:Request){
 const raw=await request.json().catch(()=>null);
 if(!raw)return Response.json({error:'Invalid request'},{status:400});
 const background=raw.background===true;
 const result=await executeWorkflowCommand(new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify(raw)}));
 if(!result.ok||!background||raw.command==='cancel')return result;
 const payload=await result.json();
 if(payload.run?.status==='queued'||payload.run?.status==='failed'){
  try{const ids=z.object({id:z.string().uuid(),organization_id:z.string().uuid()}).parse(payload.run);
   const durable=await start(drainLegalWorkflow,[{runId:ids.id,organizationId:ids.organization_id,authorization:request.headers.get('authorization')||''}],{experimental_retention:0});
   return Response.json({...payload,background:true,execution_id:durable.runId},{headers:{'cache-control':'no-store'}});
  }catch{return Response.json({...payload,background:false,scheduling_error:'Background scheduling failed. Your run is saved; resume it to retry.'},{headers:{'cache-control':'no-store'}});}
 }
 return Response.json(payload,{headers:{'cache-control':'no-store'}});
}
