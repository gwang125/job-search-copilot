import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { getLinkedInAccessToken } from "@/lib/linkedin/connection";
import {
  isLinkedInOAuthConfigured,
  linkedInAuthStartUrl,
} from "@/lib/linkedin/oauth";
import { isLinkedInJobUrl } from "@/lib/linkedin/url";
import { parseJobFromUrl } from "@/lib/job-parser";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await request.json();
  const url = body.url as string | undefined;

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  const linkedInAccessToken = await getLinkedInAccessToken(
    auth.supabase,
    auth.user.id
  );

  const parsed = await parseJobFromUrl(url, { linkedInAccessToken });
  const isLinkedIn = isLinkedInJobUrl(url);

  if (parsed.parseError) {
    const requiresLinkedInAuth = Boolean(parsed.requiresLinkedInAuth);
    return NextResponse.json(
      {
        error: parsed.parseError,
        requiresLinkedInAuth,
        isLinkedIn,
        linkedInAuthUrl:
          requiresLinkedInAuth && isLinkedInOAuthConfigured()
            ? linkedInAuthStartUrl(url)
            : undefined,
        linkedInConfigured: isLinkedInOAuthConfigured(),
        ...parsed,
      },
      { status: 422 }
    );
  }

  return NextResponse.json({
    ...parsed,
    isLinkedIn,
    linkedInConnected: Boolean(linkedInAccessToken),
  });
}
