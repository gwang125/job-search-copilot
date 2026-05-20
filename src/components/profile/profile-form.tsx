"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { PrimaryButton } from "@/components/ui/primary-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { FloatingAlert } from "@/components/ui/floating-alert";
import { FormInput } from "@/components/ui/form-input";
import { SectionHeader } from "@/components/layout/section-header";
import { ResumeProfileImport } from "@/components/profile/resume-profile-import";
import { ProjectFields } from "@/components/profile/project-fields";
import { JobSearchPreferencesFields } from "@/components/profile/job-search-preferences-fields";
import { preferencesPayloadForSave } from "@/lib/supabase/job-search-preferences";
import type {
  EducationEntry,
  JobSearchPreferences,
  ParsedProfileFromResume,
  Profile,
  ProjectEntry,
  WorkExperienceEntry,
} from "@/types/database";
import { Plus, Trash2 } from "lucide-react";

interface ProfileFormProps {
  profile: Profile | null;
  userId: string;
  jobSearchPreferences: JobSearchPreferences;
}

const emptyWork: WorkExperienceEntry = {
  company: "",
  title: "",
  bullets: [""],
};

const emptyEducation: EducationEntry = {
  school: "",
};

const emptyProject: ProjectEntry = {
  name: "",
  organization: "",
  location: "",
  description: "",
  technologies: [],
  bullets: [""],
};

function normalizeEducation(entries: EducationEntry[]): EducationEntry[] {
  return entries.map((e) => ({
    ...e,
    major: e.major ?? e.field ?? "",
  }));
}

function normalizeProjects(entries: ProjectEntry[]): ProjectEntry[] {
  return entries.map((p) => ({
    ...p,
    technologies: p.technologies ?? [],
    bullets: p.bullets?.length ? p.bullets : [""],
  }));
}

function formStateFromProfile(profile: Profile | null) {
  return {
    name: profile?.name ?? "",
    email: profile?.email ?? "",
    location: profile?.location ?? "",
    skills: (profile?.skills ?? []).join(", "),
    targetTitles: (profile?.target_job_titles ?? []).join(", "),
    preferredLocations: (profile?.preferred_locations ?? []).join(", "),
    visaNotes: profile?.visa_notes ?? "",
    workExperience: profile?.work_experience?.length
      ? profile.work_experience
      : [{ ...emptyWork }],
    education: profile?.education?.length
      ? normalizeEducation(profile.education)
      : [{ ...emptyEducation }],
    projects: profile?.projects?.length
      ? normalizeProjects(profile.projects)
      : [],
  };
}

