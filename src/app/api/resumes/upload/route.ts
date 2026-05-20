import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import {
  extractTextFromResumeFile,
  isAllowedResumeFileName,
  MAX_RESUME_FILE_BYTES,
  resumeFileContentType,
  sanitizeResumeFileName,
} from "@/lib/resume/extract-resume-file";
import {
  ensureResumesStorageBucket,
  RESUME_STORAGE_SETUP_HINT,
  RESUMES_BUCKET,
} from "@/lib/supabase/ensure-resumes-storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { supabase, user } = auth;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "A resume file is required (field name: file)" },
        { status: 400 }
      );
    }

    if (!isAllowedResumeFileName(file.name)) {
      return NextResponse.json(
        { error: "Only PDF and DOCX files are supported" },
        { status: 400 }
      );
    }

    if (file.size > MAX_RESUME_FILE_BYTES) {
      return NextResponse.json(
        { error: "File must be 8 MB or smaller" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extractedText = await extractTextFromResumeFile(buffer, file.name);

    const { count } = await supabase
      .from("resumes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    const resumeId = crypto.randomUUID();
    const safeFileName = sanitizeResumeFileName(file.name);
    const storagePath = `${user.id}/${resumeId}/${safeFileName}`;

    const bucketReady = await ensureResumesStorageBucket();
    if (!bucketReady.ok && bucketReady.error !== "no_service_role") {
      return NextResponse.json(
        { error: `Could not create storage bucket: ${bucketReady.error}` },
        { status: 500 }
      );
    }

    const { error: uploadError } = await supabase.storage
      .from(RESUMES_BUCKET)
      .upload(storagePath, buffer, {
        contentType: resumeFileContentType(file.name),
        upsert: false,
      });

    if (uploadError) {
      const msg = uploadError.message.toLowerCase();
      const needsSetup =
        msg.includes("bucket not found") ||
        msg.includes("row-level security") ||
        msg.includes("violates");

      return NextResponse.json(
        {
          error: needsSetup
            ? `Resume storage is not configured. ${RESUME_STORAGE_SETUP_HINT}`
            : uploadError.message,
        },
        { status: 500 }
      );
    }

    const displayName =
      file.name.replace(/\.[^.]+$/i, "").trim() || safeFileName;

    const { data: row, error: insertError } = await supabase
      .from("resumes")
      .insert({
        id: resumeId,
        user_id: user.id,
        name: displayName,
        file_path: storagePath,
        file_name: file.name,
        extracted_text: extractedText,
        is_primary: (count ?? 0) === 0,
      })
      .select()
      .single();

    if (insertError) {
      await supabase.storage.from(RESUMES_BUCKET).remove([storagePath]);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ resume: row });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to upload resume";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
