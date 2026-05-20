import { extractLinkedInJobId } from "@/lib/linkedin/url";
import type { LinkedInJobListing } from "@/lib/linkedin/search-jobs";

export interface JobSearchDismissalRow {
  linkedin_job_id: string;
  job_url: string | null;
  job_title?: string | null;
  company?: string | null;
}

function normalizeUrl(url: string): string {
  try {
    const id = extractLinkedInJobId(url);
    if (id) return `linkedin:${id}`;
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`.toLowerCase().replace(/\/$/, "");
  } catch {
    return url.toLowerCase().trim();
  }
}

export function buildDismissalIndex(
  dismissals: JobSearchDismissalRow[] | null | undefined
): {
  jobIds: Set<string>;
  urlKeys: Set<string>;
} {
  const jobIds = new Set<string>();
  const urlKeys = new Set<string>();

  for (const row of dismissals ?? []) {
    const id = row.linkedin_job_id?.trim();
    if (id) jobIds.add(id);
    if (row.job_url?.trim()) {
      urlKeys.add(normalizeUrl(row.job_url.trim()));
    }
  }

  return { jobIds, urlKeys };
}

export function listingMatchesDismissal(
  listing: LinkedInJobListing,
  index: ReturnType<typeof buildDismissalIndex>
): boolean {
  if (index.jobIds.has(listing.linkedInJobId)) return true;
  return index.urlKeys.has(normalizeUrl(listing.jobUrl));
}

export function filterListingsExcludingDismissed(
  listings: LinkedInJobListing[],
  dismissals: JobSearchDismissalRow[] | null | undefined
): {
  remaining: LinkedInJobListing[];
  hiddenCount: number;
} {
  const index = buildDismissalIndex(dismissals);
  if (index.jobIds.size === 0 && index.urlKeys.size === 0) {
    return { remaining: listings, hiddenCount: 0 };
  }

  const remaining: LinkedInJobListing[] = [];
  let hiddenCount = 0;

  for (const listing of listings) {
    if (listingMatchesDismissal(listing, index)) {
      hiddenCount++;
    } else {
      remaining.push(listing);
    }
  }

  return { remaining, hiddenCount };
}
