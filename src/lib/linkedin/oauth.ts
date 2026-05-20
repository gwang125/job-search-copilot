import { createHmac, timingSafeEqual } from "crypto";

export interface LinkedInOAuthState {
  userId: string;
  jobUrl?: string;
  returnPath?: string;
  exp: number;
}

function oauthSecret(): string {
  const secret =
    process.env.LINKEDIN_CLIENT_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("LINKEDIN_CLIENT_SECRET is not configured");
  }
  return secret;
}

export function isLinkedInOAuthConfigured(): boolean {
  return Boolean(
    process.env.LINKEDIN_CLIENT_ID &&
      process.env.LINKEDIN_CLIENT_SECRET &&
      process.env.NEXT_PUBLIC_APP_URL
  );
}

export function buildLinkedInAuthorizationUrl(state: string): string {
  const clientId = process.env.LINKEDIN_CLIENT_ID!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL!.replace(/\/$/, "")}/api/auth/linkedin/callback`;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: "openid profile email",
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

export function createLinkedInOAuthState(
  payload: Omit<LinkedInOAuthState, "exp">
): string {
  const data: LinkedInOAuthState = {
    ...payload,
    exp: Date.now() + 10 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = createHmac("sha256", oauthSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function parseLinkedInOAuthState(
  state: string
): LinkedInOAuthState | null {
  try {
    const [encoded, sig] = state.split(".");
    if (!encoded || !sig) return null;

    const expected = createHmac("sha256", oauthSecret())
      .update(encoded)
      .digest("base64url");

    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const data = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as LinkedInOAuthState;

    if (!data.userId || !data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export async function exchangeLinkedInCode(code: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL!.replace(/\/$/, "")}/api/auth/linkedin/callback`;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
  });

  const response = await fetch(
    "https://www.linkedin.com/oauth/v2/accessToken",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LinkedIn token exchange failed: ${text.slice(0, 200)}`);
  }

  return response.json();
}

export function linkedInAuthStartUrl(jobUrl?: string): string {
  const params = new URLSearchParams();
  if (jobUrl) params.set("jobUrl", jobUrl);
  const qs = params.toString();
  return `/api/auth/linkedin${qs ? `?${qs}` : ""}`;
}
