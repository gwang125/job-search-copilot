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
  filterListingsExcludingDismissed,
  type JobSearchDismissalRow,
} from "@/lib/jobs/dismissed-job-exclusions";
import {
  buildJobSearchQueryFromPreferences,
  listingFailsQuickExclusion,
} from "@/lib/jobs/build-job-search-query";
import {
  partitionJobsByPreferences,
  type JobForPreferenceFilter,
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

const LINKEDIN_PAGE_SIZE = 25;
const MAX_PAGES = 5;
const MAX_CANDIDATES_TO_INSPECT = 50;

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

function resolveSearchWorkType(
  formWorkType: LinkedInWorkType,
  preferences: JobSearchPreferences
): LinkedInWorkType {
  if (formWorkType !== "any") return formWorkType;
  if (preferences.remote_only) return "remote";
  return "any";
}

export async function discoverMatchingLinkedInJobs(
  profile: Profile,
  resume: Resume,
  input: DiscoverJobsInput,
  preferences: JobSearchPreferences,
  appliedApplications: AppliedApplicationRow[] = [],
  dismissedJobs: JobSearchDismissalRow[] = []
): Promise<{
  listingsFound: number;
  candidatesChecked: number;
  hiddenByApplied: number;
  hiddenByNotConsider: number;
  hiddenByPreferences: number;
  searchQueryReason: string;
  jobsShown: number;
  preferenceExclusions: Array<{
    linkedInJobId: string;
    title: string;
    exclusionReasons: string[];
  }>;
  jobs: DiscoveredJobMatch[];
}> {
  const targetVisibleJobs = Math.min(Math.max(input.limit ?? 10, 5), 25);
  /** Collect extra hard-pass jobs so enough survive AI + min match % */
  const targetHardPassJobs = Math.min(targetVisibleJobs * 2, 25);
  const minMatchScore = input.minMatchScore ?? 55;
  const formWorkType = input.workType ?? "any";
  const searchWorkType = resolveSearchWorkType(formWorkType, preferences);

  const queryPlan = buildJobSearchQueryFromPreferences({
    keyword: input.keywords,
    location: input.location,
    workType: searchWorkType,
    targetJobTitles: profile.target_job_titles ?? [],
    preferences,
  });

  const seenJobIds = new Set<string>();
  const validJobs: Array<{
    listing: LinkedInJobListing;
    description: string;
  }> = [];

  let candidatesChecked = 0;
  let hiddenByApplied = 0;
  let hiddenByNotConsider = 0;
  let hiddenByPreferences = 0;
  let listingsFound = 0;
  const preferenceExclusions: Array<{
    linkedInJobId: string;
    title: string;
    exclusionReasons: string[];
  }> = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    if (validJobs.length >= targetHardPassJobs) break;
    if (candidatesChecked >= MAX_CANDIDATES_TO_INSPECT) break;

    const keyword =
      queryPlan.searchKeywords[page % queryPlan.searchKeywords.length] ??
      input.keywords.trim();
    const start = page * LINKEDIN_PAGE_SIZE;

    const batch = await searchLinkedInJobs({
      keywords: keyword,
      location: queryPlan.searchLocation ?? input.location,
      postedWithin: input.postedWithin ?? "any",
      workType: searchWorkType,
      start,
    });

    listingsFound += batch.length;

    const newListings: LinkedInJobListing[] = [];
    for (const listing of batch) {
      if (seenJobIds.has(listing.linkedInJobId)) continue;
      seenJobIds.add(listing.linkedInJobId);
      newListings.push(listing);
      candidatesChecked++;
      if (candidatesChecked >= MAX_CANDIDATES_TO_INSPECT) break;
    }

    const { remaining: afterApplied, hiddenCount: appliedHidden } =
      filterListingsExcludingApplied(newListings, appliedApplications);
    hiddenByApplied += appliedHidden;

    const { remaining: afterDismissed, hiddenCount: dismissedHidden } =
      filterListingsExcludingDismissed(afterApplied, dismissedJobs);
    hiddenByNotConsider += dismissedHidden;

    const afterQuickExclusion: LinkedInJobListing[] = [];
    for (const listing of afterDismissed) {
      if (
        listingFailsQuickExclusion(listing, queryPlan.excludedTerms)
      ) {
        hiddenByPreferences++;
        if (preferenceExclusions.length < 25) {
          preferenceExclusions.push({
            linkedInJobId: listing.linkedInJobId,
            title: listing.title,
            exclusionReasons: ["Quick exclusion: title/company/location"],
          });
        }
        continue;
      }
      afterQuickExclusion.push(listing);
    }

    if (afterQuickExclusion.length === 0) continue;

    const jobsWithDescriptions = await mapWithConcurrency(
      afterQuickExclusion,
      4,
      async (listing) => {
        const description = await fetchDescriptionSnippet(listing);
        return { listing, description };
      }
    );

    const forPreferenceFilter: JobForPreferenceFilter[] =
      jobsWithDescriptions.map(({ listing, description }) => ({
        id: listing.linkedInJobId,
        title: listing.title,
        company: listing.company,
        location: listing.location,
        description,
      }));

    const { passed, filtered, hiddenCount } = partitionJobsByPreferences(
      forPreferenceFilter,
      preferences
    );
    hiddenByPreferences += hiddenCount;

    for (const result of filtered) {
      if (preferenceExclusions.length >= 25) break;
      preferenceExclusions.push({
        linkedInJobId: result.job.id,
        title: result.job.title,
        exclusionReasons: result.exclusionReasons,
      });
    }

    const listingById = new Map(
      jobsWithDescriptions.map(
        ({ listing }) => [listing.linkedInJobId, listing] as const
      )
    );

    for (const job of passed) {
      if (validJobs.length >= targetHardPassJobs) break;
      const listing = listingById.get(job.id);
      if (!listing) continue;
      validJobs.push({ listing, description: job.description });
    }
  }

  const forScoring: JobForDiscoveryScore[] = validJobs.map(
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

    jobs = validJobs
      .map(({ listing }) => {
        const scored = scoreById.get(listing.linkedInJobId);
        return {
          linkedInJobId: listing.linkedInJobId,
          title: listing.title,
          company: listing.company,
          location: listing.location,
          jobUrl: listing.jobUrl,
          postedText: listing.postedText,
          matchScore: scored?.matchScore ?? 0,
          matchNote: scored?.note ?? "",
        };
      })
      .filter((j) => j.matchScore >= minMatchScore)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, targetVisibleJobs);
  }

  return {
    listingsFound,
    candidatesChecked,
    hiddenByApplied,
    hiddenByNotConsider,
    hiddenByPreferences,
    searchQueryReason: queryPlan.reason,
    jobsShown: jobs.length,
    preferenceExclusions,
    jobs,
  };
}
