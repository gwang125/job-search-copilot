import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { isLinkedInConnected } from "@/lib/linkedin/connection";
import { isLinkedInOAuthConfigured } from "@/lib/linkedin/oauth";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  if (!isLinkedInOAuthConfigured()) {
    return NextResponse.json({
      configured: false,
      connected: false,
    });
  }

  const connected = await isLinkedInConnected(auth.supabase, auth.user.id);
  return NextResponse.json({
    configured: true,
    connected,
  });
}
