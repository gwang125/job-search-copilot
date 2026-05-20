/** Read a JSON error body from a failed fetch without throwing on empty HTML/text. */
export async function readApiError(
  res: Response,
  fallback = "Request failed"
): Promise<string> {
  const text = await res.text();
  if (!text.trim()) {
    return `${fallback} (${res.status})`;
  }
  try {
    const data = JSON.parse(text) as { error?: string };
    return data.error ?? `${fallback} (${res.status})`;
  } catch {
    return text.slice(0, 300) || `${fallback} (${res.status})`;
  }
}
