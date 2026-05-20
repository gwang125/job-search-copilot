"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { readApiError } from "@/lib/api-error";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { normalizeApplicationRow } from "@/lib/supabase/normalize";
import { statusLabel } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import type {
  Application,
  ApplicationStatus,
  ApplicationWithJob,
  Job,
} from "@/types/database";

const STATUS_OPTIONS: ApplicationStatus[] = [
  "saved",
  "applied",
  "interview",
  "rejected",
  "offer",
  "archived",
];

export function ApplicationsTable({
  applications: initial,
}: {
  applications: ApplicationWithJob[];
}) {
  const [applications, setApplications] = useState(initial);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function deleteApplication(id: string, label: string) {
    if (
      !window.confirm(
        `Remove "${label}" from your applications? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(await readApiError(res, "Could not delete application"));
      }
      setApplications((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  async function updateStatus(id: string, status: ApplicationStatus) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("applications")
      .update({ status })
      .eq("id", id)
      .select("*, job:jobs(*)")
      .single();

    if (!error && data) {
      const updated = normalizeApplicationRow(
        data as Application & { job?: Job | Job[] | null }
      );
      setApplications((prev) =>
        prev.map((a) => (a.id === id ? updated : a))
      );
    }
  }

  if (applications.length === 0) {
    return (
      <Card>
        <p className="text-sm text-zinc-500">
          No applications yet. Use the Job Analyzer to save your first role.
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      {error && (
        <p className="border-b border-red-100 bg-red-50 px-6 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200/80 bg-zinc-50/80 text-left">
              <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Role
              </th>
              <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Company
              </th>
              <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Match
              </th>
              <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Status
              </th>
              <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => (
              <tr
                key={app.id}
                className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50"
              >
                <td className="px-6 py-4 font-medium text-zinc-900">
                  {app.job?.job_title ?? "—"}
                </td>
                <td className="px-6 py-4 text-zinc-600">
                  {app.job?.company ?? "—"}
                </td>
                <td className="px-6 py-4">
                  {app.match_score != null ? (
                    <span className="font-medium text-indigo-600">
                      {app.match_score}%
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-6 py-4">
                  <select
                    value={app.status}
                    onChange={(e) =>
                      updateStatus(app.id, e.target.value as ApplicationStatus)
                    }
                    className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    loading={deletingId === app.id}
                    onClick={() =>
                      deleteApplication(
                        app.id,
                        `${app.job?.job_title ?? "this role"} at ${app.job?.company ?? "company"}`
                      )
                    }
                    aria-label={`Delete application for ${app.job?.job_title ?? "role"}`}
                  >
                    <Trash2 className="h-4 w-4 text-zinc-500" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
