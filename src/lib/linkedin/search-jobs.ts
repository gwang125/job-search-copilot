import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { throwLinkedInHttpError } from "@/lib/linkedin/linkedin-http-errors";
import { throttleLinkedInRequest } from "@/lib/linkedin/rate-limit";
import { extractLinkedInJobId } from "@/lib/linkedin/url";

const SEARCH_API =
  "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};

export type LinkedInPostedWithin = "any" | "24h" | "week" | "month";
export type LinkedInWorkType = "any" | "remote" | "hybrid" | "onsite";

export interface LinkedInSearchParams {
  keywords: string;
  location?: string;
  start?: number;
  postedWithin?: LinkedInPostedWithin;
  workType?: LinkedInWorkType;
}

export interface LinkedInJobListing {
  linkedInJobId: string;
  title: string;
  company: string | null;
  location: string | null;
  jobUrl: string;
  postedText: string | null;
}

function postedWithinParam(value: LinkedInPostedWithin): string | undefined {
  switch (value) {
    case "24h":
      return "r86400";
    case "week":
      return "r604800";
    case "month":
      return "r2592000";
    default:
      return undefined;
  }
}

function workTypeParam(value: LinkedInWorkType): string | undefined {
  switch (value) {
    case "remote":
      return "2";
    case "hybrid":
      return "3";
    case "onsite":
      return "1";
    default:
      return undefined;
  }
}

function normalizeJobUrl(href: string): string {
  if (href.startsWith("http")) return href.split("?")[0] ?? href;
  return `https://www.linkedin.com${href.split("?")[0]}`;
}

function parseListingFromCard(
  $: cheerio.CheerioAPI,
  card: Element
): LinkedInJobListing | null {
  const $card = $(card);
  const link =
    $card.find("a.base-card__full-link, a[class*='full-link']").first().attr("href") ??
    $card.find("a[href*='/jobs/view/']").first().attr("href");

  if (!link) return null;

  const jobUrl = normalizeJobUrl(link);
  const linkedInJobId = extractLinkedInJobId(jobUrl);
  if (!linkedInJobId) return null;

  const title =
    $card.find(".base-search-card__title, [class*='title']").first().text().trim() ||
    $card.find("h3").first().text().trim();

  if (!title) return null;

  const company =
    $card
      .find(".base-search-card__subtitle, [class*='subtitle']")
      .first()
      .text()
      .trim() || null;

  const location =
    $card
      .find(".job-search-card__location, [class*='location']")
      .first()
      .text()
      .trim() || null;

  const postedText =
    $card.find("time, [class*='listdate']").first().text().trim() || null;

  return {
    linkedInJobId,
    title,
    company,
    location,
    jobUrl,
    postedText,
  };
}

export async function searchLinkedInJobs(
  params: LinkedInSearchParams
): Promise<LinkedInJobListing[]> {
  const keywords = params.keywords.trim();
  if (!keywords) {
    throw new Error("Search keywords are required");
  }

  const query = new URLSearchParams();
  query.set("keywords", keywords);
  if (params.location?.trim()) query.set("location", params.location.trim());
  query.set("start", String(params.start ?? 0));

  const fTpr = postedWithinParam(params.postedWithin ?? "any");
  if (fTpr) query.set("f_TPR", fTpr);

  const fWt = workTypeParam(params.workType ?? "any");
  if (fWt) query.set("f_WT", fWt);

  await throttleLinkedInRequest();

  const response = await fetch(`${SEARCH_API}?${query.toString()}`, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throwLinkedInHttpError("job_search", response);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const seen = new Set<string>();
  const listings: LinkedInJobListing[] = [];

  $("li").each((_, li) => {
    const hasCard =
      $(li).find(".base-card, div.base-card").length > 0 ||
      $(li).find("a[href*='/jobs/view/']").length > 0;
    if (!hasCard) return;

    const parsed = parseListingFromCard($, li);
    if (!parsed || seen.has(parsed.linkedInJobId)) return;
    seen.add(parsed.linkedInJobId);
    listings.push(parsed);
  });

  if (listings.length === 0) {
    $("div.base-card").each((_, card) => {
      const parsed = parseListingFromCard($, card);
      if (!parsed || seen.has(parsed.linkedInJobId)) return;
      seen.add(parsed.linkedInJobId);
      listings.push(parsed);
    });
  }

  return listings;
}
