import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import {
  normalizeCompany,
  resolveJobRelation,
  titlesAreSimilar,
  type JobSummary,
} from "@/lib/utils";
import type { DuplicateWarning } from "@/types/database";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { company, jobTitle } = await request.json();

  const { data: applications } = await auth.supabase
    .from("applications")
    .select("id, status, job:jobs(company, job_title)")
    .eq("user_id", auth.user.id);

  const normalized = normalizeCompany(company);
  const similar =
    applications?.filter((app) => {
      const job = resolveJobRelation(app.job as JobSummary | JobSummary[] | null);
      if (!job) return false;
      const sameCompany =
        normalized && normalizeCompany(job.company) === normalized;
      const similarTitle = titlesAreSimilar(
        jobTitle ?? "",
        job.job_title ?? ""
      );
      return sameCompany && similarTitle;
    }) ?? [];

  const result: DuplicateWarning = {
    isDuplicate: similar.length > 0,
    message:
      similar.length > 0
        ? `You may have already saved a similar role at ${company ?? "this company"}.`
        : "No similar applications found.",
    similarApplications: similar.map((s) => {
      const job = resolveJobRelation(s.job as JobSummary | JobSummary[] | null);
      return {
        id: s.id,
        company: job?.company ?? null,
        job_title: job?.job_title ?? null,
        status: s.status,
      };
    }),
  };

  return NextResponse.json(result);
}
