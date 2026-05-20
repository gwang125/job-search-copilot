"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PrimaryButton } from "@/components/ui/primary-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { DiscoveredJobMatch, Resume } from "@/types/database";
import type { LinkedInPostedWithin, LinkedInWorkType } from "@/lib/linkedin/search-jobs";
import {
  clearFindJobsSession,
  formatSessionSavedAt,
  loadFindJobsSession,
  saveFindJobsSession,
} from "@/lib/find-jobs-session-cache";
import {
  Compass,
  ExternalLink,
  Loader2,
  ScanSearch,
  Star,
  X,
} from "lucide-react";

interface JobDiscoveryPanelProps {
  userId: string;
  resumes: Resume[];
  defaultKeywords?: string;
  defaultLocation?: string;
}

const selectClassName =
  "h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

export function JobDiscoveryPanel({
  userId,
  resumes,
  defaultKeywords = "",
  defaultLocation = "",
}: JobDiscoveryPanelProps) {
  const primaryResume = useMemo(
    () => resumes.find((r) => r.is_primary) ?? resumes[0],
    [resumes]
  );

  const [keywords, setKeywords] = useState(defaultKeywords);
  const [location, setLocation] = useState(defaultLocation);
  const [resumeId, setResumeId] = useState(primaryResume?.id ?? "");
  const [postedWithin, setPostedWithin] = useState<LinkedInPostedWithin>("any");
  const [workType, setWorkType] = useState<LinkedInWorkType>("any");
  const [minMatchScore, setMinMatchScore] = useState(60);
  const [limit, setLimit] = useState(15);

  const [sessionReady, setSessionReady] = useState(false);
  const [sessionSavedAt, setSessionSavedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<DiscoveredJobMatch[]>([]);
  const [meta, setMeta] = useState<{
    listingsFound: number;
    hiddenByApplied: number;
    hiddenByPreferences: number;
    resumeName: string;
  } | null>(null);

  const skipNextSave = useRef(false);

  useEffect(() => {
    const cached = loadFindJobsSession(userId);
    if (cached) {
      skipNextSave.current = true;
      setKeywords(cached.filters.keywords);
      setLocation(cached.filters.location);
      setResumeId(cached.filters.resumeId);
      setPostedWithin(cached.filters.postedWithin);
      setWorkType(cached.filters.workType);
      setMinMatchScore(cached.filters.minMatchScore);
      setLimit(cached.filters.limit);
      setJobs(cached.jobs);
      setMeta(cached.meta);
      setSessionSavedAt(cached.savedAt);
    }
    setSessionReady(true);
  }, [userId]);

  useEffect(() => {
    if (!sessionReady || loading) return;
    if (!meta || jobs.length === 0) return;

    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    const savedAt = new Date().toISOString();
    saveFindJobsSession(userId, {
      savedAt,
      filters: {
        keywords,
        location,
        resumeId,
        postedWithin,
        workType,
        minMatchScore,
        limit,
      },
      jobs,
      meta,
    });
    setSessionSavedAt(savedAt);
  }, [
    sessionReady,
    loading,
    userId,
    keywords,
    location,
    resumeId,
    postedWithin,
    workType,
    minMatchScore,
    limit,
    jobs,
    meta,
  ]);

  function clearSavedResults() {
    skipNextSave.current = true;
    clearFindJobsSession(userId);
    setJobs([]);
    setMeta(null);
    setSessionSavedAt(null);
    setError(null);
  }

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setJobs([]);
    setMeta(null);
    setSessionSavedAt(null);
    clearFindJobsSession(userId);

    try {
      const res = await fetch("/api/jobs/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: keywords.trim(),
          location: location.trim() || undefined,
          resumeId: resumeId || undefined,
          postedWithin,
          workType,
          minMatchScore,
          limit,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Search failed");
      }
      setJobs(data.jobs ?? []);
      setMeta({
        listingsFound: data.listingsFound ?? 0,
        hiddenByApplied: data.hiddenByApplied ?? 0,
        hiddenByPreferences: data.hiddenByPreferences ?? 0,
        resumeName: data.resumeUsed?.name ?? "Resume",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  if (!resumes.length) {
    return (
      <Alert variant="warning">
        Upload at least one resume on the{" "}
        <Link href="/resumes" className="font-medium text-indigo-600 hover:underline">
          Resumes
        </Link>{" "}
        page before searching LinkedIn.
      </Alert>
    );
  }

  const hasSavedResults = jobs.length > 0 && meta && sessionSavedAt;

  return (
    <div className="space-y-6">
      <Alert>
        Results come from LinkedIn&apos;s public job search. Listings at companies
        you already applied to are skipped, along with your profile hard requirements,
        before AI scoring. Your last search stays in this tab until you search again.{" "}
        <Link href="/profile" className="font-medium text-indigo-600 hover:underline">
          Edit hard requirements
        </Link>
      </Alert>

      {hasSavedResults && sessionReady && (
        <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing saved results from{" "}
            <span className="font-medium">
              {formatSessionSavedAt(sessionSavedAt)}
            </span>{" "}
            ({jobs.length} job{jobs.length === 1 ? "" : "s"})
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-emerald-800 hover:bg-emerald-100/80"
            onClick={clearSavedResults}
          >
            <X className="h-3.5 w-3.5" />
            Clear results
          </Button>
        </div>
      )}

      <Card>
        <form onSubmit={runSearch} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="keywords">Keywords</Label>
              <Input
                id="keywords"
                placeholder="e.g. software engineer react"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location (optional)</Label>
              <Input
                id="location"
                placeholder="e.g. San Francisco Bay Area"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resume">Resume to match</Label>
              <select
                id="resume"
                value={resumeId}
                onChange={(e) => setResumeId(e.target.value)}
                className={selectClassName}
              >
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.is_primary ? " (primary)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="postedWithin">Posted</Label>
              <select
                id="postedWithin"
                value={postedWithin}
                onChange={(e) =>
                  setPostedWithin(e.target.value as LinkedInPostedWithin)
                }
                className={selectClassName}
              >
                <option value="any">Any time</option>
                <option value="24h">Past 24 hours</option>
                <option value="week">Past week</option>
                <option value="month">Past month</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="workType">Work type</Label>
              <select
                id="workType"
                value={workType}
                onChange={(e) => setWorkType(e.target.value as LinkedInWorkType)}
                className={selectClassName}
              >
                <option value="any">Any</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="minMatchScore">Minimum match %</Label>
              <Input
                id="minMatchScore"
                type="number"
                min={0}
                max={100}
                value={minMatchScore}
                onChange={(e) => setMinMatchScore(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="limit">Jobs to score (5–25)</Label>
              <Input
                id="limit"
                type="number"
                min={5}
                max={25}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              />
            </div>
          </div>

          <PrimaryButton type="submit" disabled={loading || !keywords.trim()}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching and scoring…
              </>
            ) : (
              <>
                <Compass className="h-4 w-4" />
                {hasSavedResults ? "Search again" : "Find matching jobs"}
              </>
            )}
          </PrimaryButton>
        </form>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      {meta && !loading && (
        <p className="text-sm text-zinc-600">
          Scored against <span className="font-medium">{meta.resumeName}</span>
          {meta.listingsFound > 0 && (
            <>
              {" "}
              · {meta.listingsFound} found
              {meta.hiddenByApplied > 0 && (
                <>
                  , {meta.hiddenByApplied} at companies you already applied to
                </>
              )}
              {meta.hiddenByPreferences > 0 && (
                <>, {meta.hiddenByPreferences} hidden by your filters</>
              )}
              {jobs.length > 0 && <>, {jobs.length} shown</>}
            </>
          )}
          {jobs.length === 0 &&
            (meta.hiddenByApplied > 0 || meta.hiddenByPreferences > 0
              ? " · remaining jobs were hidden by filters, already applied, or match score"
              : " · no jobs met your minimum match score")}
        </p>
      )}

      {jobs.length > 0 && sessionReady && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50/80 text-xs font-medium uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-6 py-3">Match</th>
                  <th className="px-6 py-3">Position</th>
                  <th className="px-6 py-3">Company</th>
                  <th className="px-6 py-3">Location</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {jobs.map((job) => (
                  <tr key={job.linkedInJobId} className="hover:bg-zinc-50/50">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 font-semibold text-indigo-600">
                        {job.matchScore}%
                        {job.matchScore >= 80 && (
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        )}
                      </span>
                      {job.matchNote && (
                        <p className="mt-1 max-w-[200px] text-xs text-zinc-500 line-clamp-2">
                          {job.matchNote}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-zinc-900">{job.title}</p>
                      {job.postedText && (
                        <p className="mt-0.5 text-xs text-zinc-500">{job.postedText}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-zinc-700">
                      {job.company ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-zinc-600">
                      {job.location ?? "—"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <a
                          href={job.jobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex"
                        >
                          <Button type="button" variant="outline" size="sm">
                            <ExternalLink className="h-3.5 w-3.5" />
                            LinkedIn
                          </Button>
                        </a>
                        <Link
                          href={`/job-analyzer?jobUrl=${encodeURIComponent(job.jobUrl)}&returnTo=find-jobs`}
                        >
                          <Button type="button" variant="ghost" size="sm">
                            <ScanSearch className="h-3.5 w-3.5" />
                            Analyze
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {jobs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {jobs
            .filter((j) => j.matchScore >= 75)
            .slice(0, 3)
            .map((j) => (
              <Badge key={j.linkedInJobId}>
                {j.matchScore}% · {j.title}
              </Badge>
            ))}
        </div>
      )}
    </div>
  );
}
