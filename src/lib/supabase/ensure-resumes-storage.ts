import { createAdminClient } from "@/lib/supabase/admin";

export const RESUMES_BUCKET = "resumes";

/**
 * Creates the private `resumes` storage bucket if missing.
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * RLS policies must still be applied via supabase/migrations/003_resumes_storage.sql.
 */
export async function ensureResumesStorageBucket(): Promise<{
  ok: boolean;
  created?: boolean;
  error?: string;
}> {
  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: "no_service_role" };
  }

  const { data: existing, error: getError } =
    await admin.storage.getBucket(RESUMES_BUCKET);

  if (existing && !getError) {
    return { ok: true, created: false };
  }

  const { error: createError } = await admin.storage.createBucket(RESUMES_BUCKET, {
    public: false,
    fileSizeLimit: 8 * 1024 * 1024,
  });

  if (createError) {
    if (createError.message.toLowerCase().includes("already exists")) {
      return { ok: true, created: false };
    }
    return { ok: false, error: createError.message };
  }

  return { ok: true, created: true };
}

export const RESUME_STORAGE_SETUP_HINT =
  "Create the resumes bucket in Supabase (Storage → New bucket → name: resumes, private) " +
  "and run supabase/migrations/003_resumes_storage.sql in the SQL Editor. " +
  "Or add SUPABASE_SERVICE_ROLE_KEY to .env.local and restart the dev server to auto-create the bucket.";
