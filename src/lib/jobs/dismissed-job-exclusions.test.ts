import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LinkedInJobListing } from "../linkedin/search-jobs";
import {
  filterListingsExcludingDismissed,
  listingMatchesDismissal,
  buildDismissalIndex,
} from "./dismissed-job-exclusions";

const listing: LinkedInJobListing = {
  linkedInJobId: "12345",
  title: "Engineer",
  company: "Acme",
  location: "Remote",
  jobUrl: "https://www.linkedin.com/jobs/view/12345",
  postedText: null,
};

describe("dismissed job exclusions", () => {
  it("matches by linkedin job id", () => {
    const index = buildDismissalIndex([
      { linkedin_job_id: "12345", job_url: null },
    ]);
    assert.equal(listingMatchesDismissal(listing, index), true);
  });

  it("filters dismissed listings", () => {
    const { remaining, hiddenCount } = filterListingsExcludingDismissed(
      [listing],
      [{ linkedin_job_id: "12345", job_url: listing.jobUrl }]
    );
    assert.equal(hiddenCount, 1);
    assert.equal(remaining.length, 0);
  });
});
