"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { SectionHeader } from "@/components/layout/section-header";
import type { ParsedProfileFromResume } from "@/types/database";
import { FileUp, Loader2 } from "lucide-react";

interface ResumeProfileImportProps {
  onParsed: (profile: ParsedProfileFromResume) => void;
}

export function ResumeProfileImport({ onParsed }: ResumeProfileImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/profile/parse-resume", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to parse resume");
      }

      onParsed(data.profile as ParsedProfileFromResume);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-white">
      <SectionHeader
        title="Import from resume (PDF)"
        description="Upload a PDF resume to autofill your profile. Review every field before saving."
      />
      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileUp className="h-4 w-4" />
          )}
          {loading ? "Parsing resume…" : "Upload PDF resume"}
        </Button>
        <p className="text-xs text-zinc-500">PDF only, max 8 MB. Text-based PDFs work best.</p>
      </div>
    </Card>
  );
}
