import { extractTextFromPdfBuffer } from "@/lib/resume/extract-pdf-text";

export const MAX_RESUME_FILE_BYTES = 8 * 1024 * 1024; // 8 MB

const PDF_EXTENSIONS = new Set(["pdf"]);
const DOCX_EXTENSIONS = new Set(["docx"]);

export function isAllowedResumeFileName(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return ext != null && (PDF_EXTENSIONS.has(ext) || DOCX_EXTENSIONS.has(ext));
}

export function isDocxFileName(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return ext != null && DOCX_EXTENSIONS.has(ext);
}

export function resumeFileContentType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

async function extractTextFromDocxBuffer(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });

  const text = result.value?.replace(/\s+/g, " ").trim() ?? "";
  if (text.length < 80) {
    throw new Error(
      "Could not extract enough text from this Word document. Try a different file or export as PDF."
    );
  }

  return text;
}

/**
 * Extract plain text from a resume file buffer (PDF or DOCX). Server-only.
 */
export async function extractTextFromResumeFile(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase();

  if (ext && PDF_EXTENSIONS.has(ext)) {
    return extractTextFromPdfBuffer(buffer);
  }

  if (ext && DOCX_EXTENSIONS.has(ext)) {
    return extractTextFromDocxBuffer(buffer);
  }

  throw new Error("Only PDF and DOCX files are supported.");
}

export function sanitizeResumeFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? "resume";
  return base.replace(/[^\w.\-() ]+/g, "_").slice(0, 200) || "resume";
}
