-- Allow users to create their own profile row (needed for upsert when trigger did not run)
drop policy if exists "Users can insert own profile" on public.profiles;

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);
