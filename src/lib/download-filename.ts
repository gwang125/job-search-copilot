/** HTTP header `filename=` must be ASCII (ByteString). */
export function toAsciiPdfFilename(title: string, fallback = "document"): string {
  const base =
    title
      .replace(/\s+/g, "_")
      .replace(/[^\x20-\x7E]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 120) || fallback;

  return base.endsWith(".pdf") ? base : `${base}.pdf`;
}

export function pdfContentDisposition(title: string, fallback = "document"): string {
  const asciiName = toAsciiPdfFilename(title, fallback);
  const displayTitle = (title.trim() || fallback).replace(/\s+/g, " ");
  const utf8Name = encodeURIComponent(
    displayTitle.endsWith(".pdf") ? displayTitle : `${displayTitle}.pdf`
  );
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`;
}

export function toAsciiDocxFilename(title: string, fallback = "document"): string {
  const base = toAsciiPdfFilename(title, fallback);
  return base.endsWith(".docx") ? base : base.replace(/\.pdf$/i, ".docx");
}

export function docxContentDisposition(
  title: string,
  fallback = "document"
): string {
  const asciiName = toAsciiDocxFilename(title, fallback);
  const displayTitle = (title.trim() || fallback).replace(/\s+/g, " ");
  const utf8Name = encodeURIComponent(
    displayTitle.endsWith(".docx") ? displayTitle : `${displayTitle}.docx`
  );
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`;
}
