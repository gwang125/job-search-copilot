-- LinkedIn OAuth tokens for job URL parsing (per user)
create table public.linkedin_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  access_token text not null,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.linkedin_connections enable row level security;

create policy "Users can view own LinkedIn connection"
  on public.linkedin_connections
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own LinkedIn connection"
  on public.linkedin_connections
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own LinkedIn connection"
  on public.linkedin_connections
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own LinkedIn connection"
  on public.linkedin_connections
  for delete
  using (auth.uid() = user_id);

create trigger linkedin_connections_updated_at
  before update on public.linkedin_connections
  for each row execute function public.set_updated_at();
