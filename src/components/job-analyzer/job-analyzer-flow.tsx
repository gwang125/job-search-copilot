"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { recommendationLabel } from "@/lib/utils";
import type {
  DuplicateWarning,
  JobMatchAnalysis,
  Resume,
} from "@/types/database";
import { PrimaryButton } from "@/components/ui/primary-button";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  Linkedin,
  ExternalLink,
  Star,
} from "lucide-react";

function isLinkedInJobUrlClient(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.includes("linkedin.com") &&
      (parsed.pathname.includes("/jobs/") ||
        parsed.searchParams.has("currentJobId"))
    );
  } catch {
    return false;
  }
}

const STEPS = ["Job details", "Match analysis"] as const;
type Step = 0 | 1;

interface JobAnalyzerFlowProps {
  initialResumes: Resume[];
}

export function JobAnalyzerFlow({ initialResumes }: JobAnalyzerFlowProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>(0);
  const [jobUrl, setJobUrl] = useState("");
  const [linkedInConnected, setLinkedInConnected] = useState(false);
  const [linkedInConfigured, setLinkedInConfigured] = useState(true);
  const [linkedInAuthUrl, setLinkedInAuthUrl] = useState<string | null>(null);
  const [linkedInNotice, setLinkedInNotice] = useState<string | null>(null);
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateWarning | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(
    null
  );
  const [markingApplied, setMarkingApplied] = useState(false);
  const [appliedMessage, setAppliedMessage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<JobMatchAnalysis | null>(null);

  const resumes = initialResumes;
  const showLinkedInHelp = isLinkedInJobUrlClient(jobUrl);
  const recommendedResume = analysis
    ? resumes.find((r) => r.id === analysis.bestResumeId)
    : undefined;

  const resumeRankings =
    analysis?.resumeScores?.length &&
    analysis.resumeScores.length > 0
      ? analysis.resumeScores
      : analysis
        ? [
            {
              resumeId: analysis.bestResumeId,
              score: analysis.matchScore,
              note: "Recommended for this role",
            },
          ]
        : [];

  const refreshLinkedInStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/linkedin/status");
      if (!res.ok) return;
      const data = await res.json();
      setLinkedInConfigured(data.configured !== false);
      setLinkedInConnected(Boolean(data.connected));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshLinkedInStatus();
  }, [refreshLinkedInStatus]);

  useEffect(() => {
    const status = searchParams.get("linkedin");
    const returnJobUrl = searchParams.get("jobUrl");

    if (status === "connected") {
      setLinkedInConnected(true);
      setLinkedInNotice("LinkedIn connected. Parsing your job link now…");
      if (returnJobUrl) setJobUrl(returnJobUrl);
    } else if (status === "error") {
      setLinkedInNotice(
        "LinkedIn sign-in was cancelled or failed. Try again or paste the job description below."
      );
    }
  }, [searchParams]);

  const parseUrl = useCallback(
    async (urlOverride?: string) => {
      const targetUrl = (urlOverride ?? jobUrl).trim();
      if (!targetUrl) return;
      setLoading(true);
      setError(null);
      setLinkedInAuthUrl(null);
      try {
        const res = await fetch("/api/jobs/parse-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: targetUrl }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.requiresLinkedInAuth && data.linkedInAuthUrl) {
            setLinkedInAuthUrl(data.linkedInAuthUrl);
          }
          throw new Error(data.error ?? "Failed to parse URL");
        }
        setCompany(data.company ?? "");
        setJobTitle(data.jobTitle ?? "");
        setLocation(data.location ?? "");
        setJobDescription(data.jobDescription ?? "");
        setLinkedInNotice(null);
        if (data.linkedInConnected) setLinkedInConnected(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Parse failed");
      } finally {
        setLoading(false);
      }
    },
    [jobUrl]
  );

  const parsedAfterLinkedInConnect = useRef(false);
  const prefilledJobUrl = useRef(false);

  useEffect(() => {
    if (searchParams.get("linkedin")) return;
    const url = searchParams.get("jobUrl");
    if (!url || prefilledJobUrl.current) return;
    prefilledJobUrl.current = true;
    setJobUrl(url);
    void parseUrl(url);
  }, [searchParams, parseUrl]);

  useEffect(() => {
    if (searchParams.get("linkedin") !== "connected") return;
    const returnJobUrl = searchParams.get("jobUrl");
    if (!returnJobUrl || parsedAfterLinkedInConnect.current) return;
    parsedAfterLinkedInConnect.current = true;
    void parseUrl(returnJobUrl);
  }, [searchParams, parseUrl]);

  async function checkDuplicate() {
    const res = await fetch("/api/jobs/check-duplicate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company, jobTitle }),
    });
    const data = (await res.json()) as DuplicateWarning;
    setDuplicate(data);
    return data;
  }

  async function runAnalysis() {
    if (!jobDescription.trim()) {
      setError("Job description is required.");
      return;
    }
    if (resumes.length === 0) {
      setError("Add at least one resume on the Resumes page before analyzing.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await checkDuplicate();

      const res = await fetch("/api/jobs/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription,
          company: company || null,
          jobTitle: jobTitle || null,
          location: location || null,
          jobUrl: jobUrl || null,
          jobId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");

      setJobId(data.jobId);
      setApplicationId(data.application?.id ?? null);
      setApplicationStatus(data.application?.status ?? "saved");
      setAppliedMessage(null);
      setAnalysis(data.matchAnalysis);
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  function recommendationVariant(
    rec: string
  ): "success" | "warning" | "danger" {
    if (rec === "apply") return "success";
    if (rec === "maybe") return "warning";
    return "danger";
  }

  function analyzeAnother() {
    setStep(0);
    setAnalysis(null);
    setError(null);
    setDuplicate(null);
    setApplicationId(null);
    setApplicationStatus(null);
    setAppliedMessage(null);
  }

  async function markAsApplied() {
    if (!applicationId) {
      setError("No application to update. Run analysis again.");
      return;
    }
    setMarkingApplied(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "applied" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to update status");
      }
      setApplicationStatus("applied");
      setAppliedMessage("Marked as applied. Pick your next job on Find jobs.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mark as applied");
    } finally {
      setMarkingApplied(false);
    }
  }

  function goToFindJobs() {
    router.push("/find-jobs");
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2 border-b border-zinc-200/80 pb-6">
        {STEPS.map((label, i) => {
          const isComplete = step > i;
          return (
            <div
              key={label}
              className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                step === i
                  ? "bg-zinc-900 text-white shadow-sm"
                  : isComplete
                    ? "bg-indigo-50 text-indigo-700"
                    : "bg-zinc-100 text-zinc-500"
              }`}
            >
              {isComplete ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px]">
                  {i + 1}
                </span>
              )}
              {label}
            </div>
          );
        })}
      </div>

      {error && (
        <Alert variant="error" className="whitespace-pre-wrap">
          {error}
        </Alert>
      )}

      {step === 0 && (
        <Card className="space-y-5">
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">
            Job details
          </h2>
          <div className="flex gap-2">
            <Input
              placeholder="Paste job posting URL (LinkedIn supported)"
              value={jobUrl}
              onChange={(e) => {
                setJobUrl(e.target.value);
                setLinkedInAuthUrl(null);
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => parseUrl()}
              loading={loading}
            >
              Parse
            </Button>
          </div>

          {showLinkedInHelp && (
            <div className="rounded-lg border border-sky-200/80 bg-sky-50/80 p-4 text-sm text-sky-950">
              <p className="font-medium">LinkedIn job link</p>
              <p className="mt-1 text-sky-900/90">
                Many postings load without signing in. If Parse fails, connect
                LinkedIn or paste the description manually.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {linkedInConfigured ? (
                  linkedInConnected ? (
                    <Badge variant="success">LinkedIn connected</Badge>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-sky-300 bg-white"
                      onClick={() => {
                        window.location.href =
                          linkedInAuthUrl ??
                          `/api/auth/linkedin?jobUrl=${encodeURIComponent(jobUrl.trim())}`;
                      }}
                    >
                      <Linkedin className="h-4 w-4" />
                      Sign in with LinkedIn
                    </Button>
                  )
                ) : null}
                {jobUrl.trim() && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(jobUrl.trim(), "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open on LinkedIn
                  </Button>
                )}
              </div>
            </div>
          )}

          {linkedInNotice && (
            <Alert variant={linkedInConnected ? "success" : "warning"}>
              {linkedInNotice}
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Company</Label>
              <Input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Job title</Label>
              <Input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Location</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Job description</Label>
            <Textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={12}
              placeholder="Paste the full job description..."
            />
          </div>
          {duplicate?.isDuplicate && (
            <Alert variant="warning">{duplicate.message}</Alert>
          )}
          <Button onClick={runAnalysis} loading={loading} className="w-full sm:w-auto">
            Analyze match
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Card>
      )}

      {step === 1 && analysis && (
        <div className="space-y-4">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-zinc-900">
                Match analysis
              </h2>
              <Badge variant={recommendationVariant(analysis.recommendation)}>
                {recommendationLabel(analysis.recommendation)}
              </Badge>
            </div>
            <p className="text-3xl font-bold text-indigo-600">
              {analysis.matchScore}%
              <span className="ml-2 text-sm font-normal text-zinc-500">
                overall match
              </span>
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-medium text-zinc-700">
                  Matched skills
                </h3>
                <ul className="list-inside list-disc text-sm text-zinc-600">
                  {analysis.matchedSkills.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-zinc-700">Gaps</h3>
                <ul className="list-inside list-disc text-sm text-zinc-600">
                  {analysis.missingSkills.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
            {analysis.reasons.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-zinc-700">Why</h3>
                <ul className="space-y-1 text-sm text-zinc-600">
                  {analysis.reasons.map((r, i) => (
                    <li key={i}>• {r}</li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.risks.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-zinc-700">Risks</h3>
                <ul className="space-y-1 text-sm text-zinc-600">
                  {analysis.risks.map((r, i) => (
                    <li key={i}>• {r}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card className="space-y-4 border-indigo-200/80 bg-indigo-50/30">
            <h2 className="text-lg font-semibold text-zinc-900">
              Which resume to use
            </h2>
            {recommendedResume ? (
              <div className="flex flex-col gap-4 rounded-lg border border-indigo-200/80 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-zinc-900">
                        {recommendedResume.name}
                      </p>
                      <Badge variant="success">Use this one</Badge>
                      {recommendedResume.is_primary && (
                        <Badge variant="info">
                          <Star className="mr-1 inline h-3 w-3" />
                          Primary
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-zinc-600">
                      {recommendedResume.file_name ?? "Resume file"}
                    </p>
                  </div>
                </div>
                {recommendedResume.file_path && (
                  <a
                    href={`/api/resumes/${recommendedResume.id}/file`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
                  >
                    <Download className="h-4 w-4" />
                    Download resume
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-600">
                Recommended resume ID not found. Check your uploads on the
                Resumes page.
              </p>
            )}

            {resumes.length > 1 && resumeRankings.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-zinc-700">
                  All resumes compared
                </h3>
                <ul className="divide-y divide-zinc-200/80 rounded-lg border border-zinc-200/80 bg-white">
                  {resumeRankings.map((row) => {
                    const resume = resumes.find((r) => r.id === row.resumeId);
                    const isBest = row.resumeId === analysis.bestResumeId;
                    return (
                      <li
                        key={row.resumeId}
                        className={`flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
                          isBest ? "bg-indigo-50/50" : ""
                        }`}
                      >
                        <div>
                          <span className="font-medium text-zinc-900">
                            {resume?.name ?? "Unknown resume"}
                          </span>
                          {row.note && (
                            <p className="text-zinc-500">{row.note}</p>
                          )}
                        </div>
                        <span
                          className={`font-semibold ${isBest ? "text-indigo-600" : "text-zinc-600"}`}
                        >
                          {row.score}%
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </Card>

          {appliedMessage && (
            <Alert variant="success">{appliedMessage}</Alert>
          )}

          <Card className="border-zinc-200 bg-zinc-50/50">
            <h3 className="text-sm font-semibold text-zinc-900">
              Done with this job?
            </h3>
            <p className="mt-1 text-sm text-zinc-600">
              Mark it applied after you submit, then return to Find jobs for the
              next role.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <PrimaryButton
                type="button"
                onClick={markAsApplied}
                loading={markingApplied}
                disabled={applicationStatus === "applied"}
              >
                <CheckCircle2 className="h-4 w-4" />
                {applicationStatus === "applied" ? "Applied" : "Mark as applied"}
              </PrimaryButton>
              <Button
                type="button"
                variant="outline"
                onClick={goToFindJobs}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Find jobs
              </Button>
              <Button type="button" variant="ghost" onClick={analyzeAnother}>
                Analyze another job
              </Button>
              <Link
                href="/applications"
                className="inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
              >
                View applications
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
