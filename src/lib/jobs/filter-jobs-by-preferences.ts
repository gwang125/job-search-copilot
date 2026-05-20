import type { JobSearchPreferences } from "@/types/database";

export interface JobForPreferenceFilter {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  description: string;
}

export interface JobPreferenceFilterResult {
  job: JobForPreferenceFilter;
  pass: boolean;
  exclusionReasons: string[];
}

const US_CITIZENSHIP_PATTERNS: RegExp[] = [
  /\bu\.?\s*s\.?\s*citizen(?:ship)?\s+required\b/i,
  /\bunited\s+states\s+citizen(?:ship)?\b/i,
  /\bmust\s+be\s+(?:a\s+)?u\.?\s*s\.?\s+citizen\b/i,
  /\brequires?\s+u\.?\s*s\.?\s+citizenship\b/i,
  /\beligible\s+only\s+for\s+u\.?\s*s\.?\s+citizens?\b/i,
];

const SECURITY_CLEARANCE_PATTERNS: RegExp[] = [
  /\bsecurity\s+clearance\b/i,
  /\bactive\s+clearance\b/i,
  /\b(secret|top\s+secret)\s+clearance\b/i,
  /\bts\/sci\b/i,
  /\bclearance\s+required\b/i,
  /\bpolygraph\b/i,
];

const NO_VISA_SPONSORSHIP_PATTERNS: RegExp[] = [
  /\b(no|not|without|unable\s+to|will\s+not|cannot|can't)\s+(?:provide\s+)?visa\s+sponsorship\b/i,
  /\bno\s+h-?1b\b/i,
  /\bnot\s+eligible\s+for\s+sponsorship\b/i,
  /\bmust\s+be\s+authorized\s+to\s+work\s+in\s+(?:the\s+)?(?:u\.?\s*s\.?|united\s+states)\s+without\s+sponsorship\b/i,
  /\bpermanent\s+work\s+authorization\s+required\b/i,
  /\bsponsorship\s+is\s+not\s+available\b/i,
];

const GREEN_CARD_PATTERNS: RegExp[] = [
  /\bgreen\s+card\b/i,
  /\bpermanent\s+residen(?:t|cy)\b/i,
  /\blawful\s+permanent\s+resident\b/i,
  /\b(?:u\.?\s*s\.?\s+)?permanent\s+residency\b/i,
];

const PHD_PATTERNS: RegExp[] = [
  /\bph\.?\s*d\.?\s+required\b/i,
  /\bdoctorate\s+(?:degree\s+)?required\b/i,
  /\bdoctoral\s+degree\b/i,
  /\brequires?\s+a\s+ph\.?\s*d\b/i,
];

const EXPERIENCE_YEAR_PATTERNS: Array<{
  regex: RegExp;
  pick: (match: RegExpMatchArray) => number;
}> = [
  {
    regex: /(\d+)\s*\+\s*years?\s*(?:of\s+)?(?:relevant\s+)?experience/gi,
    pick: (m) => Number(m[1]),
  },
  {
    regex: /(?:minimum|min\.?|at\s+least)\s+(\d+)\s+years?/gi,
    pick: (m) => Number(m[1]),
  },
  {
    regex: /(\d+)\s*-\s*(\d+)\s*years?\s*(?:of\s+)?(?:relevant\s+)?experience/gi,
    pick: (m) => Math.max(Number(m[1]), Number(m[2])),
  },
  {
    regex: /(\d+)\s+years?\s*(?:of\s+)?(?:relevant\s+)?experience/gi,
    pick: (m) => Number(m[1]),
  },
];

const SENIOR_LEVEL_PATTERNS: RegExp[] = [
  /\bsenior[-\s]level\s+experience\b/i,
  /\bstaff[-\s]level\b/i,
  /\bprincipal[-\s]level\b/i,
];

const ONSITE_ONLY_PATTERNS: RegExp[] = [
  /\bon[-\s]?site\s+only\b/i,
  /\bin[-\s]office\s+only\b/i,
  /\b100%\s+on[-\s]?site\b/i,
  /\bmust\s+be\s+(?:located|based)\s+in\b/i,
  /\bno\s+remote\b/i,
];

const REMOTE_SIGNAL_PATTERNS: RegExp[] = [
  /\bremote\b/i,
  /\bwork\s+from\s+home\b/i,
  /\bwfh\b/i,
  /\bhybrid\b/i,
  /\bdistributed\b/i,
];

function jobHaystack(job: JobForPreferenceFilter): string {
  return [job.title, job.company, job.location, job.description]
    .filter(Boolean)
    .join("\n");
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => {
    p.lastIndex = 0;
    return p.test(text);
  });
}

function containsBlockedKeyword(text: string, keyword: string): boolean {
  const k = keyword.trim().toLowerCase();
  if (!k) return false;
  return text.toLowerCase().includes(k);
}

/** Exported for unit tests — highest years-of-experience requirement found in text */
export function extractRequiredYearsOfExperience(text: string): number | null {
  const found: number[] = [];

  for (const { regex, pick } of EXPERIENCE_YEAR_PATTERNS) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const years = pick(match);
      if (!Number.isNaN(years) && years > 0) found.push(years);
    }
  }

  return found.length > 0 ? Math.max(...found) : null;
}

