import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";

function buildJobDescriptionPlaceholder(input: {
  jobTitle: string | null;
  company: string | null;
  location: string | null;
  jobUrl: string | null;
}): string {
  const lines = [
    "Recorded from Find Jobs (marked as applied).",
    "",
    input.jobTitle ? `Title: ${input.jobTitle}` : null,
    input.company ? `Company: ${input.company}` : null,
    input.location ? `Location: ${input.location}` : null,
    input.jobUrl ? `URL: ${input.jobUrl}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await request.json();
  const jobUrl = (body.jobUrl as string | undefined)?.trim() || null;
  const jobTitle = (body.jobTitle as string | undefined)?.trim() || null;
  const company = (body.company as string | undefined)?.trim() || null;
  const location = (body.location as string | undefined)?.trim() || null;
  const matchScore =
    typeof body.matchScore === "number"
      ? Math.min(100, Math.max(0, Math.round(body.matchScore)))
      : null;
  const resumeId = body.resumeId as string | undefined;

  if (!jobUrl && !jobTitle) {
    return NextResponse.json(
      { error: "Job title or URL is required" },
      { status: 400 }
    );
  }

  const { data: resumes } = await auth.supabase
    .from("resumes")
    .select("id, is_primary")
    .eq("user_id", auth.user.id);

  if (!resumes?.length) {
    return NextResponse.json(
      { error: "Upload at least one resume before tracking applications" },
      { status: 400 }
    );
  }

  let bestResumeId = resumeId;
  if (bestResumeId && !resumes.some((r) => r.id === bestResumeId)) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }
  if (!bestResumeId) {
    bestResumeId =
      resumes.find((r) => r.is_primary)?.id ?? resumes[0]?.id ?? null;
  }

  const description = buildJobDescriptionPlaceholder({
    jobTitle,
    company,
    location,
    jobUrl,
  });

  let jobId: string | undefined;

  if (jobUrl) {
    const { data: existingJob } = await auth.supabase
      .from("jobs")
      .select("id")
      .eq("user_id", auth.user.id)
      .eq("job_url", jobUrl)
      .maybeSingle();

    if (existingJob?.id) {
      jobId = existingJob.id;
      await auth.supabase
        .from("jobs")
        .update({
          company,
          job_title: jobTitle,
          location,
          job_description: description,
        })
        .eq("id", jobId)
        .eq("user_id", auth.user.id);
    }
  }

  if (!jobId) {
    const { data: job, error: jobError } = await auth.supabase
      .from("jobs")
      .insert({
        user_id: auth.user.id,
        company,
        job_title: jobTitle,
        location,
        job_url: jobUrl,
        job_description: description,
      })
      .select("id")
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: jobError?.message ?? "Failed to save job" },
        { status: 500 }
      );
    }
    jobId = job.id;
  }

  const appliedDate = new Date().toISOString().slice(0, 10);

  const { data: application, error: appError } = await auth.supabase
    .from("applications")
    .upsert(
      {
        user_id: auth.user.id,
        job_id: jobId,
        best_resume_id: bestResumeId,
        match_score: matchScore,
        status: "applied",
        applied_date: appliedDate,
      },
      { onConflict: "user_id,job_id" }
    )
    .select("id, status")
    .single();

  if (appError || !application) {
    return NextResponse.json(
      { error: appError?.message ?? "Failed to save application" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    jobId,
    applicationId: application.id,
    status: application.status,
  });
}
