import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

/**
 * Load the signed-in user's profile, creating an empty row if the signup trigger
 * never ran (common when the migration was applied after account creation).
 */
export async function getOrCreateProfile(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null
): Promise<Profile | null> {
  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (selectError) {
    console.error("profile select:", selectError.message);
    return null;
  }

  if (existing) {
    return existing as Profile;
  }

  const { data: created, error: upsertError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        email: email ?? null,
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();

  if (upsertError) {
    console.error("profile upsert:", upsertError.message);
    return null;
  }

  return created as Profile;
}
