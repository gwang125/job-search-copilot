"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { PrimaryButton } from "@/components/ui/primary-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FloatingAlert } from "@/components/ui/floating-alert";
import { SectionHeader } from "@/components/layout/section-header";
import { cn } from "@/lib/utils";
import type { Resume } from "@/types/database";
import { Download, FileText, Star, Trash2, Upload } from "lucide-react";

interface ResumeManagerProps {
  initialResumes: Resume[];
}

type Toast = { type: "success" | "error"; text: string };

const ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function ResumeManager({ initialResumes }: ResumeManagerProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resumes, setResumes] = useState<Resume[]>(initialResumes);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "docx") {
      setToast({ type: "error", text: "Only PDF and DOCX files are supported." });
      return;
    }

    setLoading(true);
    setToast(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/resumes/upload", {
        method: "POST",
        body: formData,
      });

      const body = (await res.json()) as {
        resume?: Resume;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(body.error ?? "Upload failed");
      }

      if (body.resume) {
        setResumes((prev) => {
          const next = [
            body.resume!,
            ...prev.filter((r) => r.id !== body.resume!.id),
          ];
          if (body.resume!.is_primary) {
            return next.map((r) => ({
              ...r,
              is_primary: r.id === body.resume!.id,
            }));
          }
          return next;
        });
      }

      setToast({
        type: "success",
        text: `"${file.name}" uploaded and saved.`,
      });
      router.refresh();
    } catch (err) {
      setToast({
        type: "error",
        text: err instanceof Error ? err.message : "Upload failed",
      });
    } finally {
      setLoading(false);
    }
  }

  async function setPrimary(id: string) {
    const supabase = createClient();
    await supabase.from("resumes").update({ is_primary: true }).eq("id", id);
    setResumes((prev) =>
      prev.map((r) => ({ ...r, is_primary: r.id === id }))
    );
    router.refresh();
  }

  async function deleteResume(id: string) {
    const res = await fetch(`/api/resumes/${id}`, { method: "DELETE" });
    const body = (await res.json()) as { error?: string };
    if (!res.ok) {
      setToast({
        type: "error",
        text: body.error ?? "Could not delete resume",
      });
      return;
    }
    setResumes((prev) => prev.filter((r) => r.id !== id));
    setToast({ type: "success", text: "Resume deleted." });
    router.refresh();
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="space-y-8">
      {toast && (
        <FloatingAlert
          message={toast.text}
          variant={toast.type === "error" ? "error" : "success"}
          onDismiss={() => setToast(null)}
        />
      )}

      <Card>
        <SectionHeader
          title="Upload resume"
          description="PDF or Word (.docx) only. Files are stored securely and used for job match analysis."
        />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <input
            ref={fileInputRef}
            id="resume-upload"
            type="file"
            accept={ACCEPT}
            disabled={loading}
            onChange={handleFileSelected}
            className="sr-only"
          />
          <PrimaryButton
            type="button"
            loading={loading}
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0"
          >
            <Upload className="h-4 w-4" />
            {loading ? "Uploading…" : "Choose PDF or DOCX"}
          </PrimaryButton>
        </div>
        <p className="mt-3 text-xs text-zinc-500">Maximum file size: 8 MB</p>
      </Card>

      <Card>
        <SectionHeader
          title={`Your resumes (${resumes.length})`}
          description="Download originals anytime. Set a primary resume for default job matching."
        />
        {resumes.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No resumes yet. Upload a PDF or DOCX before using the Job Analyzer.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {resumes.map((resume) => (
              <li
                key={resume.id}
                className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-zinc-900">{resume.name}</p>
                      {resume.is_primary && (
                        <Badge variant="info">Primary</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">
                      {resume.file_name ?? "File"}
                      {!resume.file_path &&
                        " · text only (re-upload for download)"}
                      {" · "}
                      {formatDate(resume.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {resume.file_path && (
                    <a
                      href={`/api/resumes/${resume.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                      )}
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </a>
                  )}
                  {!resume.is_primary && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPrimary(resume.id)}
                    >
                      <Star className="h-4 w-4" />
                      Set primary
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteResume(resume.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
