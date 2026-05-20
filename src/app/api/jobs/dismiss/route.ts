import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { extractLinkedInJobId } from "@/lib/linkedin/url";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await request.json();
  const jobUrl = (body.jobUrl as string | undefined)?.trim();
  const linkedInJobId =
    (body.linkedInJobId as string | undefined)?.trim() ||
    (jobUrl ? extractLinkedInJobId(jobUrl) : null);
  const title = (body.title as string | undefined)?.trim() || null;
  const company = (body.company as string | undefined)?.trim() || null;

  if (!linkedInJobId) {
    return NextResponse.json(
      { error: "A valid LinkedIn job URL or job ID is required" },
      { status: 400 }
    );
  }

  const { data, error } = await auth.supabase
    .from("job_search_dismissals")
    .upsert(
      {
        user_id: auth.user.id,
        linkedin_job_id: linkedInJobId,
        job_url: jobUrl,
        job_title: title,
        company,
      },
      { onConflict: "user_id,linkedin_job_id" }
    )
    .select("id, linkedin_job_id, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ dismissal: data });
}
