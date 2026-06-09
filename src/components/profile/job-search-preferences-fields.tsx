"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormInput } from "@/components/ui/form-input";
import type { JobSearchPreferences } from "@/types/database";

interface JobSearchPreferencesFieldsProps {
  preferences: JobSearchPreferences;
  onChange: (preferences: JobSearchPreferences) => void;
}

function commaList(values: string[]): string {
  return values.join(", ");
}

function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function CheckboxRow({
  id,
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer gap-3 rounded-lg border border-zinc-200/80 bg-zinc-50/50 px-4 py-3 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
      />
      <span>
        <span className="block text-sm font-medium text-zinc-900">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-zinc-500">{description}</span>
        )}
      </span>
    </label>
  );
}

export function JobSearchPreferencesFields({
  preferences,
  onChange,
}: JobSearchPreferencesFieldsProps) {
  function patch(partial: Partial<JobSearchPreferences>) {
    onChange({ ...preferences, ...partial });
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-zinc-900">Work authorization</h4>
        <div className="space-y-2">
          <CheckboxRow
            id="exclude-citizenship"
            label="Exclude jobs requiring U.S. citizenship"
            checked={preferences.exclude_us_citizenship_required}
            onChange={(v) => patch({ exclude_us_citizenship_required: v })}
          />
          <CheckboxRow
            id="exclude-clearance"
            label="Exclude jobs requiring security clearance"
            checked={preferences.exclude_security_clearance_required}
            onChange={(v) => patch({ exclude_security_clearance_required: v })}
          />
          <CheckboxRow
            id="exclude-no-sponsor"
            label="Exclude jobs that do not sponsor visas"
            description='e.g. "unable to sponsor", "must be authorized without sponsorship"'
            checked={preferences.exclude_no_visa_sponsorship}
            onChange={(v) => patch({ exclude_no_visa_sponsorship: v })}
          />
          <CheckboxRow
            id="exclude-green-card"
            label="Exclude jobs requiring Green Card or permanent residency"
            checked={preferences.exclude_green_card_required}
            onChange={(v) => patch({ exclude_green_card_required: v })}
          />
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-zinc-900">Experience</h4>
        <div className="space-y-2">
          <Label htmlFor="max-years">Maximum required years of experience</Label>
          <Input
            id="max-years"
            type="number"
            min={0}
            max={40}
            placeholder="Leave empty for no limit"
            value={
              preferences.max_years_experience == null
                ? ""
                : preferences.max_years_experience
            }
            onChange={(e) => {
              const raw = e.target.value.trim();
              patch({
                max_years_experience: raw === "" ? null : Number(raw),
              });
            }}
          />
          <p className="text-xs text-zinc-500">
            Filters out jobs requiring more years (e.g. 5+ years when your max is
            2). Use 0 for less than 1 year. Also flags senior-level experience
            phrases when max is 3 or less.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-zinc-900">Education</h4>
        <div className="space-y-2">
          <CheckboxRow
            id="exclude-phd"
            label="Exclude jobs requiring a PhD or doctorate"
            checked={preferences.exclude_phd_required}
            onChange={(v) => patch({ exclude_phd_required: v })}
          />
          <FormInput
            label="Excluded certifications"
            id="excluded-certs"
            hint="Comma-separated — partial match in job description"
            value={commaList(preferences.excluded_certifications)}
            onChange={(e) =>
              patch({ excluded_certifications: parseCommaList(e.target.value) })
            }
            placeholder="PMP, CISSP, AWS Solutions Architect"
          />
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-zinc-900">Location</h4>
        <div className="space-y-2">
          <FormInput
            label="Preferred locations (hard filter)"
            id="pref-locations-hard"
            hint="Comma-separated — job must mention at least one (or be remote if remote only)"
            value={commaList(preferences.preferred_locations)}
            onChange={(e) =>
              patch({ preferred_locations: parseCommaList(e.target.value) })
            }
            placeholder="Remote, San Francisco, New York"
          />
          <CheckboxRow
            id="remote-only"
            label="Remote only"
            description="Exclude on-site-only roles"
            checked={preferences.remote_only}
            onChange={(v) =>
              patch({
                remote_only: v,
                hybrid_allowed: v ? false : preferences.hybrid_allowed,
              })
            }
          />
          <CheckboxRow
            id="hybrid-allowed"
            label="Allow hybrid roles"
            description="When off, hybrid and on-site-only listings are excluded"
            checked={preferences.hybrid_allowed}
            disabled={preferences.remote_only}
            onChange={(v) => patch({ hybrid_allowed: v })}
          />
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-zinc-900">Blocked keywords</h4>
        <FormInput
          label="Custom blocked keywords"
          id="blocked-keywords"
          hint="Comma-separated — matched in title, company, location, or description"
          value={commaList(preferences.blocked_keywords)}
          onChange={(e) =>
            patch({ blocked_keywords: parseCommaList(e.target.value) })
          }
          placeholder="senior engineer, staff engineer, 5+ years, active clearance"
        />
      </div>
    </div>
  );
}
