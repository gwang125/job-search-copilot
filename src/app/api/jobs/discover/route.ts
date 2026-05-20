import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { discoverMatchingLinkedInJobs } from "@/lib/jobs/discover-jobs";
import { getJobSearchPreferences } from "@/lib/supabase/job-search-preferences";
import type { LinkedInPostedWithin, LinkedInWorkType } from "@/lib/linkedin/search-jobs";
import type { Resume } from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await request.json();
  const keywords = (body.keywords as string | undefined)?.trim();
  const location = (body.location as string | undefined)?.trim();
  const resumeId = body.resumeId as string | undefined;
  const postedWithin = (body.postedWithin as LinkedInPostedWithin) ?? "any";
  const workType = (body.workType as LinkedInWorkType) ?? "any";
  const minMatchScore =
    typeof body.minMatchScore === "number" ? body.minMatchScore : 55;
  const limit = typeof body.limit === "number" ? body.limit : 15;

  if (!keywords) {
    return NextResponse.json({ error: "Keywords are required" }, { status: 400 });
  }

  const [{ data: profile }, { data: resumes }, preferences, { data: applications }] =
    await Promise.all([
      auth.supabase.from("profiles").select("*").eq("id", auth.user.id).single(),
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
    ]);

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 400 });
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
      profile,
      resume,
      {
        keywords,
        location: location || undefined,
        postedWithin,
        workType,
        minMatchScore,
        limit,
      },
      preferences,
      applications ?? []
    );

    return NextResponse.json({
      resumeUsed: { id: resume.id, name: resume.name },
      listingsFound: result.listingsFound,
      hiddenByApplied: result.hiddenByApplied,
      scannedForPreferences: result.scannedForPreferences,
      hiddenByPreferences: result.hiddenByPreferences,
      preferenceExclusions: result.preferenceExclusions,
      jobs: result.jobs,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Job discovery failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
