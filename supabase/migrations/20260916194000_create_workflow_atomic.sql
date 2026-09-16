-- Keep caller RLS and save the entire linear graph in one transaction.
create or replace function public.create_workflow_design(
 p_organization_id uuid, p_name text, p_description text, p_spec text, p_nodes jsonb
) returns public.workflows language plpgsql security invoker set search_path=public,pg_temp as $$
declare result public.workflows; item jsonb; node_id uuid; previous_id uuid; step_index integer:=0;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if length(trim(coalesce(p_name,''))) not between 1 and 200 then raise exception 'Workflow name must contain 1–200 characters'; end if;
 if jsonb_typeof(p_nodes) is distinct from 'array' then raise exception 'Steps must be an array'; end if;
 if jsonb_array_length(p_nodes) not between 2 and 20 then raise exception 'A workflow needs 2–20 steps'; end if;
 if exists(select 1 from jsonb_array_elements(p_nodes) n where coalesce(n->>'key','')='' or coalesce(n->>'title','')='' or coalesce(n->>'instructions','')='' or length(n->>'instructions')>12000 or coalesce(n->>'type','') not in ('trigger','skill','research','review','draft','decision','human_checkpoint','delivery')) then raise exception 'Each step needs a unique key, supported type, title and instructions'; end if;
 if (select count(distinct n->>'key') from jsonb_array_elements(p_nodes) n) <> jsonb_array_length(p_nodes) then raise exception 'Step keys must be unique'; end if;
 if not exists(select 1 from jsonb_array_elements(p_nodes) n where n->>'type'='human_checkpoint') then raise exception 'A lawyer approval checkpoint is required'; end if;
 insert into public.workflows(organization_id,name,description,natural_language_spec,version,status,created_by)
 values(p_organization_id,trim(p_name),p_description,p_spec,1,'testing',auth.uid()) returning * into result;
 for item in select value from jsonb_array_elements(p_nodes) loop
  insert into public.workflow_nodes(workflow_id,node_key,node_type,position,configuration)
  values(result.id,item->>'key',item->>'type',jsonb_build_object('x',0,'y',step_index*140),jsonb_build_object('title',item->>'title','instructions',item->>'instructions')) returning id into node_id;
  if previous_id is not null then
   insert into public.workflow_edges(workflow_id,source_node_id,target_node_id,condition) values(result.id,previous_id,node_id,'{}'::jsonb);
  end if;
  previous_id:=node_id; step_index:=step_index+1;
 end loop;
 return result;
end;
$$;
revoke all on function public.create_workflow_design(uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.create_workflow_design(uuid,text,text,text,jsonb) to authenticated;
