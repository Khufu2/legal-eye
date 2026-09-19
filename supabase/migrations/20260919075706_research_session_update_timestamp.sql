alter table public.research_sessions add column if not exists updated_at timestamptz not null default now();
notify pgrst, 'reload schema';
