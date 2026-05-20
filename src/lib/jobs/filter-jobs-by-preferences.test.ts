import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractRequiredYearsOfExperience,
  filterJobsByPreferences,
} from "./filter-jobs-by-preferences";
import { DEFAULT_JOB_SEARCH_PREFERENCES } from "../supabase/job-search-preferences";
import type { JobSearchPreferences } from "../../types/database";

function prefs(
  overrides: Partial<JobSearchPreferences>
): JobSearchPreferences {
  return {
    id: "test",
    user_id: "user",
    ...DEFAULT_JOB_SEARCH_PREFERENCES,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

const baseJob = {
  id: "1",
  title: "Software Engineer",
  company: "Acme",
  location: "Remote",
  description: "Build features with TypeScript.",
};

describe("extractRequiredYearsOfExperience", () => {
  it("detects 5+ years", () => {
    assert.equal(
      extractRequiredYearsOfExperience("Requires 5+ years of experience"),
      5
    );
  });

  it("detects minimum 4 years", () => {
    assert.equal(
      extractRequiredYearsOfExperience("minimum 4 years in backend"),
      4
    );
  });

  it("uses upper bound for ranges", () => {
    assert.equal(
      extractRequiredYearsOfExperience("2-4 years of experience required"),
      4
    );
  });
});

describe("filterJobsByPreferences", () => {
  it("filters U.S. citizenship", () => {
    const [result] = filterJobsByPreferences(
      [
        {
          ...baseJob,
          description: "U.S. citizenship required.",
        },
      ],
      prefs({ exclude_us_citizenship_required: true })
    );
    assert.equal(result.pass, false);
    assert.ok(result.exclusionReasons.some((r) => r.includes("citizenship")));
  });

  it("filters security clearance", () => {
    const [result] = filterJobsByPreferences(
      [
        {
          ...baseJob,
          description: "Active security clearance required.",
        },
      ],
      prefs({ exclude_security_clearance_required: true })
    );
    assert.equal(result.pass, false);
  });

  it("filters experience above max", () => {
    const [result] = filterJobsByPreferences(
      [
        {
          ...baseJob,
          description: "5+ years of experience in React.",
        },
      ],
      prefs({ max_years_experience: 2 })
    );
    assert.equal(result.pass, false);
    assert.ok(result.exclusionReasons[0]?.includes("5"));
  });

  it("filters blocked keyword in title", () => {
    const [result] = filterJobsByPreferences(
      [
        {
          ...baseJob,
          title: "Senior Software Engineer",
        },
      ],
      prefs({ blocked_keywords: ["senior"] })
    );
    assert.equal(result.pass, false);
    assert.ok(result.exclusionReasons.some((r) => r.includes("senior")));
  });

  it("passes when no rules violated", () => {
    const [result] = filterJobsByPreferences([baseJob], prefs({}));
    assert.equal(result.pass, true);
    assert.equal(result.exclusionReasons.length, 0);
  });
});
