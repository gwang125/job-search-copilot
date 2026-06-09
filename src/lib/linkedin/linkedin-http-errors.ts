export type LinkedInRequestKind = "job_search" | "job_posting" | "job_view";

export class LinkedInHttpError extends Error {
  readonly status: number;
  readonly kind: LinkedInRequestKind;
  readonly retryAfterSeconds?: number;

  constructor(
    kind: LinkedInRequestKind,
    status: number,
    message: string,
    options?: { retryAfterSeconds?: number; cause?: unknown }
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "LinkedInHttpError";
    this.kind = kind;
    this.status = status;
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

export function parseRetryAfterSeconds(
  header: string | null | undefined
): number | undefined {
  if (!header?.trim()) return undefined;
  const seconds = Number(header.trim());
  if (!Number.isNaN(seconds) && seconds > 0) return Math.ceil(seconds);
  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    const wait = Math.ceil((date - Date.now()) / 1000);
    return wait > 0 ? wait : undefined;
  }
  return undefined;
}

function requestLabel(kind: LinkedInRequestKind): string {
  switch (kind) {
    case "job_search":
      return "LinkedIn job search";
    case "job_posting":
      return "LinkedIn job posting";
    case "job_view":
      return "LinkedIn job page";
  }
}

/** User-facing explanation for LinkedIn guest API HTTP status codes */
export function linkedInHttpErrorMessage(
  kind: LinkedInRequestKind,
  status: number,
  retryAfterSeconds?: number
): string {
  const label = requestLabel(kind);
  const waitHint =
    retryAfterSeconds != null && retryAfterSeconds > 0
      ? ` Try again in about ${formatWaitSeconds(retryAfterSeconds)}.`
      : "";

  switch (status) {
    case 429:
      return (
        `${label} was rate-limited by LinkedIn (HTTP 429). ` +
        `LinkedIn received too many requests in a short window.` +
        waitHint +
        ` Wait 15–30 minutes, then try again with 1 active keyword and 5 jobs to score.`
      );
    case 403:
      return (
        `${label} was blocked by LinkedIn (HTTP 403). ` +
        `LinkedIn may be refusing automated traffic from this network or IP. ` +
        `Try again later, use a different network, or search manually on LinkedIn.`
      );
    case 401:
      return (
        `${label} requires sign-in (HTTP 401). ` +
        `The public guest API did not allow this request. Try again later or open the job on LinkedIn directly.`
      );
    case 404:
      return (
        `${label} endpoint not found (HTTP 404). ` +
        `LinkedIn may have changed their guest API. Report this if it persists.`
      );
    case 408:
      return (
        `${label} timed out on LinkedIn's side (HTTP 408). ` +
        `Try again with fewer keywords or a simpler location filter.`
      );
    case 500:
    case 502:
    case 503:
    case 504:
      return (
        `${label} failed due to a LinkedIn server error (HTTP ${status}). ` +
        `This is on LinkedIn's side, not your keywords.${waitHint} Try again in a few minutes.`
      );
    default:
      if (status >= 400 && status < 500) {
        return (
          `${label} was rejected (HTTP ${status}). ` +
          `LinkedIn declined the request. This is usually not caused by your keyword text.${waitHint}`
        );
      }
      if (status >= 500) {
        return (
          `${label} failed (HTTP ${status}). LinkedIn returned a server error.${waitHint}`
        );
      }
      return `${label} returned an unexpected response (HTTP ${status}).`;
  }
}

function formatWaitSeconds(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds} seconds`;
  const minutes = Math.ceil(totalSeconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

export function throwLinkedInHttpError(
  kind: LinkedInRequestKind,
  response: Response
): never {
  const retryAfterSeconds = parseRetryAfterSeconds(
    response.headers.get("retry-after")
  );
  const message = linkedInHttpErrorMessage(
    kind,
    response.status,
    retryAfterSeconds
  );
  throw new LinkedInHttpError(kind, response.status, message, {
    retryAfterSeconds,
  });
}

export function isLinkedInHttpError(error: unknown): error is LinkedInHttpError {
  return error instanceof LinkedInHttpError;
}
