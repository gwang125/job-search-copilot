-- Resume export template (one DOCX layout per user)
create table public.resume_templates (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  file_path text not null,
  file_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.resume_templates enable row level security;

create policy "Users can view own resume template"
  on public.resume_templates
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own resume template"
  on public.resume_templates
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own resume template"
  on public.resume_templates
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own resume template"
  on public.resume_templates
  for delete
  using (auth.uid() = user_id);

create trigger resume_templates_updated_at
  before update on public.resume_templates
  for each row execute function public.set_updated_at();
