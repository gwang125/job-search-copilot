"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FormInput } from "@/components/ui/form-input";
import type { ProjectEntry } from "@/types/database";
import { Trash2 } from "lucide-react";

interface ProjectFieldsProps {
  index: number;
  project: ProjectEntry;
  onChange: (patch: Partial<ProjectEntry>) => void;
  onBulletChange: (bulletIndex: number, value: string) => void;
  onRemove: () => void;
}

export function ProjectFields({
  index,
  project,
  onChange,
  onBulletChange,
  onRemove,
}: ProjectFieldsProps) {
  return (
    <div className="space-y-5 rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold tracking-tight text-zinc-900">
          Project details
        </h3>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <FormInput
        label="Project link"
        id={`project-url-${index}`}
        placeholder="https://github.com/you/project (optional)"
        value={project.url ?? ""}
        onChange={(e) => onChange({ url: e.target.value })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`project-org-${index}`}>Organization</Label>
          <Input
            id={`project-org-${index}`}
            placeholder="e.g. University, Personal"
            value={project.organization ?? ""}
            onChange={(e) => onChange({ organization: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`project-name-${index}`}>Project title</Label>
          <Input
            id={`project-name-${index}`}
            placeholder="e.g. Distributed Publish-Subscribe System"
            value={project.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`project-location-${index}`}>Location</Label>
          <Input
            id={`project-location-${index}`}
            placeholder="Remote, On campus, etc."
            value={project.location ?? ""}
            onChange={(e) => onChange({ location: e.target.value })}
          />
        </div>
      </div>

      <FormInput
        label="Technologies"
        id={`project-tech-${index}`}
        hint="Comma-separated, for example gRPC, MongoDB"
        placeholder="gRPC, MongoDB"
        value={(project.technologies ?? []).join(", ")}
        onChange={(e) =>
          onChange({
            technologies: e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
      />

      <div className="space-y-2">
        <Label htmlFor={`project-desc-${index}`}>Project description</Label>
        <Textarea
          id={`project-desc-${index}`}
          value={project.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={8}
          placeholder="Overview of the project, your role, and outcomes..."
        />
      </div>

      <div className="space-y-3 border-t border-zinc-200/80 pt-4">
        <Label>Project bullet points</Label>
        <p className="text-xs text-zinc-500">
          Short achievements for matching context (optional if you use the
          description above).
        </p>
        {(project.bullets ?? [""]).map((bullet, bi) => (
          <Textarea
            key={bi}
            value={bullet}
            onChange={(e) => onBulletChange(bi, e.target.value)}
            rows={2}
            placeholder="What you built or achieved"
          />
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({ bullets: [...(project.bullets ?? [""]), ""] })
          }
        >
          Add bullet
        </Button>
      </div>
    </div>
  );
}
