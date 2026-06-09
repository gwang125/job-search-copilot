import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { getOpenAIClient, OPENAI_MODEL } from "@/lib/openai/client";
import {
  COVER_LETTER_SYSTEM,
  buildCoverLetterPrompt,
} from "@/lib/openai/prompts";
import type { Job, Profile, Resume } from "@/types/database";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const {
    jobId,
    resumeId,
    company,
    jobTitle,
    jobDescription,
  } = await request.json();

  if (!resumeId) {
    return NextResponse.json(
      { error: "resumeId is required" },
      { status: 400 }
    );
  }

  let job: Pick<Job, "company" | "job_title" | "job_description"> | null = null;

  if (jobId) {
    const { data } = await auth.supabase
      .from("jobs")
      .select("company, job_title, job_description")
      .eq("id", jobId)
      .eq("user_id", auth.user.id)
      .single();

    job = data;
  } else if (jobDescription?.trim()) {
    job = {
      company: company ?? null,
      job_title: jobTitle ?? null,
      job_description: jobDescription.trim(),
    };
  }

  if (!job) {
    return NextResponse.json(
      { error: "jobId or jobDescription is required" },
      { status: 400 }
    );
  }

  const [{ data: profile }, { data: resume }] = await Promise.all([
    auth.supabase.from("profiles").select("*").eq("id", auth.user.id).single(),
    auth.supabase
      .from("resumes")
      .select("*")
      .eq("id", resumeId)
      .eq("user_id", auth.user.id)
      .single(),
  ]);

  if (!profile || !resume) {
    return NextResponse.json(
      { error: "Missing profile or resume" },
      { status: 404 }
    );
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

  const title = `Cover Letter - ${job.job_title ?? "Role"} at ${job.company ?? "Company"}`;

  return NextResponse.json({ content, title });
}
