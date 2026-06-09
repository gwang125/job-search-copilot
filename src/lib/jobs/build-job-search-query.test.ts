import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildJobSearchQueryFromPreferences,
  listingFailsQuickExclusion,
} from "./build-job-search-query";
import { DEFAULT_JOB_SEARCH_PREFERENCES } from "../supabase/job-search-preferences";
import type { JobSearchPreferences } from "../../types/database";

function prefs(
  overrides: Partial<JobSearchPreferences> = {}
): JobSearchPreferences {
  return {
    id: "p1",
    user_id: "u1",
    created_at: "",
    updated_at: "",
    ...DEFAULT_JOB_SEARCH_PREFERENCES,
    ...overrides,
  };
}

describe("buildJobSearchQueryFromPreferences", () => {
  it("expands entry-level queries when max experience is 2", () => {
    const plan = buildJobSearchQueryFromPreferences({
      keyword: "software engineer",
      workType: "any",
      targetJobTitles: [],
      preferences: prefs({ max_years_experience: 2 }),
    });

    assert.ok(plan.searchKeywords.length > 1);
    assert.match(plan.searchKeywords[0], /new grad|entry level|junior|0-2/i);
    assert.ok(plan.searchKeywords.some((q) => q === "software engineer"));
    assert.ok(plan.searchKeywords.some((q) => /entry level/i.test(q)));
    assert.ok(plan.searchKeywords.some((q) => /new grad/i.test(q)));
    for (const term of ["senior", "staff", "principal"]) {
      assert.ok(plan.excludedTerms.includes(term));
    }
  });

  it("adds clearance and citizenship exclusions when enabled", () => {
    const plan = buildJobSearchQueryFromPreferences({
      keyword: "engineer",
      workType: "any",
      targetJobTitles: [],
      preferences: prefs({
        exclude_security_clearance_required: true,
        exclude_us_citizenship_required: true,
      }),
    });

    assert.ok(plan.excludedTerms.some((t) => /clearance/i.test(t)));
    assert.ok(plan.excludedTerms.some((t) => /citizenship/i.test(t)));
  });

  it("merges blocked keywords into excluded terms", () => {
    const plan = buildJobSearchQueryFromPreferences({
      keyword: "developer",
      workType: "any",
      targetJobTitles: [],
      preferences: prefs({ blocked_keywords: ["contract", "freelance"] }),
    });

    assert.ok(plan.excludedTerms.includes("contract"));
    assert.ok(plan.excludedTerms.includes("freelance"));
  });
});

describe("listingFailsQuickExclusion", () => {
  it("flags senior titles before description fetch", () => {
    assert.equal(
      listingFailsQuickExclusion(
        {
          title: "Senior Software Engineer",
          company: "Acme",
          location: "Remote",
        },
        ["senior"]
      ),
      true
    );
  });
});
