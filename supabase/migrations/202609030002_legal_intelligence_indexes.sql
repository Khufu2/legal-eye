-- Cover foreign-key joins used by access policies and graph traversal.
create index if not exists court_registry_parent_idx on public.court_registry(parent_court_id);
create index if not exists citation_aliases_authority_idx on public.citation_aliases(authority_id);
create index if not exists citation_aliases_verified_by_idx on public.citation_aliases(verified_by);
create index if not exists legislation_works_parent_idx on public.legislation_works(parent_work_id);
create index if not exists legislation_works_source_idx on public.legislation_works(source_registry_id);
create index if not exists legislation_amendments_amending_idx on public.legislation_amendments(amending_work_id);
create index if not exists legislation_amendments_amended_idx on public.legislation_amendments(amended_work_id);
create index if not exists template_license_registry_org_idx on public.template_license_registry(organization_id);
create index if not exists template_license_registry_template_idx on public.template_license_registry(template_id);
create index if not exists template_license_registry_jurisdiction_idx on public.template_license_registry(jurisdiction_code);
create index if not exists template_license_registry_reviewer_idx on public.template_license_registry(reviewed_by);
create index if not exists monitors_matter_idx on public.monitors(matter_id);
create index if not exists monitors_creator_idx on public.monitors(created_by);
create index if not exists monitor_sources_source_idx on public.monitor_sources(source_registry_id);
create index if not exists monitor_events_source_idx on public.monitor_events(source_registry_id);
create index if not exists monitor_events_assignee_idx on public.monitor_events(assigned_to);
create index if not exists workflows_matter_idx on public.workflows(matter_id);
create index if not exists workflows_creator_idx on public.workflows(created_by);
create index if not exists workflow_edges_source_idx on public.workflow_edges(source_node_id);
create index if not exists workflow_edges_target_idx on public.workflow_edges(target_node_id);
create index if not exists workflow_runs_workflow_idx on public.workflow_runs(workflow_id);
create index if not exists workflow_runs_matter_idx on public.workflow_runs(matter_id);
create index if not exists workflow_runs_starter_idx on public.workflow_runs(started_by);

drop policy if exists template_licenses_write on public.template_license_registry;
create policy template_licenses_insert on public.template_license_registry for insert to authenticated
  with check (organization_id is not null and private.org_role_for(organization_id) = any (array['owner'::public.org_role,'admin'::public.org_role,'partner'::public.org_role]));
create policy template_licenses_update on public.template_license_registry for update to authenticated
  using (organization_id is not null and private.org_role_for(organization_id) = any (array['owner'::public.org_role,'admin'::public.org_role,'partner'::public.org_role]))
  with check (organization_id is not null and private.org_role_for(organization_id) = any (array['owner'::public.org_role,'admin'::public.org_role,'partner'::public.org_role]));
create policy template_licenses_delete on public.template_license_registry for delete to authenticated
  using (organization_id is not null and private.org_role_for(organization_id) = any (array['owner'::public.org_role,'admin'::public.org_role,'partner'::public.org_role]));

