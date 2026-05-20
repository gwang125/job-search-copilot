-- Resume file storage (run once in Supabase Dashboard → SQL Editor)
--
-- Option A: Create bucket in Dashboard → Storage → New bucket
--   Name: resumes | Public: OFF
-- Then run ONLY the policies below (from "-- Policies" onward).
--
-- Option B: Run this entire file (creates bucket + policies).

-- Bucket (skip if you already created "resumes" in the Dashboard)
insert into storage.buckets (id, name, public, file_size_limit)
values ('resumes', 'resumes', false, 8388608)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

-- Policies (required for uploads/downloads from the app)
drop policy if exists "Users can upload own resume files" on storage.objects;
create policy "Users can upload own resume files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
  );

drop policy if exists "Users can read own resume files" on storage.objects;
create policy "Users can read own resume files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
  );

drop policy if exists "Users can delete own resume files" on storage.objects;
create policy "Users can delete own resume files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
  );
