import * as cheerio from "cheerio";
import type { ParsedJob } from "@/types/database";
import { parseLinkedInJobViaGuestApi } from "@/lib/linkedin/guest-api";
import {
  extractLinkedInJobId,
  isLinkedInJobUrl,
  looksLikeLinkedInLoginWall,
} from "@/lib/linkedin/url";

export interface ParseJobOptions {
  linkedInAccessToken?: string | null;
}

export async function parseJobFromUrl(
  url: string,
  options?: ParseJobOptions
): Promise<ParsedJob> {
  try {
    const parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error("Invalid URL protocol");
    }

    if (isLinkedInJobUrl(url)) {
      return parseLinkedInJob(url, options?.linkedInAccessToken);
    }

    return parseGenericJobPage(url);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown parsing error";
    return {
      company: null,
      jobTitle: null,
      location: null,
      jobDescription: "",
      parseError: message,
    };
  }
}

async function parseLinkedInJob(
  url: string,
  accessToken?: string | null
): Promise<ParsedJob> {
  const jobId = extractLinkedInJobId(url);

  if (jobId) {
    const guest = await parseLinkedInJobViaGuestApi(jobId);
    if (guest && guest.jobDescription.length >= 200) {
      return guest;
    }
  }

  if (accessToken) {
    const authenticated = await parseLinkedInWithToken(url, accessToken);
    if (authenticated && authenticated.jobDescription.length >= 200) {
      return authenticated;
    }

    if (jobId) {
      const guestRetry = await parseLinkedInJobViaGuestApi(jobId);
      if (guestRetry && guestRetry.jobDescription.length >= 200) {
        return guestRetry;
      }
    }
  }

  const generic = await parseGenericJobPage(url, accessToken);
  if (generic.jobDescription.length >= 200 && !generic.parseError) {
    return generic;
  }

  const loginWall =
    generic.parseError?.includes("login") ||
    generic.parseError?.includes("Sign in");

  return {
    company: null,
    jobTitle: null,
    location: null,
    jobDescription: "",
    parseError: loginWall
      ? "This LinkedIn job requires you to sign in. Connect your LinkedIn account, then parse again."
      : "Could not load this LinkedIn job. Sign in with LinkedIn or paste the job description manually.",
    requiresLinkedInAuth: true,
  };
}

async function parseLinkedInWithToken(
  url: string,
  accessToken: string
): Promise<ParsedJob | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });

    if (!response.ok) return null;

    const html = await response.text();
    if (looksLikeLinkedInLoginWall(html, html)) return null;

    return extractJobFromHtml(html);
  } catch {
    return null;
  }
}

async function parseGenericJobPage(
  url: string,
  accessToken?: string | null
): Promise<ParsedJob> {
  try {
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL (${response.status})`);
    }

    const html = await response.text();

    if (isLinkedInJobUrl(url) && looksLikeLinkedInLoginWall(html, html)) {
      throw new Error(
        "LinkedIn returned a sign-in page instead of the job posting"
      );
    }

    return extractJobFromHtml(html);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown parsing error";
    return {
      company: null,
      jobTitle: null,
      location: null,
      jobDescription: "",
      parseError: message,
    };
  }
}

function extractJobFromHtml(html: string): ParsedJob {
  const $ = cheerio.load(html);

  $("script, style, nav, footer, header, noscript").remove();

  const title =
    $('meta[property="og:title"]').attr("content") ||
    $(".top-card-layout__title, .topcard__title, h1").first().text().trim() ||
    $("title").text().trim() ||
    null;

  const company =
    $('meta[property="og:site_name"]').attr("content") ||
    $(".topcard__org-name-link, .top-card-layout__company-name")
      .first()
      .text()
      .trim() ||
    $('[data-company], .company, .job-company, [class*="company"]')
      .first()
      .text()
      .trim() ||
    null;

  const location =
    $(".topcard__flavor--bullet, .top-card-layout__bullet")
      .first()
      .text()
      .trim() ||
    $('[data-location], .location, .job-location, [class*="location"]')
      .first()
      .text()
      .trim() ||
    null;

  const mainText =
    $(".description__text, .show-more-less-html__markup").text() ||
    $("main").text() ||
    $('[role="main"]').text() ||
    $(".job-description, .description, #job-description, article").text() ||
    $("body").text();

  const jobDescription = mainText.replace(/\s+/g, " ").trim().slice(0, 20000);

  if (jobDescription.length < 200) {
    throw new Error(
      "Could not extract enough job description text from this page"
    );
  }

  return {
    company: company || guessCompanyFromTitle(title),
    jobTitle: cleanJobTitle(title),
    location: location || null,
    jobDescription,
  };
}

function guessCompanyFromTitle(title: string | null): string | null {
  if (!title) return null;
  const atMatch = title.match(/\bat\s+(.+?)(?:\s*[-|]|$)/i);
  return atMatch?.[1]?.trim() ?? null;
}

function cleanJobTitle(title: string | null): string | null {
  if (!title) return null;
  return title.split("|")[0]?.split(" - ")[0]?.trim() ?? title;
}
