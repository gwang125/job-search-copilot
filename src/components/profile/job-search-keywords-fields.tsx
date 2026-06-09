"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSearchKeywordEntry } from "@/lib/supabase/job-search-preferences";
import type { JobSearchKeywordEntry } from "@/types/database";
import { Plus, Trash2 } from "lucide-react";

interface JobSearchKeywordsFieldsProps {
  keywords: JobSearchKeywordEntry[];
  onChange: (keywords: JobSearchKeywordEntry[]) => void;
}

export function JobSearchKeywordsFields({
  keywords,
  onChange,
}: JobSearchKeywordsFieldsProps) {
  function patchEntry(index: number, patch: Partial<JobSearchKeywordEntry>) {
    onChange(
      keywords.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
    );
  }

  function removeEntry(index: number) {
    onChange(keywords.filter((_, i) => i !== index));
  }

  function addEntry() {
    onChange([...keywords, createSearchKeywordEntry("")]);
  }

  const activeCount = keywords.filter(
    (k) => k.is_active && k.keyword.trim()
  ).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">
        Used on <span className="font-medium text-zinc-800">Find jobs</span>.
        Only <span className="font-medium text-zinc-800">active</span> keywords
        are searched.
      </p>

      {keywords.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-500">
          No search keywords yet. Add one below.
        </p>
      ) : (
        <ul className="space-y-2">
          {keywords.map((entry, index) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200/80 bg-white px-3 py-2"
            >
              <label className="flex shrink-0 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={entry.is_active}
                  onChange={(e) =>
                    patchEntry(index, { is_active: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  aria-label={`Active: ${entry.keyword || "new keyword"}`}
                />
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Active
                </span>
              </label>
              <Input
                value={entry.keyword}
                onChange={(e) => patchEntry(index, { keyword: e.target.value })}
                placeholder="e.g. software engineer"
                className="min-w-[200px] flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeEntry(index)}
                aria-label="Remove keyword"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addEntry}>
          <Plus className="h-4 w-4" />
          Add keyword
        </Button>
        <span className="text-xs text-zinc-500">
          {activeCount} active for Find jobs
        </span>
      </div>
    </div>
  );
}
