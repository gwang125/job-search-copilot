-- Jobs the user marked as "not consider" on Find Jobs (hidden from future searches)

create table public.job_search_dismissals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  linkedin_job_id text not null,
  job_url text,
  job_title text,
  company text,
  created_at timestamptz not null default now(),
  unique (user_id, linkedin_job_id)
);

create index job_search_dismissals_user_id_idx
  on public.job_search_dismissals (user_id);

alter table public.job_search_dismissals enable row level security;

create policy "Users can manage own job dismissals"
  on public.job_search_dismissals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
