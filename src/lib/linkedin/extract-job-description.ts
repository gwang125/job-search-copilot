import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";

const DESCRIPTION_SELECTORS = [
  ".show-more-less-html__markup",
  ".description__text--rich",
  ".description__text",
  ".jobs-description__content",
  ".jobs-box__html-content",
  "#job-details",
  ".jobs-description-content__text",
] as const;

/** Salary / compensation blocks that LinkedIn surfaces before the real JD */
export function isSalaryOnlySnippet(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;

  const lower = trimmed.toLowerCase();
  const paySignals =
    /provided pay range|base pay range|compensation range|\/yr|per year|talk with your recruiter to learn more/i.test(
      lower
    );
  const roleSignals =
    /responsibilities|requirements|qualifications|what you['']?ll|what we're looking|you will|about (the role|us)|why you should|benefits:/i.test(
      lower
    );

  if (paySignals && !roleSignals && trimmed.length < 800) return true;
  if (/^[\w\s.'&-]+ provided pay range/i.test(trimmed) && trimmed.length < 800) {
    return true;
  }

  return false;
}

function collectDescriptionCandidates($: CheerioAPI): string[] {
  const candidates: string[] = [];

  for (const selector of DESCRIPTION_SELECTORS) {
    $(selector).each((_, el) => {
      const clone = $(el).clone();
      clone.find("script, style, noscript").remove();
      const text = clone.text().replace(/\s+/g, " ").trim();
      if (text.length >= 80) candidates.push(text);
    });
  }

  return candidates;
}

/**
 * Extract the fullest job description from LinkedIn guest API or job view HTML.
 * Picks the longest viable block and skips salary-only snippets.
 */
export function extractLinkedInJobDescriptionFromHtml(html: string): string {
  const $ = cheerio.load(html);
  return extractLinkedInJobDescriptionFromCheerio($);
}

export function extractLinkedInJobDescriptionFromCheerio($: CheerioAPI): string {
  const raw = collectDescriptionCandidates($);
  const unique = [...new Set(raw)];

  const viable = unique.filter((t) => !isSalaryOnlySnippet(t));
  const pool = viable.length > 0 ? viable : unique;

  pool.sort((a, b) => b.length - a.length);
  const best = pool[0] ?? "";
  if (!best || isSalaryOnlySnippet(best)) return "";
  return best.slice(0, 20000);
}
