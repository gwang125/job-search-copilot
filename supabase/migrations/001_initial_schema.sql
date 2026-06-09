-- Job Search Copilot — initial schema
-- Run in Supabase SQL Editor or via CLI

-- Extensions
create extension if not exists "pg_trgm";

-- Enums
create type application_status as enum (
  'saved',
  'applied',
  'interview',
  'rejected',
  'offer',
  'archived'
);

create type ai_recommendation as enum ('apply', 'maybe', 'skip');

create type generated_document_type as enum ('cover_letter');

-- Profiles (1:1 with auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  email text,
  location text,
  education jsonb not null default '[]'::jsonb,
  work_experience jsonb not null default '[]'::jsonb,
  skills text[] not null default '{}',
  projects jsonb not null default '[]'::jsonb,
  target_job_titles text[] not null default '{}',
  preferred_locations text[] not null default '{}',
  visa_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Resumes
create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  file_path text,
  file_name text,
  extracted_text text not null default '',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index resumes_user_id_idx on public.resumes (user_id);

-- Jobs (saved job descriptions)
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company text,
  job_title text,
  location text,
  job_url text,
  job_description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jobs_user_id_idx on public.jobs (user_id);
create index jobs_company_trgm_idx on public.jobs using gin (company gin_trgm_ops);

-- Applications (tracker)
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  best_resume_id uuid references public.resumes (id) on delete set null,
  match_score integer check (match_score >= 0 and match_score <= 100),
  status application_status not null default 'saved',
  applied_date date,
  follow_up_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create index applications_user_id_idx on public.applications (user_id);
create index applications_status_idx on public.applications (status);

-- AI analysis results
create table public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  application_id uuid references public.applications (id) on delete set null,
  match_score integer not null check (match_score >= 0 and match_score <= 100),
  best_resume_id uuid references public.resumes (id) on delete set null,
  reasons text[] not null default '{}',
  matched_skills text[] not null default '{}',
  missing_skills text[] not null default '{}',
  risks text[] not null default '{}',
  recommendation ai_recommendation not null,
  raw_response jsonb,
  created_at timestamptz not null default now()
);

create index ai_analyses_job_id_idx on public.ai_analyses (job_id);

-- Generated documents
create table public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  application_id uuid references public.applications (id) on delete set null,
  resume_id uuid references public.resumes (id) on delete set null,
  document_type generated_document_type not null,
  title text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index generated_documents_user_id_idx on public.generated_documents (user_id);

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger resumes_updated_at before update on public.resumes
  for each row execute function public.set_updated_at();
create trigger jobs_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();
create trigger applications_updated_at before update on public.applications
  for each row execute function public.set_updated_at();
create trigger generated_documents_updated_at before update on public.generated_documents
  for each row execute function public.set_updated_at();

-- Only one primary resume per user
create or replace function public.enforce_single_primary_resume()
returns trigger as $$
begin
  if new.is_primary then
    update public.resumes set is_primary = false
    where user_id = new.user_id and id <> new.id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger resumes_primary_trigger
  before insert or update on public.resumes
  for each row execute function public.enforce_single_primary_resume();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.ai_analyses enable row level security;
alter table public.generated_documents enable row level security;

-- Profiles policies
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Resumes policies
create policy "Users can manage own resumes" on public.resumes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Jobs policies
create policy "Users can manage own jobs" on public.jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Applications policies
create policy "Users can manage own applications" on public.applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- AI analyses policies
create policy "Users can manage own analyses" on public.ai_analyses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Generated documents policies
create policy "Users can manage own documents" on public.generated_documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Storage bucket for resumes (create in Supabase Dashboard → Storage)
-- Bucket name: resumes (private)
-- Policy: users can upload/read/delete only their own folder: {user_id}/*
