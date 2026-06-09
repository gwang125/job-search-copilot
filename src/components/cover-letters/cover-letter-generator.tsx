"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PrimaryButton } from "@/components/ui/primary-button";
import { Textarea } from "@/components/ui/textarea";
import { readApiError } from "@/lib/api-error";
import type { Resume } from "@/types/database";
import { Download, ExternalLink, FileText, WandSparkles } from "lucide-react";

interface CoverLetterGeneratorProps {
  resumes: Resume[];
}

export function CoverLetterGenerator({ resumes }: CoverLetterGeneratorProps) {
  const primaryResume = useMemo(
    () => resumes.find((resume) => resume.is_primary) ?? resumes[0],
    [resumes]
  );

  const [resumeId, setResumeId] = useState(primaryResume?.id ?? "");
  const [jobUrl, setJobUrl] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [content, setContent] = useState("");
  const [pdfTitle, setPdfTitle] = useState("");
  const [parsing, setParsing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function parseUrl() {
    const url = jobUrl.trim();
    if (!url) return;

    setParsing(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/jobs/parse-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to parse URL");
      }

      setCompany(data.company ?? "");
      setJobTitle(data.jobTitle ?? "");
      setLocation(data.location ?? "");
      setJobDescription(data.jobDescription ?? "");
      setMessage("Job details parsed. Review them before generating.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse URL");
    } finally {
      setParsing(false);
    }
  }

  async function generateCoverLetter() {
    if (!resumeId) {
      setError("Choose a resume first.");
      return;
    }
    if (!jobDescription.trim()) {
      setError("Paste a job description first.");
      return;
    }

    setGenerating(true);
    setError(null);
    setMessage(null);
    setContent("");
    setPdfTitle("");

    try {
      const res = await fetch("/api/jobs/generate-cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeId,
          company: company || null,
          jobTitle: jobTitle || null,
          location: location || null,
          jobUrl: jobUrl || null,
          jobDescription,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to generate cover letter");
      }

      setContent(data.content ?? "");
      setPdfTitle(data.title ?? "Cover Letter");
      setMessage("Cover letter generated. It was not saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate cover letter");
    } finally {
      setGenerating(false);
    }
  }

  async function downloadPdf() {
    if (!content.trim()) return;

    setDownloading(true);
    setError(null);

    try {
      const res = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType: "cover_letter",
          title: pdfTitle || "Cover Letter",
          content,
        }),
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, "Export failed"));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `${(pdfTitle || "Cover Letter").replace(/\s+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  if (resumes.length === 0) {
    return (
      <Card>
        <p className="text-sm text-zinc-600">
          Upload at least one resume before generating a cover letter.
        </p>
        <Link
          href="/resumes"
          className="mt-4 inline-flex text-sm font-medium text-indigo-600 hover:underline"
        >
          Go to Resumes
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
      <Card className="space-y-5">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">
            Job details
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Generate a cover letter from one selected resume and this job post.
          </p>
        </div>

        {error && <Alert variant="error">{error}</Alert>}
        {message && <Alert variant="success">{message}</Alert>}

        <div className="space-y-2">
          <Label htmlFor="resume">Resume</Label>
          <select
            id="resume"
            value={resumeId}
            onChange={(e) => setResumeId(e.target.value)}
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            {resumes.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.name}
                {resume.is_primary ? " (Primary)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="job-url">Job URL</Label>
          <div className="flex gap-2">
            <Input
              id="job-url"
              placeholder="Paste a job posting URL"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={parseUrl}
              loading={parsing}
              disabled={!jobUrl.trim()}
            >
              Parse
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="job-title">Job title</Label>
            <Input
              id="job-title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="job-description">Job description</Label>
          <Textarea
            id="job-description"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            rows={14}
            placeholder="Paste the full job description..."
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <PrimaryButton
            type="button"
            onClick={generateCoverLetter}
            loading={generating}
          >
            <WandSparkles className="h-4 w-4" />
            Generate cover letter
          </PrimaryButton>
          {jobUrl.trim() && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => window.open(jobUrl.trim(), "_blank")}
            >
              <ExternalLink className="h-4 w-4" />
              Open job
            </Button>
          )}
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-zinc-900">
              Cover letter
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Generated letters stay on this page until you leave or regenerate.
            </p>
          </div>
          {content && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadPdf}
              loading={downloading}
            >
              <Download className="h-4 w-4" />
              PDF
            </Button>
          )}
        </div>

        {content ? (
          <div className="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-800">
            {content}
          </div>
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50/70 px-6 text-center">
            <FileText className="h-9 w-9 text-zinc-400" />
            <p className="mt-3 text-sm font-medium text-zinc-700">
              No cover letter yet
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Fill in the job details, then generate a letter.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
