import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveLinkedInConnection } from "@/lib/linkedin/connection";
import {
  exchangeLinkedInCode,
  isLinkedInOAuthConfigured,
  parseLinkedInOAuthState,
} from "@/lib/linkedin/oauth";

export async function GET(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const fallbackRedirect = `${appUrl}/job-analyzer`;

  if (!isLinkedInOAuthConfigured()) {
    return NextResponse.redirect(
      `${fallbackRedirect}?linkedin=error&reason=not_configured`
    );
  }

  const { searchParams } = new URL(request.url);
  const error = searchParams.get("error");
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");

  if (error || !code || !stateRaw) {
    return NextResponse.redirect(
      `${fallbackRedirect}?linkedin=error&reason=access_denied`
    );
  }

  const state = parseLinkedInOAuthState(stateRaw);
  if (!state) {
    return NextResponse.redirect(
      `${fallbackRedirect}?linkedin=error&reason=invalid_state`
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== state.userId) {
    return NextResponse.redirect(
      `${appUrl}/login?next=${encodeURIComponent("/job-analyzer")}`
    );
  }

  try {
    const token = await exchangeLinkedInCode(code);
    await saveLinkedInConnection(
      supabase,
      user.id,
      token.access_token,
      token.expires_in
    );
  } catch {
    return NextResponse.redirect(
      `${fallbackRedirect}?linkedin=error&reason=token_exchange`
    );
  }

  const returnPath = state.returnPath ?? "/job-analyzer";
  const redirectParams = new URLSearchParams({ linkedin: "connected" });
  if (state.jobUrl) redirectParams.set("jobUrl", state.jobUrl);

  return NextResponse.redirect(
    `${appUrl}${returnPath}?${redirectParams.toString()}`
  );
}
