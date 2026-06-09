"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { readApiError } from "@/lib/api-error";
import type { GeneratedDocumentWithJob } from "@/types/database";
import { Download, FileText } from "lucide-react";

export function DocumentsList({
  documents: initial,
}: {
  documents: GeneratedDocumentWithJob[];
}) {
  const [downloading, setDownloading] = useState<string | null>(null);

  async function downloadPdf(doc: GeneratedDocumentWithJob) {
    setDownloading(doc.id);
    try {
      const res = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: doc.id,
          documentType: doc.document_type,
        }),
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, "Export failed"));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.title.replace(/\s+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(null);
    }
  }

  if (initial.length === 0) {
    return (
      <Card>
        <p className="text-sm text-zinc-500">
          No archived cover letters from earlier versions.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">
        Generated cover letters from previous sessions.
      </p>
      {initial.map((doc) => (
        <Card
          key={doc.id}
          className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="flex gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <p className="font-medium text-zinc-900">{doc.title}</p>
              <p className="text-sm text-zinc-500">
                {doc.job?.job_title}
                {doc.job?.company ? ` at ${doc.job.company}` : ""}
              </p>
              <div className="mt-2 flex gap-2">
                <Badge variant="info">Cover letter</Badge>
                <span className="text-xs text-zinc-400">
                  {new Date(doc.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            loading={downloading === doc.id}
            onClick={() => downloadPdf(doc)}
          >
            <Download className="h-4 w-4" />
            PDF
          </Button>
        </Card>
      ))}
    </div>
  );
}
