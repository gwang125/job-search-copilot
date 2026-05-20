import * as cheerio from "cheerio";
import type { ParsedJob } from "@/types/database";

const GUEST_JOB_API =
  "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting";

export async function parseLinkedInJobViaGuestApi(
  jobId: string
): Promise<ParsedJob | null> {
  try {
    const response = await fetch(`${GUEST_JOB_API}/${jobId}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

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

    const descriptionHtml =
      $(".description__text, .show-more-less-html__markup, [class*='description']")
        .first()
        .html() ?? "";

    const jobDescription = cheerio
      .load(descriptionHtml || $.root().text())
      .text()
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 20000);

    if (jobDescription.length < 200) return null;

    return {
      company,
      jobTitle,
      location: location || null,
      jobDescription,
    };
  } catch {
    return null;
  }
}
