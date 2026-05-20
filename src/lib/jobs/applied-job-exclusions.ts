import { extractLinkedInJobId } from "@/lib/linkedin/url";
import type { LinkedInJobListing } from "@/lib/linkedin/search-jobs";
import {
  normalizeCompany,
  resolveJobRelation,
  type JobSummary,
} from "@/lib/utils";

export interface AppliedJobSnapshot {
  company: string | null;
  jobTitle: string | null;
  linkedInJobId: string | null;
  jobUrl: string | null;
}

export type AppliedApplicationRow = {
  status: string;
  job?: (JobSummary & { job_url?: string | null }) | (JobSummary & {
    job_url?: string | null;
  })[] | null;
};

export interface AppliedExclusionIndex {
  snapshots: AppliedJobSnapshot[];
  /** Normalized company names from any `applied` application */
  appliedCompanies: Set<string>;
}

/** Build index from applications with status `applied` */
export function buildAppliedExclusionIndex(
  applications: AppliedApplicationRow[] | null | undefined
): AppliedExclusionIndex {
  const snapshots = buildAppliedJobSnapshots(applications);
  const appliedCompanies = new Set<string>();

  for (const snap of snapshots) {
    const key = normalizeCompany(snap.company);
    if (key) appliedCompanies.add(key);
  }

  return { snapshots, appliedCompanies };
}

export function buildAppliedJobSnapshots(
  applications: AppliedApplicationRow[] | null | undefined
): AppliedJobSnapshot[] {
  if (!applications?.length) return [];

  return applications
    .filter((app) => app.status === "applied")
    .map((app) => {
      const job = resolveJobRelation(app.job);
      if (!job) return null;
      const jobUrl = job.job_url ?? null;
      return {
        company: job.company,
        jobTitle: job.job_title,
        linkedInJobId: jobUrl ? extractLinkedInJobId(jobUrl) : null,
        jobUrl,
      };
    })
    .filter((s): s is AppliedJobSnapshot => s !== null);
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

export function listingMatchesAppliedJob(
  listing: LinkedInJobListing,
  index: AppliedExclusionIndex
): boolean {
  const { snapshots, appliedCompanies } = index;
  if (!snapshots.length) return false;

  const listingCompany = normalizeCompany(listing.company);
  if (listingCompany && appliedCompanies.has(listingCompany)) {
    return true;
  }

  const listingUrlKey = normalizeUrl(listing.jobUrl);

  for (const snap of snapshots) {
    if (snap.linkedInJobId && snap.linkedInJobId === listing.linkedInJobId) {
      return true;
    }

    if (snap.jobUrl && normalizeUrl(snap.jobUrl) === listingUrlKey) {
      return true;
    }
  }

  return false;
}

export function filterListingsExcludingApplied(
  listings: LinkedInJobListing[],
  applications: AppliedApplicationRow[] | null | undefined
): {
  remaining: LinkedInJobListing[];
  hiddenCount: number;
} {
  const index = buildAppliedExclusionIndex(applications);
  const remaining: LinkedInJobListing[] = [];
  let hiddenCount = 0;

  for (const listing of listings) {
    if (listingMatchesAppliedJob(listing, index)) {
      hiddenCount++;
    } else {
      remaining.push(listing);
    }
  }

  return { remaining, hiddenCount };
}
