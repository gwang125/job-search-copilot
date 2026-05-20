import type { SupabaseClient } from "@supabase/supabase-js";

export interface LinkedInConnection {
  user_id: string;
  access_token: string;
  expires_at: string | null;
  updated_at: string;
}

export async function getLinkedInAccessToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("linkedin_connections")
    .select("access_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  if (data.expires_at) {
    const expires = new Date(data.expires_at).getTime();
    if (expires <= Date.now()) return null;
  }

  return data.access_token as string;
}

export async function saveLinkedInConnection(
  supabase: SupabaseClient,
  userId: string,
  accessToken: string,
  expiresInSeconds?: number
): Promise<void> {
  const expiresAt =
    expiresInSeconds && expiresInSeconds > 0
      ? new Date(Date.now() + expiresInSeconds * 1000).toISOString()
      : null;

  const { error } = await supabase.from("linkedin_connections").upsert(
    {
      user_id: userId,
      access_token: accessToken,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;
}

export async function isLinkedInConnected(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const token = await getLinkedInAccessToken(supabase, userId);
  return Boolean(token);
}