export function ProfileForm({
  profile,
  userId,
  jobSearchPreferences: initialPreferences,
}: ProfileFormProps) {
  const router = useRouter();
  const initial = formStateFromProfile(profile);

  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [location, setLocation] = useState(initial.location);
  const [skills, setSkills] = useState(initial.skills);
  const [targetTitles, setTargetTitles] = useState(initial.targetTitles);
  const [preferredLocations, setPreferredLocations] = useState(
    initial.preferredLocations
  );
  const [visaNotes, setVisaNotes] = useState(initial.visaNotes);
  const [workExperience, setWorkExperience] = useState<WorkExperienceEntry[]>(
    initial.workExperience
  );
  const [education, setEducation] = useState<EducationEntry[]>(
    initial.education
  );
  const [projects, setProjects] = useState<ProjectEntry[]>(initial.projects);
  const [jobSearchPreferences, setJobSearchPreferences] =
    useState<JobSearchPreferences>(initialPreferences);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    const next = formStateFromProfile(profile);
    setName(next.name);
    setEmail(next.email);
    setLocation(next.location);
    setSkills(next.skills);
    setTargetTitles(next.targetTitles);
    setPreferredLocations(next.preferredLocations);
    setVisaNotes(next.visaNotes);
    setWorkExperience(next.workExperience);
    setEducation(next.education);
    setProjects(next.projects);
  }, [profile]);

  useEffect(() => {
    setJobSearchPreferences(initialPreferences);
  }, [initialPreferences]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const payload = {
      id: userId,
      name: name || null,
      email: email || null,
      location: location || null,
      skills: skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      target_job_titles: targetTitles
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      preferred_locations: preferredLocations
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      visa_notes: visaNotes || null,
      work_experience: workExperience.filter((w) => w.company || w.title),
      education: education
        .filter((e) => e.school)
        .map((e) => ({
          school: e.school,
          degree: e.degree?.trim() || undefined,
          major: e.major?.trim() || undefined,
          startDate: e.startDate?.trim() || undefined,
          endDate: e.endDate?.trim() || undefined,
          description: e.description?.trim() || undefined,
        })),
      projects: projects
        .filter((p) => p.name.trim())
        .map((p) => ({
          name: p.name.trim(),
          organization: p.organization?.trim() || undefined,
          location: p.location?.trim() || undefined,
          description: p.description?.trim() || undefined,
          technologies: (p.technologies ?? []).filter(Boolean),
          url: p.url?.trim() || undefined,
          bullets: (p.bullets ?? []).map((b) => b.trim()).filter(Boolean),
        })),
    };

    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select("id")
      .single();

    if (error) {
      setLoading(false);
      setMessage({ type: "error", text: error.message });
      return;
    }

    if (!data) {
      setLoading(false);
      setMessage({
        type: "error",
        text: "Profile could not be saved. Run migration 002_profile_insert_policy.sql in Supabase, then try again.",
      });
      return;
    }

    const prefsPayload = preferencesPayloadForSave(userId, {
      exclude_us_citizenship_required:
        jobSearchPreferences.exclude_us_citizenship_required,
      exclude_security_clearance_required:
        jobSearchPreferences.exclude_security_clearance_required,
      exclude_no_visa_sponsorship:
        jobSearchPreferences.exclude_no_visa_sponsorship,
      exclude_green_card_required:
        jobSearchPreferences.exclude_green_card_required,
      max_years_experience: jobSearchPreferences.max_years_experience,
      exclude_phd_required: jobSearchPreferences.exclude_phd_required,
      excluded_certifications: jobSearchPreferences.excluded_certifications,
      remote_only: jobSearchPreferences.remote_only,
      hybrid_allowed: jobSearchPreferences.hybrid_allowed,
      preferred_locations: jobSearchPreferences.preferred_locations,
      blocked_keywords: jobSearchPreferences.blocked_keywords,
    });

    const { error: prefsError } = await supabase
      .from("job_search_preferences")
      .upsert(prefsPayload, { onConflict: "user_id" });

    setLoading(false);

    if (prefsError) {
      setMessage({
        type: "error",
        text: `Profile saved, but job filters failed: ${prefsError.message}. Run migration 006_job_search_preferences.sql in Supabase.`,
      });
      return;
    }

    setMessage({
      type: "success",
      text: "Profile and job search filters saved successfully.",
    });
    router.refresh();
  }

  function updateWork(index: number, patch: Partial<WorkExperienceEntry>) {
    setWorkExperience((prev) =>
      prev.map((w, i) => (i === index ? { ...w, ...patch } : w))
    );
  }

  function updateEducation(
    index: number,
    patch: Partial<EducationEntry>
  ) {
    setEducation((prev) =>
      prev.map((e, i) => (i === index ? { ...e, ...patch } : e))
    );
  }

  function updateProject(index: number, patch: Partial<ProjectEntry>) {
    setProjects((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...patch } : p))
    );
  }

  function updateProjectBullet(pIndex: number, bIndex: number, value: string) {
    setProjects((prev) =>
      prev.map((p, i) => {
        if (i !== pIndex) return p;
        const bullets = [...(p.bullets ?? [""])];
        bullets[bIndex] = value;
        return { ...p, bullets };
      })
    );
  }

  function updateWorkBullet(wIndex: number, bIndex: number, value: string) {
    setWorkExperience((prev) =>
      prev.map((w, i) => {
        if (i !== wIndex) return w;
        const bullets = [...w.bullets];
        bullets[bIndex] = value;
        return { ...w, bullets };
      })
    );
  }

  function applyParsedProfile(parsed: ParsedProfileFromResume) {
    if (parsed.name) setName(parsed.name);
    if (parsed.email) setEmail(parsed.email);
    if (parsed.location) setLocation(parsed.location);
    if (parsed.skills.length) setSkills(parsed.skills.join(", "));
    if (parsed.target_job_titles.length) {
      setTargetTitles(parsed.target_job_titles.join(", "));
    }
    if (parsed.preferred_locations.length) {
      setPreferredLocations(parsed.preferred_locations.join(", "));
    }
    if (parsed.visa_notes) setVisaNotes(parsed.visa_notes);
    if (parsed.work_experience.length) {
      setWorkExperience(parsed.work_experience);
    }
    if (parsed.education.length) {
      setEducation(normalizeEducation(parsed.education));
    }
    if (parsed.projects.length) {
      setProjects(normalizeProjects(parsed.projects));
    }
    setMessage({
      type: "success",
      text: "Profile fields filled from your resume. Review everything, then click Save profile.",
    });
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {message && (
        <FloatingAlert
          message={message.text}
          variant={message.type === "error" ? "error" : "success"}
          onDismiss={() => setMessage(null)}
        />
      )}

      <ResumeProfileImport onParsed={applyParsedProfile} />

      <Card>
        <SectionHeader
          title="Basic information"
          description="How employers and AI will identify you."
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <FormInput
            label="Full name"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <FormInput
            label="Email"
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <FormInput
            label="Location"
            id="location"
            className="sm:col-span-2"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City, State or Remote"
          />
        </div>
      </Card>

      <Card>
        <SectionHeader
          title="Job preferences"
          description="Helps match you to the right roles and locations."
        />
        <div className="space-y-5">
          <FormInput
            label="Skills"
            id="skills"
            hint="Comma-separated list"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="React, TypeScript, Node.js"
          />
          <FormInput
            label="Target job titles"
            id="targets"
            value={targetTitles}
            onChange={(e) => setTargetTitles(e.target.value)}
            placeholder="Software Engineer, Full Stack Developer"
          />
          <FormInput
            label="Preferred locations"
            id="locations"
            value={preferredLocations}
            onChange={(e) => setPreferredLocations(e.target.value)}
            placeholder="Remote, San Francisco, New York"
          />
          <div className="space-y-2">
            <Label htmlFor="visa">Visa / work authorization</Label>
            <Textarea
              id="visa"
              value={visaNotes}
              onChange={(e) => setVisaNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Authorized to work in the US, require sponsorship"
            />
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader
          title="Job search filters"
          description="Hard requirements — jobs that violate these rules are removed in Find jobs before AI scoring."
        />
        <JobSearchPreferencesFields
          preferences={jobSearchPreferences}
          onChange={setJobSearchPreferences}
        />
      </Card>

      <Card>
        <SectionHeader
          title="Work experience"
          description="Roles and achievements used for tailoring."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setWorkExperience((p) => [...p, { ...emptyWork }])}
            >
              <Plus className="h-4 w-4" />
              Add role
            </Button>
          }
        />
        <div className="space-y-4">
          {workExperience.map((work, wi) => (
            <div
              key={wi}
              className="rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-5"
            >
              <div className="mb-4 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setWorkExperience((p) => p.filter((_, i) => i !== wi))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  placeholder="Company"
                  value={work.company}
                  onChange={(e) => updateWork(wi, { company: e.target.value })}
                />
                <Input
                  placeholder="Title"
                  value={work.title}
                  onChange={(e) => updateWork(wi, { title: e.target.value })}
                />
                <Input
                  placeholder="Location"
                  value={work.location ?? ""}
                  onChange={(e) => updateWork(wi, { location: e.target.value })}
                />
                <Input
                  placeholder="Dates (e.g. 2020 – 2024)"
                  value={
                    work.endDate
                      ? `${work.startDate ?? ""} – ${work.endDate}`
                      : work.startDate ?? ""
                  }
                  onChange={(e) => {
                    const parts = e.target.value.split("–").map((s) => s.trim());
                    updateWork(wi, {
                      startDate: parts[0] ?? "",
                      endDate: parts[1] ?? "",
                    });
                  }}
                />
              </div>
              <div className="mt-4 space-y-3">
                <Label>Bullet points</Label>
                {work.bullets.map((bullet, bi) => (
                  <Textarea
                    key={bi}
                    value={bullet}
                    onChange={(e) => updateWorkBullet(wi, bi, e.target.value)}
                    rows={2}
                    placeholder="Achievement or responsibility"
                  />
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    updateWork(wi, { bullets: [...work.bullets, ""] })
                  }
                >
                  Add bullet
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionHeader
          title="Education"
          description="Schools, degrees, and majors."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEducation((p) => [...p, { ...emptyEducation }])}
            >
              <Plus className="h-4 w-4" />
              Add school
            </Button>
          }
        />
        <div className="space-y-4">
          {education.map((edu, ei) => (
            <div
              key={ei}
              className="rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-5"
            >
              <div className="mb-4 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setEducation((p) => p.filter((_, i) => i !== ei))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  placeholder="School"
                  value={edu.school}
                  onChange={(e) =>
                    updateEducation(ei, { school: e.target.value })
                  }
                />
                <Input
                  placeholder="Degree (e.g. B.S., M.S.)"
                  value={edu.degree ?? ""}
                  onChange={(e) =>
                    updateEducation(ei, { degree: e.target.value })
                  }
                />
                <Input
                  placeholder="Major (e.g. Computer Science)"
                  value={edu.major ?? ""}
                  onChange={(e) =>
                    updateEducation(ei, { major: e.target.value })
                  }
                />
                <Input
                  placeholder="Dates (e.g. 2018 – 2022)"
                  value={
                    edu.endDate
                      ? `${edu.startDate ?? ""} – ${edu.endDate}`
                      : edu.startDate ?? ""
                  }
                  onChange={(e) => {
                    const parts = e.target.value.split("–").map((s) => s.trim());
                    updateEducation(ei, {
                      startDate: parts[0] ?? "",
                      endDate: parts[1] ?? "",
                    });
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionHeader
          title="Projects"
          description="Same layout as job details — link, organization, title, location, description, and resume bullets."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setProjects((p) => [...p, { ...emptyProject }])}
            >
              <Plus className="h-4 w-4" />
              Add project
            </Button>
          }
        />
        <div className="space-y-6">
          {projects.length === 0 && (
            <p className="text-sm text-zinc-500">
              No projects yet. Click &quot;Add project&quot; to get started.
            </p>
          )}
          {projects.map((project, pi) => (
            <ProjectFields
              key={pi}
              index={pi}
              project={project}
              onChange={(patch) => updateProject(pi, patch)}
              onBulletChange={(bi, value) => updateProjectBullet(pi, bi, value)}
              onRemove={() => setProjects((p) => p.filter((_, i) => i !== pi))}
            />
          ))}
        </div>
      </Card>

      <div className="flex justify-end border-t border-zinc-200/80 pt-6">
        <PrimaryButton type="submit" loading={loading} size="lg">
          Save profile
        </PrimaryButton>
      </div>
    </form>
  );
}
