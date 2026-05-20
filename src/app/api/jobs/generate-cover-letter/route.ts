import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { getOpenAIClient, OPENAI_MODEL } from "@/lib/openai/client";
import {
  COVER_LETTER_SYSTEM,
  buildCoverLetterPrompt,
} from "@/lib/openai/prompts";
import type { Profile, Resume } from "@/types/database";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { jobId, resumeId, applicationId } = await request.json();

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

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: COVER_LETTER_SYSTEM },
      {
        role: "user",
        content: buildCoverLetterPrompt(
          profile as Profile,
          resume as Resume,
          job.job_description,
          job.company,
          job.job_title
        ),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) {
    return NextResponse.json({ error: "Empty AI response" }, { status: 500 });
  }

  const title = `Cover Letter — ${job.job_title ?? "Role"} at ${job.company ?? "Company"}`;

  const { data: document, error: docError } = await auth.supabase
    .from("generated_documents")
    .insert({
      user_id: auth.user.id,
      job_id: jobId,
      application_id: applicationId ?? null,
      resume_id: resumeId,
      document_type: "cover_letter",
      title,
      content,
      metadata: { sourceResumeId: resumeId },
    })
    .select()
    .single();

  if (docError) {
    return NextResponse.json({ error: docError.message }, { status: 500 });
  }

  return NextResponse.json({ document, content });
}
