import { getOpenAIClient, OPENAI_MODEL } from "@/lib/openai/client";
import {
  buildJobDiscoveryScorePrompt,
  JOB_DISCOVERY_SCORE_SYSTEM,
  type JobForDiscoveryScore,
} from "@/lib/openai/prompts";
import { parseLinkedInJobViaGuestApi } from "@/lib/linkedin/guest-api";
import {
  searchLinkedInJobs,
  type LinkedInJobListing,
  type LinkedInPostedWithin,
  type LinkedInWorkType,
} from "@/lib/linkedin/search-jobs";
import {
  filterListingsExcludingApplied,
  type AppliedApplicationRow,
} from "@/lib/jobs/applied-job-exclusions";
import {
  partitionJobsByPreferences,
  type JobForPreferenceFilter,
  type JobPreferenceFilterResult,
} from "@/lib/jobs/filter-jobs-by-preferences";
import type { JobSearchPreferences, Profile, Resume } from "@/types/database";

export interface DiscoverJobsInput {
  keywords: string;
  location?: string;
  postedWithin?: LinkedInPostedWithin;
  workType?: LinkedInWorkType;
  minMatchScore?: number;
  limit?: number;
}

export interface DiscoveredJobMatch {
  linkedInJobId: string;
  title: string;
  company: string | null;
  location: string | null;
  jobUrl: string;
  postedText: string | null;
  matchScore: number;
  matchNote: string;
}

async function fetchDescriptionSnippet(
  listing: LinkedInJobListing
): Promise<string> {
  const parsed = await parseLinkedInJobViaGuestApi(listing.linkedInJobId);
  if (parsed?.jobDescription && parsed.jobDescription.length >= 80) {
    return parsed.jobDescription.slice(0, 2500);
  }
  return [
    listing.title,
    listing.company,
    listing.location,
    parsed?.jobTitle,
    parsed?.jobDescription,
  ]
    .filter(Boolean)
    .join(" — ")
    .slice(0, 500);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

export async function discoverMatchingLinkedInJobs(
  profile: Profile,
  resume: Resume,
  input: DiscoverJobsInput,
  preferences: JobSearchPreferences,
  appliedApplications: AppliedApplicationRow[] = []
): Promise<{
  listingsFound: number;
  hiddenByApplied: number;
  scannedForPreferences: number;
  hiddenByPreferences: number;
  /** Excluded jobs with reasons (not shown in UI; for logging / future debug) */
  preferenceExclusions: Array<{
    linkedInJobId: string;
    title: string;
    exclusionReasons: string[];
  }>;
  jobs: DiscoveredJobMatch[];
}> {
  const limit = Math.min(Math.max(input.limit ?? 15, 5), 25);
  const minMatchScore = input.minMatchScore ?? 55;

  const listings = await searchLinkedInJobs({
    keywords: input.keywords,
    location: input.location,
    postedWithin: input.postedWithin ?? "any",
    workType: input.workType ?? "any",
    start: 0,
  });

  const { remaining: listingsToProcess, hiddenCount: hiddenByApplied } =
    filterListingsExcludingApplied(listings, appliedApplications);

  const jobsWithDescriptions = await mapWithConcurrency(
    listingsToProcess,
    4,
    async (listing) => {
      const description = await fetchDescriptionSnippet(listing);
      return { listing, description };
    }
  );

  const forPreferenceFilter: JobForPreferenceFilter[] = jobsWithDescriptions.map(
    ({ listing, description }) => ({
      id: listing.linkedInJobId,
      title: listing.title,
      company: listing.company,
      location: listing.location,
      description,
    })
  );

  const { passed, filtered, hiddenCount } = partitionJobsByPreferences(
    forPreferenceFilter,
    preferences
  );

  const preferenceExclusions = filtered
    .slice(0, 25)
    .map((r: JobPreferenceFilterResult) => ({
      linkedInJobId: r.job.id,
      title: r.job.title,
      exclusionReasons: r.exclusionReasons,
    }));

  const listingById = new Map(
    listingsToProcess.map((l) => [l.linkedInJobId, l] as const)
  );

  const candidates = passed.slice(0, limit).map((job) => {
    const listing = listingById.get(job.id)!;
    return {
      listing,
      description: job.description,
    };
  });

  const forScoring: JobForDiscoveryScore[] = candidates.map(
    ({ listing, description }) => ({
      id: listing.linkedInJobId,
      title: listing.title,
      company: listing.company,
      location: listing.location,
      description,
    })
  );

  let jobs: DiscoveredJobMatch[] = [];

  if (forScoring.length > 0) {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: JOB_DISCOVERY_SCORE_SYSTEM },
        {
          role: "user",
          content: buildJobDiscoveryScorePrompt(profile, resume, forScoring),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("Empty AI response while scoring jobs");

    let scores: Array<{ jobId: string; matchScore: number; note: string }> = [];
    try {
      const parsed = JSON.parse(raw) as {
        scores?: Array<{ jobId: string; matchScore: number; note?: string }>;
      };
      scores = (parsed.scores ?? []).map((s) => ({
        jobId: s.jobId,
        matchScore: Math.min(100, Math.max(0, Math.round(s.matchScore))),
        note: s.note?.trim() ?? "",
      }));
    } catch {
      throw new Error("Invalid AI response while scoring jobs");
    }

    const scoreById = new Map(scores.map((s) => [s.jobId, s]));

    jobs = candidates
      .map(({ listing }) => {
        const scored = scoreById.get(listing.linkedInJobId);
        return {
          ...listing,
          matchScore: scored?.matchScore ?? 0,
          matchNote: scored?.note ?? "",
        };
      })
      .filter((j) => j.matchScore >= minMatchScore)
      .sort((a, b) => b.matchScore - a.matchScore);
  }

  return {
    listingsFound: listings.length,
    hiddenByApplied,
    scannedForPreferences: forPreferenceFilter.length,
    hiddenByPreferences: hiddenCount,
    preferenceExclusions,
    jobs,
  };
}
