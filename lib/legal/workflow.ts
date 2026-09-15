export type WorkflowNode = { id:string; node_key:string; node_type:string; configuration:{title?:string;instructions?:string}; position?:{y?:number} };
export type WorkflowEdge = { source_node_id:string;target_node_id:string;condition:Record<string,unknown> };
export type StepResult = { key:string;title:string;type:string;status:'complete';output:string;completed_at:string;approved_by?:string;approval_note?:string };
/** Validate and order dependencies before any model or delivery action occurs. */
export function orderWorkflow(nodes:WorkflowNode[],edges:WorkflowEdge[]) {
 if(!nodes.length) throw new Error('The workflow has no steps.');
 if(new Set(nodes.map(n=>n.node_key)).size!==nodes.length)throw new Error('Step keys must be unique.');
 const ids=new Set(nodes.map(n=>n.id));
 if(edges.some(e=>!ids.has(e.source_node_id)||!ids.has(e.target_node_id)))throw new Error('The workflow contains a missing dependency.');
 if(edges.some(e=>Object.keys(e.condition||{}).length))throw new Error('Conditional branches need an explicit approved rule before execution.');
 const ordered:WorkflowNode[]=[];const done=new Set<string>();
 while(ordered.length<nodes.length){const next=nodes.filter(n=>!done.has(n.id)&&edges.filter(e=>e.target_node_id===n.id).every(e=>done.has(e.source_node_id))).sort((a,b)=>(a.position?.y||0)-(b.position?.y||0)||a.node_key.localeCompare(b.node_key))[0];if(!next)throw new Error('The workflow has a circular dependency.');ordered.push(next);done.add(next.id);}
 return ordered;
}
export const needsApproval=(node:WorkflowNode)=>node.node_type==='human_checkpoint'||node.node_type==='decision';
