import { resolveSearchLocation } from "@/lib/jobs/resolve-search-location";
import type { LinkedInWorkType } from "@/lib/linkedin/search-jobs";
import type { JobSearchPreferences } from "@/types/database";

export interface BuildJobSearchQueryInput {
  keyword: string;
  location?: string;
  workType: LinkedInWorkType;
  targetJobTitles: string[];
  preferences: JobSearchPreferences;
}

export interface JobSearchQueryPlan {
  /** Targeted LinkedIn keyword queries (rotated across pages) */
  searchKeywords: string[];
  searchLocation?: string;
  searchModifiers: string[];
  excludedTerms: string[];
  reason: string;
}

const SENIORITY_EXCLUDE_TERMS = [
  "senior",
  "staff",
  "principal",
  "lead",
  "manager",
  "director",
  "vp",
  "vice president",
  "head of",
  "chief",
  "5+ years",
  "5 years",
  "6+ years",
  "7+ years",
  "8+ years",
  "10+ years",
];

const CLEARANCE_EXCLUDE_TERMS = [
  "security clearance",
  "active clearance",
  "top secret",
  "ts/sci",
];

const CITIZENSHIP_EXCLUDE_TERMS = [
  "us citizenship",
  "u.s. citizenship",
  "citizenship required",
];

function uniqueNonEmpty(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function extractBaseRole(keyword: string, targetJobTitles: string[]): string {
  const k = keyword.trim();
  if (k) return k;
  const first = targetJobTitles.find((t) => t.trim());
  return first?.trim() ?? "software engineer";
}

function experienceModifiers(maxYears: number | null): string[] {
  if (maxYears == null) return [];
  if (maxYears <= 1) {
    return [
      "new grad",
      "entry level",
      "junior",
      "intern",
      "0-1 years",
      "university graduate",
    ];
  }
  if (maxYears <= 2) {
    return [
      "entry level",
      "new grad",
      "junior",
      "0-2 years",
      "university graduate",
      "associate",
    ];
  }
  if (maxYears <= 4) {
    return ["entry level", "junior", "0-4 years", "mid level"];
  }
  if (maxYears <= 6) {
    return ["mid level", "3-5 years", "4-6 years"];
  }
  return [];
}

function buildExcludedTerms(preferences: JobSearchPreferences): string[] {
  const terms: string[] = [...preferences.blocked_keywords];

  if (preferences.max_years_experience != null && preferences.max_years_experience <= 4) {
    terms.push(...SENIORITY_EXCLUDE_TERMS);
  }

  if (preferences.exclude_security_clearance_required) {
    terms.push(...CLEARANCE_EXCLUDE_TERMS);
  }

  if (preferences.exclude_us_citizenship_required) {
    terms.push(...CITIZENSHIP_EXCLUDE_TERMS);
  }

  if (preferences.exclude_phd_required) {
    terms.push("phd", "doctorate", "doctoral");
  }

  return uniqueNonEmpty(terms);
}

/**
 * Build targeted LinkedIn search queries from profile hard requirements.
 */
export function buildJobSearchQueryFromPreferences(
  input: BuildJobSearchQueryInput
): JobSearchQueryPlan {
  const baseRole = extractBaseRole(input.keyword, input.targetJobTitles);
  const modifiers = experienceModifiers(input.preferences.max_years_experience);
  const excludedTerms = buildExcludedTerms(input.preferences);

  const searchKeywords: string[] = [];
  if (modifiers.length > 0) {
    for (const mod of modifiers.slice(0, 5)) {
      searchKeywords.push(`${baseRole} ${mod}`);
    }
    searchKeywords.push(baseRole);
  } else {
    searchKeywords.push(baseRole);
    if (input.targetJobTitles.length > 0) {
      for (const title of input.targetJobTitles.slice(0, 2)) {
        const t = title.trim();
        if (t && t.toLowerCase() !== baseRole.toLowerCase()) {
          searchKeywords.push(t);
        }
      }
    }
  }

  const searchLocation =
    resolveSearchLocation(
      { location: null },
      input.preferences,
      input.location
    ) || undefined;

  const reasons: string[] = [];
  if (modifiers.length > 0) {
    reasons.push(
      `Searching "${baseRole}" plus ${modifiers.slice(0, 3).join(", ")} variants`
    );
  } else {
    reasons.push(`Searching for "${baseRole}"`);
  }
  if (searchLocation) reasons.push(`in ${searchLocation}`);
  if (input.preferences.remote_only) reasons.push("remote-focused");
  if (excludedTerms.length > 0) {
    reasons.push(`${excludedTerms.length} post-filter exclusion terms active`);
  }

  return {
    searchKeywords: uniqueNonEmpty(searchKeywords),
    searchLocation,
    searchModifiers: modifiers,
    excludedTerms,
    reason: reasons.join(". ") + ".",
  };
}

/** Merge query plans for multiple active base keywords (Find Jobs). */
export function buildCombinedSearchQueryPlan(
  activeKeywords: string[],
  input: Omit<BuildJobSearchQueryInput, "keyword">
): JobSearchQueryPlan {
  if (activeKeywords.length === 0) {
    return buildJobSearchQueryFromPreferences({ ...input, keyword: "" });
  }

  const mergedKeywords: string[] = [];
  let searchLocation: string | undefined;
  let excludedTerms: string[] = [];
  const reasons: string[] = [];

  for (const keyword of activeKeywords) {
    const plan = buildJobSearchQueryFromPreferences({ ...input, keyword });
    mergedKeywords.push(...plan.searchKeywords);
    searchLocation = searchLocation ?? plan.searchLocation;
    excludedTerms = uniqueNonEmpty([...excludedTerms, ...plan.excludedTerms]);
    reasons.push(`${keyword} (${plan.searchKeywords.length} queries)`);
  }

  return {
    searchKeywords: uniqueNonEmpty(mergedKeywords),
    searchLocation,
    searchModifiers: [],
    excludedTerms,
    reason: `Active keywords: ${reasons.join("; ")}.`,
  };
}

/** Fast check on listing card text before fetching full description */
export function listingFailsQuickExclusion(
  listing: {
    title: string;
    company: string | null;
    location: string | null;
  },
  excludedTerms: string[]
): boolean {
  if (!excludedTerms.length) return false;
  const haystack = [listing.title, listing.company, listing.location]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return excludedTerms.some((term) => {
    const t = term.trim().toLowerCase();
    return t.length > 0 && haystack.includes(t);
  });
}
