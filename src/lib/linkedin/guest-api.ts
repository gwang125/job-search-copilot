import * as cheerio from "cheerio";
import type { ParsedJob } from "@/types/database";
import { extractLinkedInJobDescriptionFromCheerio } from "@/lib/linkedin/extract-job-description";
import { throwLinkedInHttpError, isLinkedInHttpError } from "@/lib/linkedin/linkedin-http-errors";

const GUEST_JOB_API =
  "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};

export async function parseLinkedInJobViaGuestApi(
  jobId: string
): Promise<ParsedJob | null> {
  try {
    const response = await fetch(`${GUEST_JOB_API}/${jobId}`, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throwLinkedInHttpError("job_posting", response);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const jobTitle =
      $(".top-card-layout__title, .topcard__title, h1")
        .first()
        .text()
        .trim() ||
      $('meta[property="og:title"]').attr("content")?.trim() ||
      null;

    const company =
      $(".topcard__org-name-link, .top-card-layout__company-name, a[data-tracking-control-name*='company']")
        .first()
        .text()
        .trim() || null;

    const location =
      $(".topcard__flavor--bullet, .top-card-layout__bullet").first().text().trim() ||
      null;

    const jobDescription = extractLinkedInJobDescriptionFromCheerio($);

    if (jobDescription.length < 200) return null;

    return {
      company,
      jobTitle,
      location: location || null,
      jobDescription,
    };
  } catch (error) {
    if (isLinkedInHttpError(error)) throw error;
    return null;
  }
}

/** Fallback when guest API description is thin — public job view page */
export async function parseLinkedInJobViaViewPage(
  jobId: string
): Promise<ParsedJob | null> {
  try {
    const response = await fetch(
      `https://www.linkedin.com/jobs/view/${jobId}`,
      {
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(15000),
        redirect: "follow",
      }
    );

    if (!response.ok) {
      throwLinkedInHttpError("job_posting", response);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const jobDescription = extractLinkedInJobDescriptionFromCheerio($);
    if (jobDescription.length < 200) return null;

    const jobTitle =
      $(".top-card-layout__title, .topcard__title, h1")
        .first()
        .text()
        .trim() ||
      $('meta[property="og:title"]').attr("content")?.trim() ||
      null;

    const company =
      $(".topcard__org-name-link, .top-card-layout__company-name")
        .first()
        .text()
        .trim() || null;

    const location =
      $(".topcard__flavor--bullet, .top-card-layout__bullet").first().text().trim() ||
      null;

    return {
      company,
      jobTitle,
      location: location || null,
      jobDescription,
    };
  } catch (error) {
    if (isLinkedInHttpError(error)) throw error;
    return null;
  }
}