function checkExperience(
  haystack: string,
  maxYears: number | null | undefined
): string | null {
  if (maxYears == null || maxYears < 0) return null;

  const required = extractRequiredYearsOfExperience(haystack);
  if (required != null && required > maxYears) {
    return `Requires ${required}+ years of experience (your max is ${maxYears})`;
  }

  if (maxYears <= 3 && matchesAny(haystack, SENIOR_LEVEL_PATTERNS)) {
    return `Senior-level experience mentioned (your max is ${maxYears} years)`;
  }

  return null;
}

function checkLocation(
  job: JobForPreferenceFilter,
  prefs: JobSearchPreferences
): string[] {
  const reasons: string[] = [];
  const haystack = jobHaystack(job);
  const lower = haystack.toLowerCase();
  const hasRemoteSignal = matchesAny(haystack, REMOTE_SIGNAL_PATTERNS);
  const hasOnsiteOnly = matchesAny(haystack, ONSITE_ONLY_PATTERNS);

  if (prefs.remote_only) {
    if (hasOnsiteOnly) {
      reasons.push("On-site only role (remote only preference)");
    } else if (!hasRemoteSignal) {
      const loc = (job.location ?? "").toLowerCase();
      const looksOnsite =
        loc.length > 0 &&
        !loc.includes("remote") &&
        !loc.includes("hybrid") &&
        !lower.includes("remote");
      if (looksOnsite) {
        reasons.push("No remote work indicated (remote only preference)");
      }
    }
  } else if (!prefs.hybrid_allowed && hasOnsiteOnly) {
    reasons.push("On-site only role (hybrid not allowed)");
  } else if (!prefs.hybrid_allowed && lower.includes("hybrid")) {
    reasons.push("Hybrid role (hybrid not allowed)");
  }

  const locations = prefs.preferred_locations.filter(Boolean);
  if (locations.length > 0) {
    const matchesPreferred = locations.some((pref) => {
      const p = pref.trim().toLowerCase();
      return lower.includes(p);
    });
    if (!matchesPreferred && !(prefs.remote_only && hasRemoteSignal)) {
      reasons.push(
        `Location not in preferred list (${locations.join(", ")})`
      );
    }
  }

  return reasons;
}

function evaluateJobAgainstPreferences(
  job: JobForPreferenceFilter,
  prefs: JobSearchPreferences
): JobPreferenceFilterResult {
  const haystack = jobHaystack(job);
  const reasons: string[] = [];

  if (prefs.exclude_us_citizenship_required && matchesAny(haystack, US_CITIZENSHIP_PATTERNS)) {
    reasons.push("U.S. citizenship required");
  }

  if (
    prefs.exclude_security_clearance_required &&
    matchesAny(haystack, SECURITY_CLEARANCE_PATTERNS)
  ) {
    reasons.push("Security clearance required");
  }

  if (
    prefs.exclude_no_visa_sponsorship &&
    matchesAny(haystack, NO_VISA_SPONSORSHIP_PATTERNS)
  ) {
    reasons.push("No visa sponsorship");
  }

  if (prefs.exclude_green_card_required && matchesAny(haystack, GREEN_CARD_PATTERNS)) {
    reasons.push("Green Card or permanent residency required");
  }

  const experienceReason = checkExperience(haystack, prefs.max_years_experience);
  if (experienceReason) reasons.push(experienceReason);

  if (prefs.exclude_phd_required && matchesAny(haystack, PHD_PATTERNS)) {
    reasons.push("PhD or doctorate required");
  }

  for (const cert of prefs.excluded_certifications) {
    if (containsBlockedKeyword(haystack, cert)) {
      reasons.push(`Excluded certification: ${cert}`);
    }
  }

  reasons.push(...checkLocation(job, prefs));

  for (const kw of prefs.blocked_keywords) {
    if (containsBlockedKeyword(haystack, kw)) {
      reasons.push(`Blocked keyword: ${kw}`);
    }
  }

  return {
    job,
    pass: reasons.length === 0,
    exclusionReasons: reasons,
  };
}

/** Deterministic hard-filter — run before AI scoring */
export function filterJobsByPreferences(
  jobs: JobForPreferenceFilter[],
  preferences: JobSearchPreferences
): JobPreferenceFilterResult[] {
  return jobs.map((job) => evaluateJobAgainstPreferences(job, preferences));
}

export function partitionJobsByPreferences(
  jobs: JobForPreferenceFilter[],
  preferences: JobSearchPreferences
): {
  passed: JobForPreferenceFilter[];
  filtered: JobPreferenceFilterResult[];
  hiddenCount: number;
} {
  const results = filterJobsByPreferences(jobs, preferences);
  const passed: JobForPreferenceFilter[] = [];
  const filtered: JobPreferenceFilterResult[] = [];

  for (const result of results) {
    if (result.pass) {
      passed.push(result.job);
    } else {
      filtered.push(result);
    }
  }

  return { passed, filtered, hiddenCount: filtered.length };
}
