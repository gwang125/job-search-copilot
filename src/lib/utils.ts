import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeCompany(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|co)\b\.?/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export function normalizeJobTitle(title: string | null | undefined): string {
  if (!title) return "";
  return title
    .toLowerCase()
    .replace(/\b(senior|sr|junior|jr|lead|staff|principal|ii|iii|iv)\b/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function titlesAreSimilar(a: string, b: string): boolean {
  const na = normalizeJobTitle(a);
  const nb = normalizeJobTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const wordsA = new Set(na.split(" ").filter((w) => w.length > 2));
  const wordsB = new Set(nb.split(" ").filter((w) => w.length > 2));
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  const minSize = Math.min(wordsA.size, wordsB.size);
  return minSize > 0 && overlap / minSize >= 0.6;
}

export function recommendationLabel(rec: string): string {
  switch (rec) {
    case "apply":
      return "Apply";
    case "maybe":
      return "Maybe";
    case "skip":
      return "Skip";
    default:
      return rec;
  }
}

export function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** @deprecated Resumes are uploaded via /api/resumes/upload (PDF/DOCX only). */
export async function extractTextFromFile(_file: File): Promise<string> {
  throw new Error(
    "Upload PDF or DOCX files on the Resumes page instead of pasting text."
  );
}

/** Partial job fields from `jobs(company, job_title)` selects */
export type JobSummary = {
  company: string | null;
  job_title: string | null;
};

/** Supabase nested relations may infer as a single row or an array */
export function resolveJobRelation<T>(
  relation: T | T[] | null | undefined
): T | null {
  if (relation == null) return null;
  if (Array.isArray(relation)) return relation[0] ?? null;
  return relation;
}
