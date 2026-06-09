import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireUser } from "@/lib/api-auth";
import { pdfContentDisposition } from "@/lib/download-filename";
import { CoverLetterPdfDocument } from "@/lib/pdf/cover-letter-pdf";
import type { GeneratedDocumentType } from "@/types/database";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;

    const body = await request.json();
    const documentId = body.documentId as string | undefined;
    const documentType = body.documentType as GeneratedDocumentType | undefined;
    const content = body.content as string | undefined;
    const title = body.title as string | undefined;

    if (documentType === "cover_letter" && content?.trim()) {
      const buffer = await renderToBuffer(
        <CoverLetterPdfDocument content={content.trim()} />
      );

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
            title ?? "Cover Letter",
            "cover_letter"
          ),
        },
      });
    }

    if (!documentId || !documentType) {
      return NextResponse.json(
        { error: "documentId and documentType, or content and documentType, are required" },
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

    if (documentType !== "cover_letter") {
      return NextResponse.json(
        { error: "PDF export is only available for cover letters" },
        { status: 400 }
      );
    }

    const buffer = await renderToBuffer(
      <CoverLetterPdfDocument content={doc.content} />
    );

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
          "cover_letter"
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
