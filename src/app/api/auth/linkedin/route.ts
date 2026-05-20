import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import {
  buildLinkedInAuthorizationUrl,
  createLinkedInOAuthState,
  isLinkedInOAuthConfigured,
} from "@/lib/linkedin/oauth";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  if (!isLinkedInOAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "LinkedIn sign-in is not configured. Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET to your environment.",
      },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const jobUrl = searchParams.get("jobUrl") ?? undefined;

  const state = createLinkedInOAuthState({
    userId: auth.user.id,
    jobUrl,
    returnPath: "/job-analyzer",
  });

  const authorizationUrl = buildLinkedInAuthorizationUrl(state);
  return NextResponse.redirect(authorizationUrl);
}
