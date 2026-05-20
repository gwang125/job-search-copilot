/**
 * Extract plain text from a PDF buffer (server-only).
 */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(buffer);

  const text = result.text?.replace(/\s+/g, " ").trim() ?? "";
  if (text.length < 80) {
    throw new Error(
      "Could not extract enough text from this PDF. Try a text-based PDF or paste your resume as .txt."
    );
  }

  return text;
}

export const MAX_RESUME_PDF_BYTES = 8 * 1024 * 1024; // 8 MB
