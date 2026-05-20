import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import {
  extractTextFromPdfBuffer,
  MAX_RESUME_PDF_BYTES,
} from "@/lib/resume/extract-pdf-text";
import { parseResumeToProfile } from "@/lib/resume/parse-resume-to-profile";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/x-pdf",
]);

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "A PDF file is required (field name: file)" },
        { status: 400 }
      );
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith(".pdf") && !ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Only PDF resumes are supported" },
        { status: 400 }
      );
    }

    if (file.size > MAX_RESUME_PDF_BYTES) {
      return NextResponse.json(
        { error: "PDF must be 8 MB or smaller" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const resumeText = await extractTextFromPdfBuffer(buffer);
    const profile = await parseResumeToProfile(resumeText);

    return NextResponse.json({
      profile,
      extractedTextLength: resumeText.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to parse resume";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
