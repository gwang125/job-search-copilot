import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractLinkedInJobDescriptionFromHtml,
  isSalaryOnlySnippet,
} from "./extract-job-description";

const salaryBlock = `Blossom provided pay range This range is provided by Blossom.
Your actual pay will be based on your skills and experience — talk with your recruiter to learn more.
Base pay range $150,000.00/yr - $220,000.00/yr`;

const fullJd = `Blossom Health exists to solve the mental health epidemic in America.
What we're looking for: ownership mindset and high velocity.
What you'll do: Design and build scalable systems. Ship high-quality code.
Requirements: 2+ years of experience. TypeScript and Python.`;

describe("isSalaryOnlySnippet", () => {
  it("detects pay-range-only text", () => {
    assert.equal(isSalaryOnlySnippet(salaryBlock), true);
  });

  it("accepts full job description", () => {
    assert.equal(isSalaryOnlySnippet(fullJd), false);
  });
});

describe("extractLinkedInJobDescriptionFromHtml", () => {
  it("prefers show-more-less markup over salary description block", () => {
    const html = `
      <div class="description__text">${salaryBlock}</div>
      <div class="show-more-less-html__markup">${fullJd}</div>
    `;
    const text = extractLinkedInJobDescriptionFromHtml(html);
    assert.ok(text.includes("What you'll do"));
    assert.ok(text.includes("mental health"));
    assert.ok(!text.startsWith("Blossom provided pay range"));
  });
});
