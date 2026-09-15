alter table public.workflow_runs add column if not exists execution_revision integer not null default 0, add column if not exists lease_until timestamptz;
