import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { getOpenAIClient, OPENAI_MODEL } from "@/lib/openai/client";
import {
  TAILOR_RESUME_SYSTEM,
  buildTailorResumePrompt,
} from "@/lib/openai/prompts";
import type { Profile, Resume, TailoredResumeContent } from "@/types/database";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { jobId, resumeId, applicationId, suggestedChanges } =
    await request.json();

  if (!jobId || !resumeId) {
    return NextResponse.json(
      { error: "jobId and resumeId are required" },
      { status: 400 }
    );
  }

  const [{ data: job }, { data: profile }, { data: resume }] = await Promise.all([
    auth.supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", auth.user.id)
      .single(),
    auth.supabase.from("profiles").select("*").eq("id", auth.user.id).single(),
    auth.supabase
      .from("resumes")
      .select("*")
      .eq("id", resumeId)
      .eq("user_id", auth.user.id)
      .single(),
  ]);

  if (!job || !profile || !resume) {
    return NextResponse.json({ error: "Missing job, profile, or resume" }, { status: 404 });
  }

  const hints: string[] = Array.isArray(suggestedChanges)
    ? suggestedChanges
    : [];

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: TAILOR_RESUME_SYSTEM },
      {
        role: "user",
        content: buildTailorResumePrompt(
          profile as Profile,
          resume as Resume,
          job.job_description,
          job.company,
          job.job_title,
          hints
        ),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    return NextResponse.json({ error: "Empty AI response" }, { status: 500 });
  }

  let content: TailoredResumeContent;
  try {
    content = JSON.parse(raw) as TailoredResumeContent;
  } catch {
    return NextResponse.json({ error: "Invalid AI response" }, { status: 500 });
  }

  const title = `Resume — ${job.job_title ?? "Role"} at ${job.company ?? "Company"}`;

  const { data: document, error: docError } = await auth.supabase
    .from("generated_documents")
    .insert({
      user_id: auth.user.id,
      job_id: jobId,
      application_id: applicationId ?? null,
      resume_id: resumeId,
      document_type: "tailored_resume",
      title,
      content: JSON.stringify(content),
      metadata: { sourceResumeId: resumeId },
    })
    .select()
    .single();

  if (docError) {
    return NextResponse.json({ error: docError.message }, { status: 500 });
  }

  return NextResponse.json({ document, content });
}
