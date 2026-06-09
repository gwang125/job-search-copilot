import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { discoverMatchingLinkedInJobs } from "@/lib/jobs/discover-jobs";
import { getJobSearchPreferences, getActiveSearchKeywords } from "@/lib/supabase/job-search-preferences";
import type { LinkedInPostedWithin, LinkedInWorkType } from "@/lib/linkedin/search-jobs";
import type { Resume } from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 180;

const POSTED_WITHIN_VALUES = new Set<LinkedInPostedWithin>([
  "any",
  "24h",
  "week",
  "month",
]);
const WORK_TYPE_VALUES = new Set<LinkedInWorkType>([
  "any",
  "remote",
  "hybrid",
  "onsite",
]);

function parseEnum<T extends string>(
  value: unknown,
  allowed: Set<T>,
  fallback: T
): T {
  return typeof value === "string" && allowed.has(value as T)
    ? (value as T)
    : fallback;
}

function parseBoundedInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : fallback;
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const location = (body.location as string | undefined)?.trim();
  const resumeId = body.resumeId as string | undefined;
  const postedWithin = parseEnum(
    body.postedWithin,
    POSTED_WITHIN_VALUES,
    "any"
  );
  const workType = parseEnum(body.workType, WORK_TYPE_VALUES, "any");
  const minMatchScore = parseBoundedInteger(body.minMatchScore, 55, 0, 100);
  const limit = parseBoundedInteger(body.limit, 5, 5, 10);
  const candidateLimit = parseBoundedInteger(body.candidateLimit, 40, 12, 80);

  const [
    { data: resumes },
    preferences,
    { data: applications },
    { data: dismissals },
  ] = await Promise.all([
    auth.supabase
      .from("resumes")
      .select("*")
      .eq("user_id", auth.user.id)
      .order("is_primary", { ascending: false }),
    getJobSearchPreferences(auth.supabase, auth.user.id),
    auth.supabase
      .from("applications")
      .select("id, status, job:jobs(company, job_title, job_url)")
      .eq("user_id", auth.user.id),
    auth.supabase
      .from("job_search_dismissals")
      .select("linkedin_job_id, job_url, job_title, company")
      .eq("user_id", auth.user.id),
  ]);

  const activeKeywords = getActiveSearchKeywords(preferences);
  if (activeKeywords.length === 0) {
    return NextResponse.json(
      {
        error:
          "No active search keywords. Add and activate keywords on your Profile, then save.",
      },
      { status: 400 }
    );
  }

  if (!resumes?.length) {
    return NextResponse.json(
      { error: "Upload at least one resume before searching for jobs" },
      { status: 400 }
    );
  }

  let resume: Resume | undefined;
  if (resumeId) {
    resume = resumes.find((r) => r.id === resumeId) as Resume | undefined;
    if (!resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }
  } else {
    resume = (resumes.find((r) => r.is_primary) ?? resumes[0]) as Resume;
  }

  try {
    const result = await discoverMatchingLinkedInJobs(
      resume,
      {
        activeKeywords,
        location: location || undefined,
        postedWithin,
        workType,
        minMatchScore,
        limit,
        candidateLimit,
      },
      preferences,
      applications ?? [],
      dismissals ?? []
    );

    return NextResponse.json({
      resumeUsed: { id: resume.id, name: resume.name },
      listingsFound: result.listingsFound,
      candidatesChecked: result.candidatesChecked,
      hiddenByApplied: result.hiddenByApplied,
      hiddenByNotConsider: result.hiddenByNotConsider,
      hiddenByPreferences: result.hiddenByPreferences,
      jobsShown: result.jobsShown,
      searchQueryReason: result.searchQueryReason,
      activeKeywords,
      preferenceExclusions: result.preferenceExclusions,
      jobs: result.jobs,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Job discovery failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
