const DEFAULT_MIN_INTERVAL_MS = 3500;
const DEFAULT_JITTER_MS = 1200;

let lastLinkedInRequestAt = 0;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Space out LinkedIn guest API calls to reduce HTTP 429 rate limits */
export async function throttleLinkedInRequest(
  minIntervalMs = DEFAULT_MIN_INTERVAL_MS
): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastLinkedInRequestAt;
  const jitterMs = Math.floor(Math.random() * DEFAULT_JITTER_MS);
  const waitMs = minIntervalMs + jitterMs - elapsed;
  if (waitMs > 0) {
    await sleep(waitMs);
  }
  lastLinkedInRequestAt = Date.now();
}

export function resetLinkedInRequestThrottleForTests(): void {
  lastLinkedInRequestAt = 0;
}
