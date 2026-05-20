import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { RESUMES_BUCKET } from "@/lib/supabase/ensure-resumes-storage";
const SIGNED_URL_TTL_SEC = 60 * 60; // 1 hour

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const { supabase, user } = auth;

  const { data: resume, error } = await supabase
    .from("resumes")
    .select("id, user_id, file_path, file_name")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !resume) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  if (!resume.file_path) {
    return NextResponse.json(
      { error: "This resume has no stored file. Re-upload it as PDF or DOCX." },
      { status: 404 }
    );
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(RESUMES_BUCKET)
    .createSignedUrl(resume.file_path, SIGNED_URL_TTL_SEC, {
      download: resume.file_name ?? true,
    });

  if (signError || !signed?.signedUrl) {
    return NextResponse.json(
      { error: signError?.message ?? "Could not generate download link" },
      { status: 500 }
    );
  }

  return NextResponse.redirect(signed.signedUrl);
}
