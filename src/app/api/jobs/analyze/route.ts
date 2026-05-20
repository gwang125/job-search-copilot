import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { getOpenAIClient, OPENAI_MODEL } from "@/lib/openai/client";
import {
  MATCH_ANALYSIS_SYSTEM,
  buildMatchAnalysisPrompt,
} from "@/lib/openai/prompts";
import type { JobMatchAnalysis, Profile, Resume } from "@/types/database";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await request.json();
  const {
    jobDescription,
    company,
    jobTitle,
    location,
    jobUrl,
    jobId: existingJobId,
  } = body;

  if (!jobDescription?.trim()) {
    return NextResponse.json(
      { error: "Job description is required" },
      { status: 400 }
    );
  }

  const { data: resumes } = await auth.supabase
    .from("resumes")
    .select("*")
    .eq("user_id", auth.user.id);

  if (!resumes?.length) {
    return NextResponse.json(
      { error: "Add at least one resume before analyzing jobs" },
      { status: 400 }
    );
  }

  const { data: profile } = await auth.supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 400 });
  }

  let jobId = existingJobId as string | undefined;

  if (jobId) {
    await auth.supabase
      .from("jobs")
      .update({
        company: company ?? null,
        job_title: jobTitle ?? null,
        location: location ?? null,
        job_url: jobUrl ?? null,
        job_description: jobDescription.trim(),
      })
      .eq("id", jobId)
      .eq("user_id", auth.user.id);
  } else {
    const { data: job, error: jobError } = await auth.supabase
      .from("jobs")
      .insert({
        user_id: auth.user.id,
        company: company ?? null,
        job_title: jobTitle ?? null,
        location: location ?? null,
        job_url: jobUrl ?? null,
        job_description: jobDescription.trim(),
      })
      .select()
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: jobError?.message ?? "Failed to save job" },
        { status: 500 }
      );
    }
    jobId = job.id;
  }

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: MATCH_ANALYSIS_SYSTEM },
      {
        role: "user",
        content: buildMatchAnalysisPrompt(
          profile as Profile,
          resumes as Resume[],
          jobDescription.trim(),
          company ?? null,
          jobTitle ?? null
        ),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    return NextResponse.json({ error: "Empty AI response" }, { status: 500 });
  }

  let analysis: JobMatchAnalysis;
  try {
    analysis = JSON.parse(raw) as JobMatchAnalysis;
  } catch {
    return NextResponse.json({ error: "Invalid AI response" }, { status: 500 });
  }

  const validResumeIds = new Set(resumes.map((r) => r.id));
  if (!validResumeIds.has(analysis.bestResumeId)) {
    const primary = resumes.find((r) => r.is_primary) ?? resumes[0];
    analysis.bestResumeId = primary.id;
  }

  if (Array.isArray(analysis.resumeScores)) {
    analysis.resumeScores = analysis.resumeScores
      .filter((row) => validResumeIds.has(row.resumeId))
      .sort((a, b) => b.score - a.score);
  } else {
    analysis.resumeScores = resumes.map((r) => ({
      resumeId: r.id,
      score: r.id === analysis.bestResumeId ? analysis.matchScore : 0,
      note: r.id === analysis.bestResumeId ? "Recommended for this role" : "",
    }));
  }

  if (
    analysis.resumeScores.length > 0 &&
    analysis.resumeScores[0].resumeId !== analysis.bestResumeId
  ) {
    analysis.bestResumeId = analysis.resumeScores[0].resumeId;
  }

  const { data: application, error: appError } = await auth.supabase
    .from("applications")
    .upsert(
      {
        user_id: auth.user.id,
        job_id: jobId,
        best_resume_id: analysis.bestResumeId,
        match_score: analysis.matchScore,
        status: "saved",
      },
      { onConflict: "user_id,job_id" }
    )
    .select()
    .single();

  if (appError) {
    return NextResponse.json({ error: appError.message }, { status: 500 });
  }

  const { data: aiAnalysis, error: analysisError } = await auth.supabase
    .from("ai_analyses")
    .insert({
      user_id: auth.user.id,
      job_id: jobId,
      application_id: application.id,
      match_score: analysis.matchScore,
      best_resume_id: analysis.bestResumeId,
      reasons: analysis.reasons,
      matched_skills: analysis.matchedSkills,
      missing_skills: analysis.missingSkills,
      risks: analysis.risks,
      recommendation: analysis.recommendation,
      suggested_changes: analysis.suggestedChanges,
      raw_response: analysis as unknown as Record<string, unknown>,
    })
    .select()
    .single();

  if (analysisError) {
    return NextResponse.json({ error: analysisError.message }, { status: 500 });
  }

  return NextResponse.json({
    jobId,
    application,
    analysis: aiAnalysis,
    matchAnalysis: analysis,
  });
}
