import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobSearchKeywordEntry, JobSearchPreferences, Profile } from "@/types/database";

export const DEFAULT_JOB_SEARCH_PREFERENCES: Omit<
  JobSearchPreferences,
  "id" | "user_id" | "created_at" | "updated_at"
> = {
  exclude_us_citizenship_required: false,
  exclude_security_clearance_required: false,
  exclude_no_visa_sponsorship: false,
  exclude_green_card_required: false,
  max_years_experience: null,
  exclude_phd_required: false,
  excluded_certifications: [],
  remote_only: false,
  hybrid_allowed: true,
  preferred_locations: [],
  blocked_keywords: [],
  search_keywords: [],
};

export function normalizeJobSearchPreferencesRow(
  row: Record<string, unknown> | null | undefined,
  userId: string
): JobSearchPreferences {
  if (!row) {
    return {
      id: "",
      user_id: userId,
      ...DEFAULT_JOB_SEARCH_PREFERENCES,
      created_at: "",
      updated_at: "",
    };
  }

  const maxRaw = row.max_years_experience;
  const maxYears =
    maxRaw === null || maxRaw === undefined || maxRaw === ""
      ? null
      : typeof maxRaw === "number"
        ? Math.max(0, Math.round(maxRaw))
        : null;

  return {
    id: String(row.id ?? ""),
    user_id: String(row.user_id ?? userId),
    exclude_us_citizenship_required: Boolean(row.exclude_us_citizenship_required),
    exclude_security_clearance_required: Boolean(
      row.exclude_security_clearance_required
    ),
    exclude_no_visa_sponsorship: Boolean(row.exclude_no_visa_sponsorship),
    exclude_green_card_required: Boolean(row.exclude_green_card_required),
    max_years_experience: maxYears,
    exclude_phd_required: Boolean(row.exclude_phd_required),
    excluded_certifications: stringArray(row.excluded_certifications),
    remote_only: Boolean(row.remote_only),
    hybrid_allowed: row.hybrid_allowed === false ? false : true,
    preferred_locations: stringArray(row.preferred_locations),
    blocked_keywords: stringArray(row.blocked_keywords),
    search_keywords: parseSearchKeywords(row.search_keywords),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
}

function newSearchKeywordId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `kw-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseSearchKeywords(value: unknown): JobSearchKeywordEntry[] {
  if (!Array.isArray(value)) return [];
  const out: JobSearchKeywordEntry[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    let keyword = "";
    let isActive = true;
    let id = newSearchKeywordId();

    if (typeof item === "string") {
      keyword = item.trim();
    } else if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      keyword = typeof row.keyword === "string" ? row.keyword.trim() : "";
      isActive = row.is_active !== false;
      if (typeof row.id === "string" && row.id.trim()) {
        id = row.id.trim();
      }
    }

    if (!keyword) continue;
    const key = keyword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id, keyword, is_active: isActive });
  }

  return out;
}

export function createSearchKeywordEntry(
  keyword: string,
  isActive = true
): JobSearchKeywordEntry {
  return {
    id: newSearchKeywordId(),
    keyword: keyword.trim(),
    is_active: isActive,
  };
}

export function getActiveSearchKeywords(
  prefs: JobSearchPreferences,
  profile?: Pick<Profile, "target_job_titles"> | null
): string[] {
  const fromPrefs = prefs.search_keywords
    .filter((entry) => entry.is_active && entry.keyword.trim())
    .map((entry) => entry.keyword.trim());

  if (fromPrefs.length > 0) return fromPrefs;

  return (profile?.target_job_titles ?? [])
    .map((t) => t.trim())
    .filter(Boolean);
}

export function normalizeSearchKeywordsForSave(
  entries: JobSearchKeywordEntry[]
): JobSearchKeywordEntry[] {
  return parseSearchKeywords(entries);
}

export async function getJobSearchPreferences(
  supabase: SupabaseClient,
  userId: string
): Promise<JobSearchPreferences> {
  const { data, error } = await supabase
    .from("job_search_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("job_search_preferences select:", error.message);
    return normalizeJobSearchPreferencesRow(null, userId);
  }

  return normalizeJobSearchPreferencesRow(
    data as Record<string, unknown> | null,
    userId
  );
}

export function preferencesPayloadForSave(
  userId: string,
  prefs: Omit<
    JobSearchPreferences,
    "id" | "user_id" | "created_at" | "updated_at"
  >
) {
  return {
    user_id: userId,
    exclude_us_citizenship_required: prefs.exclude_us_citizenship_required,
    exclude_security_clearance_required: prefs.exclude_security_clearance_required,
    exclude_no_visa_sponsorship: prefs.exclude_no_visa_sponsorship,
    exclude_green_card_required: prefs.exclude_green_card_required,
    max_years_experience: prefs.max_years_experience,
    exclude_phd_required: prefs.exclude_phd_required,
    excluded_certifications: prefs.excluded_certifications,
    remote_only: prefs.remote_only,
    hybrid_allowed: prefs.hybrid_allowed,
    preferred_locations: prefs.preferred_locations,
    blocked_keywords: prefs.blocked_keywords,
    search_keywords: normalizeSearchKeywordsForSave(prefs.search_keywords),
  };
}

export function hasActiveHardFilters(prefs: JobSearchPreferences): boolean {
  return (
    prefs.exclude_us_citizenship_required ||
    prefs.exclude_security_clearance_required ||
    prefs.exclude_no_visa_sponsorship ||
    prefs.exclude_green_card_required ||
    prefs.max_years_experience != null ||
    prefs.exclude_phd_required ||
    prefs.remote_only ||
    !prefs.hybrid_allowed ||
    prefs.excluded_certifications.length > 0 ||
    prefs.preferred_locations.length > 0 ||
    prefs.blocked_keywords.length > 0
  );
}
