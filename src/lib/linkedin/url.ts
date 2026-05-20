const LINKEDIN_HOST = "linkedin.com";

export function isLinkedInJobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.replace(/^www\./, "").endsWith(LINKEDIN_HOST)) {
      return false;
    }
    return (
      parsed.pathname.includes("/jobs/") ||
      parsed.searchParams.has("currentJobId")
    );
  } catch {
    return false;
  }
}

/** Extract numeric job ID from common LinkedIn job URL shapes. */
export function extractLinkedInJobId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const fromQuery = parsed.searchParams.get("currentJobId");
    if (fromQuery && /^\d+$/.test(fromQuery)) return fromQuery;

    const viewMatch = parsed.pathname.match(
      /\/jobs\/view\/(?:[^/?#]+-)?(\d{6,})(?:\/|$|\?)/i
    );
    if (viewMatch?.[1]) return viewMatch[1];

    const trailingId = parsed.pathname.match(/(\d{8,})(?:\/|$)/);
    if (trailingId?.[1]) return trailingId[1];

    return null;
  } catch {
    return null;
  }
}

export function looksLikeLinkedInLoginWall(html: string, text: string): boolean {
  const lower = `${html} ${text}`.toLowerCase();
  return (
    lower.includes("authwall") ||
    lower.includes("join linkedin") ||
    lower.includes("sign in to linkedin") ||
    lower.includes('name="session_key"') ||
    (lower.includes("sign in") && lower.includes("linkedin"))
  );
}
