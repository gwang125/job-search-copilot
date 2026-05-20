import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAppliedExclusionIndex,
  listingMatchesAppliedJob,
} from "./applied-job-exclusions";
import type { LinkedInJobListing } from "@/lib/linkedin/search-jobs";

const listing: LinkedInJobListing = {
  linkedInJobId: "9999999999",
  title: "Senior Product Manager",
  company: "Acme Inc",
  location: "Remote",
  jobUrl: "https://www.linkedin.com/jobs/view/9999999999",
  postedText: null,
};

describe("applied-job-exclusions", () => {
  it("excludes any role at a company you already applied to", () => {
    const index = buildAppliedExclusionIndex([
      {
        status: "applied",
        job: {
          company: "Acme Inc.",
          job_title: "Software Engineer",
          job_url: "https://www.linkedin.com/jobs/view/1234567890",
        },
      },
    ]);
    assert.equal(listingMatchesAppliedJob(listing, index), true);
  });

  it("does not exclude a different company", () => {
    const index = buildAppliedExclusionIndex([
      {
        status: "applied",
        job: {
          company: "Other Corp",
          job_title: "Developer",
          job_url: null,
        },
      },
    ]);
    assert.equal(listingMatchesAppliedJob(listing, index), false);
  });

  it("ignores non-applied statuses for company blocklist", () => {
    const index = buildAppliedExclusionIndex([
      {
        status: "saved",
        job: { company: "Acme Inc", job_title: "Engineer", job_url: null },
      },
    ]);
    assert.equal(listingMatchesAppliedJob(listing, index), false);
  });

  it("matches by LinkedIn job id when company name is missing", () => {
    const index = buildAppliedExclusionIndex([
      {
        status: "applied",
        job: {
          company: null,
          job_title: "Engineer",
          job_url: "https://www.linkedin.com/jobs/view/9999999999",
        },
      },
    ]);
    assert.equal(listingMatchesAppliedJob(listing, index), true);
  });
});
