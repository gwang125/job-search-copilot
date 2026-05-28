import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { linkedInHttpErrorMessage } from "./linkedin-http-errors";

describe("linkedInHttpErrorMessage", () => {
  it("explains 429 rate limit clearly", () => {
    const msg = linkedInHttpErrorMessage("job_search", 429, 120);
    assert.match(msg, /429/);
    assert.match(msg, /rate-limit/i);
    assert.match(msg, /2 minutes/);
  });

  it("explains 403 block", () => {
    const msg = linkedInHttpErrorMessage("job_search", 403);
    assert.match(msg, /403/);
    assert.match(msg, /block/i);
  });
});
