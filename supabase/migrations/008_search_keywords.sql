-- Saved Find Jobs search keywords (with active toggle per keyword)

alter table public.job_search_preferences
  add column if not exists search_keywords jsonb not null default '[]'::jsonb;
