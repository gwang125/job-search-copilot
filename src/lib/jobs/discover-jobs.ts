import { getOpenAIClient, OPENAI_MODEL } from "@/lib/openai/client";
import {
  buildJobDiscoveryScorePrompt,
  JOB_DISCOVERY_SCORE_SYSTEM,
  type JobForDiscoveryScore,
} from "@/lib/openai/prompts";
import { fetchFullLinkedInJobDescription } from "@/lib/linkedin/fetch-full-job-description";
import { isLinkedInHttpError } from "@/lib/linkedin/linkedin-http-errors";
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
  buildCombinedSearchQueryPlan,
  listingFailsQuickExclusion,
} from "@/lib/jobs/build-job-search-query";
import {
  partitionJobsByPreferences,
} from "@/lib/jobs/filter-jobs-by-preferences";
import type { JobSearchPreferences, Profile, Resume } from "@/types/database";

export interface DiscoverJobsInput {
  activeKeywords: string[];
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

function discoveryLimits(targetVisibleJobs: number) {
  return {
    /** Extra hard-pass jobs beyond visible count (for min match % drop-off) */
    targetHardPassJobs: Math.min(targetVisibleJobs + 5, 20),
    maxPagesPerKeyword: Math.min(4, Math.max(2, Math.ceil(targetVisibleJobs / 4))),
    maxCandidatesToInspect: Math.min(100, Math.max(25, targetVisibleJobs * 6)),
  };
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
  const { targetHardPassJobs, maxPagesPerKeyword, maxCandidatesToInspect } =
    discoveryLimits(targetVisibleJobs);
  const minMatchScore = input.minMatchScore ?? 55;
  const formWorkType = input.workType ?? "any";
  const searchWorkType = resolveSearchWorkType(formWorkType, preferences);

  const queryPlan = buildCombinedSearchQueryPlan(input.activeKeywords, {
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

  for (const keyword of queryPlan.searchKeywords) {
    if (validJobs.length >= targetHardPassJobs) break;
    if (candidatesChecked >= maxCandidatesToInspect) break;

    for (let page = 0; page < maxPagesPerKeyword; page++) {
      if (validJobs.length >= targetHardPassJobs) break;
      if (candidatesChecked >= maxCandidatesToInspect) break;

      const start = page * LINKEDIN_PAGE_SIZE;

      let batch;
      try {
        batch = await searchLinkedInJobs({
          keywords: keyword,
          location: queryPlan.searchLocation ?? input.location,
          postedWithin: input.postedWithin ?? "any",
          workType: searchWorkType,
          start,
        });
      } catch (error) {
        const pageNum = page + 1;
        const locationLabel =
          queryPlan.searchLocation ?? input.location ?? "any location";
        if (isLinkedInHttpError(error)) {
          throw new Error(
            `${error.message}\n\nContext: keyword "${keyword}", page ${pageNum}, location "${locationLabel}".`
          );
        }
        throw error;
      }

      if (batch.length === 0) break;

      listingsFound += batch.length;

    const newListings: LinkedInJobListing[] = [];
    for (const listing of batch) {
      if (seenJobIds.has(listing.linkedInJobId)) continue;
      seenJobIds.add(listing.linkedInJobId);
      newListings.push(listing);
      candidatesChecked++;
      if (candidatesChecked >= maxCandidatesToInspect) break;
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

    for (const listing of afterQuickExclusion) {
      if (validJobs.length >= targetHardPassJobs) break;
      if (candidatesChecked >= maxCandidatesToInspect) break;

      const description = await fetchFullLinkedInJobDescription(
        listing.linkedInJobId
      );

      if (!description) {
        hiddenByPreferences++;
        if (preferenceExclusions.length < 25) {
          preferenceExclusions.push({
            linkedInJobId: listing.linkedInJobId,
            title: listing.title,
            exclusionReasons: ["Could not load full job description"],
          });
        }
        continue;
      }

      const { passed, filtered, hiddenCount } = partitionJobsByPreferences(
        [
          {
            id: listing.linkedInJobId,
            title: listing.title,
            company: listing.company,
            location: listing.location,
            description,
          },
        ],
        preferences
      );
      hiddenByPreferences += hiddenCount;

      if (passed.length > 0) {
        validJobs.push({ listing, description });
        continue;
      }

      if (filtered.length > 0 && preferenceExclusions.length < 25) {
        preferenceExclusions.push({
          linkedInJobId: listing.linkedInJobId,
          title: listing.title,
          exclusionReasons: filtered[0].exclusionReasons,
        });
      }
    }
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
