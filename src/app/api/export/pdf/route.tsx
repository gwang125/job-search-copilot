import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireUser } from "@/lib/api-auth";
import { pdfContentDisposition } from "@/lib/download-filename";
import { ResumePdfDocument } from "@/lib/pdf/resume-pdf";
import { CoverLetterPdfDocument } from "@/lib/pdf/cover-letter-pdf";
import type {
  GeneratedDocumentType,
  TailoredResumeContent,
} from "@/types/database";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;

    const body = await request.json();
    const documentId = body.documentId as string | undefined;
    const documentType = body.documentType as GeneratedDocumentType | undefined;

    if (!documentId || !documentType) {
      return NextResponse.json(
        { error: "documentId and documentType are required" },
        { status: 400 }
      );
    }

    const { data: doc, error: docError } = await auth.supabase
      .from("generated_documents")
      .select("*")
      .eq("id", documentId)
      .eq("user_id", auth.user.id)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (doc.document_type !== documentType) {
      return NextResponse.json(
        { error: "Document type does not match" },
        { status: 400 }
      );
    }

    const { data: profile } = await auth.supabase
      .from("profiles")
      .select("name")
      .eq("id", auth.user.id)
      .single();

    const candidateName = profile?.name ?? "Candidate";

    let buffer: Buffer;

    if (documentType === "tailored_resume") {
      let content: TailoredResumeContent;
      try {
        const parsed = JSON.parse(doc.content) as TailoredResumeContent;
        content = {
          summary: parsed.summary ?? "",
          skills: parsed.skills ?? [],
          experience: (parsed.experience ?? []).map((exp) => ({
            ...exp,
            bullets: exp.bullets ?? [],
          })),
          education: parsed.education ?? [],
          projects: (parsed.projects ?? []).map((proj) => ({
            ...proj,
            bullets: proj.bullets ?? [],
          })),
        };
      } catch {
        return NextResponse.json(
          { error: "Invalid resume document content" },
          { status: 400 }
        );
      }
      buffer = await renderToBuffer(
        <ResumePdfDocument name={candidateName} content={content} />
      );
    } else {
      buffer = await renderToBuffer(
        <CoverLetterPdfDocument content={doc.content} />
      );
    }

    if (!buffer?.length) {
      return NextResponse.json(
        { error: "PDF generation produced an empty file" },
        { status: 500 }
      );
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": pdfContentDisposition(
          doc.title,
          documentType === "tailored_resume" ? "tailored_resume" : "cover_letter"
        ),
      },
    });
  } catch (error) {
    console.error("[export/pdf]", error);
    const message =
      error instanceof Error ? error.message : "PDF export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
