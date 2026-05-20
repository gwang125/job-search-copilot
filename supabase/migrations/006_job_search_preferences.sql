-- Hard job search requirements (1:1 with auth.users)
create table public.job_search_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  exclude_us_citizenship_required boolean not null default false,
  exclude_security_clearance_required boolean not null default false,
  exclude_no_visa_sponsorship boolean not null default false,
  exclude_green_card_required boolean not null default false,
  max_years_experience integer,
  exclude_phd_required boolean not null default false,
  excluded_certifications text[] not null default '{}',
  remote_only boolean not null default false,
  hybrid_allowed boolean not null default true,
  preferred_locations text[] not null default '{}',
  blocked_keywords text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index job_search_preferences_user_id_idx on public.job_search_preferences (user_id);

create trigger job_search_preferences_updated_at
  before update on public.job_search_preferences
  for each row execute function public.set_updated_at();

alter table public.job_search_preferences enable row level security;

create policy "Users can view own job search preferences"
  on public.job_search_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert own job search preferences"
  on public.job_search_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update own job search preferences"
  on public.job_search_preferences for update
  using (auth.uid() = user_id);
