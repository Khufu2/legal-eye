-- Preserve completed research and retry saves after rebuilding the database.
alter table public.research_sessions
  add column if not exists mode text not null default 'deep',
  add column if not exists status text not null default 'complete',
  add column if not exists completed_at timestamptz;
notify pgrst, 'reload schema';
