import type { DiscoveredJobMatch } from "@/types/database";
import type { LinkedInPostedWithin, LinkedInWorkType } from "@/lib/linkedin/search-jobs";

const STORAGE_VERSION = 3;

export interface FindJobsSessionFilters {
  keywords: string;
  location: string;
  resumeId: string;
  postedWithin: LinkedInPostedWithin;
  workType: LinkedInWorkType;
  minMatchScore: number;
  limit: number;
}

export interface FindJobsSessionMeta {
  listingsFound: number;
  resumeName: string;
}

export interface FindJobsSessionCache {
  version: number;
  savedAt: string;
  filters: FindJobsSessionFilters;
  jobs: DiscoveredJobMatch[];
  meta: FindJobsSessionMeta;
}

function storageKey(userId: string) {
  return `job-search-copilot:find-jobs:v${STORAGE_VERSION}:${userId}`;
}

export function loadFindJobsSession(
  userId: string
): FindJobsSessionCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FindJobsSessionCache;
    if (parsed.version !== STORAGE_VERSION) return null;
    if (!Array.isArray(parsed.jobs) || !parsed.filters || !parsed.meta) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveFindJobsSession(
  userId: string,
  data: Omit<FindJobsSessionCache, "version" | "savedAt">
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: FindJobsSessionCache = {
      version: STORAGE_VERSION,
      savedAt: new Date().toISOString(),
      ...data,
    };
    sessionStorage.setItem(storageKey(userId), JSON.stringify(payload));
  } catch {
    /* quota or private mode — ignore */
  }
}

export function clearFindJobsSession(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(userId));
  } catch {
    /* ignore */
  }
}

export function formatSessionSavedAt(iso: string): string {
  const saved = new Date(iso).getTime();
  const diffMs = Date.now() - saved;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(iso).toLocaleString();
}
