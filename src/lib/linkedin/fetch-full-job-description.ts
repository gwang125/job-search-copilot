import {
  parseLinkedInJobViaGuestApi,
  parseLinkedInJobViaViewPage,
} from "@/lib/linkedin/guest-api";
import { throttleLinkedInRequest } from "@/lib/linkedin/rate-limit";

/** Minimum chars to treat as a full job description for filtering/scoring */
export const FULL_JD_MIN_LENGTH = 200;

/** Stored / filtered description cap (matches LinkedIn extractor) */
export const FULL_JD_MAX_LENGTH = 20000;

/**
 * Fetch the fullest LinkedIn job description available (guest API, then view page).
 */
export async function fetchFullLinkedInJobDescription(
  linkedInJobId: string,
  options: { allowViewFallback?: boolean } = {}
): Promise<string | null> {
  let best = "";
  const allowViewFallback = options.allowViewFallback ?? true;

  await throttleLinkedInRequest();
  const guest = await parseLinkedInJobViaGuestApi(linkedInJobId);
  if (guest?.jobDescription && guest.jobDescription.length > best.length) {
    best = guest.jobDescription;
  }

  if (best.length >= FULL_JD_MIN_LENGTH) {
    return best.slice(0, FULL_JD_MAX_LENGTH);
  }

  if (!allowViewFallback) {
    return null;
  }

  await throttleLinkedInRequest();
  const view = await parseLinkedInJobViaViewPage(linkedInJobId);
  if (view?.jobDescription && view.jobDescription.length > best.length) {
    best = view.jobDescription;
  }

  if (best.length >= FULL_JD_MIN_LENGTH) {
    return best.slice(0, FULL_JD_MAX_LENGTH);
  }

  return null;
}
