import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { RESUMES_BUCKET } from "@/lib/supabase/ensure-resumes-storage";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const { supabase, user } = auth;

  const { data: resume, error: fetchError } = await supabase
    .from("resumes")
    .select("id, file_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !resume) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  if (resume.file_path) {
    await supabase.storage.from(RESUMES_BUCKET).remove([resume.file_path]);
  }

  const { error: deleteError } = await supabase
    .from("resumes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
