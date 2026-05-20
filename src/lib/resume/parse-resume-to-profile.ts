import { z } from "zod";
import { getOpenAIClient, OPENAI_MODEL } from "@/lib/openai/client";
import {
  RESUME_TO_PROFILE_SYSTEM,
  buildResumeToProfilePrompt,
} from "@/lib/openai/prompts";
import type { ParsedProfileFromResume } from "@/types/database";

/** OpenAI often returns null for missing optional fields; Zod .optional() does not allow null */
const optionalStr = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) =>
    typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined
  );

const requiredStr = z
  .union([z.string(), z.null()])
  .transform((v) => (typeof v === "string" ? v.trim() : ""))
  .pipe(z.string().min(1));

const stringArray = z
  .array(z.union([z.string(), z.null()]))
  .default([])
  .transform((arr) =>
    arr.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
  );

const educationSchema = z.object({
  school: requiredStr,
  degree: optionalStr,
  major: optionalStr,
  field: optionalStr,
  startDate: optionalStr,
  endDate: optionalStr,
  description: optionalStr,
});

const workSchema = z.object({
  company: requiredStr,
  title: requiredStr,
  location: optionalStr,
  startDate: optionalStr,
  endDate: optionalStr,
  bullets: stringArray,
});

const projectSchema = z.object({
  name: requiredStr,
  description: optionalStr,
  technologies: stringArray.optional(),
  url: optionalStr,
  bullets: stringArray.optional(),
});

const parsedProfileSchema = z.object({
  name: z.union([z.string(), z.null()]).optional(),
  email: z.union([z.string(), z.null()]).optional(),
  location: z.union([z.string(), z.null()]).optional(),
  skills: stringArray,
  target_job_titles: stringArray,
  preferred_locations: stringArray,
  visa_notes: z.union([z.string(), z.null()]).optional(),
  education: z.array(educationSchema).default([]),
  work_experience: z.array(workSchema).default([]),
  projects: z.array(projectSchema).default([]),
});

/**
 * Parse resume plain text into structured profile fields using OpenAI.
 * Only includes information explicitly present in the resume.
 */
export async function parseResumeToProfile(
  resumeText: string
): Promise<ParsedProfileFromResume> {
  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: RESUME_TO_PROFILE_SYSTEM },
      { role: "user", content: buildResumeToProfilePrompt(resumeText) },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Empty response from resume parser");
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON from resume parser");
  }

  const parsed = parsedProfileSchema.parse(json);

  return {
    name:
      typeof parsed.name === "string" && parsed.name.trim()
        ? parsed.name.trim()
        : null,
    email:
      typeof parsed.email === "string" && parsed.email.trim()
        ? parsed.email.trim()
        : null,
    location:
      typeof parsed.location === "string" && parsed.location.trim()
        ? parsed.location.trim()
        : null,
    skills: parsed.skills,
    target_job_titles: parsed.target_job_titles,
    preferred_locations: parsed.preferred_locations,
    visa_notes:
      typeof parsed.visa_notes === "string" && parsed.visa_notes.trim()
        ? parsed.visa_notes.trim()
        : null,
    education: parsed.education.map((e) => ({
      ...e,
      major: e.major ?? e.field,
      field: undefined,
    })),
    work_experience: parsed.work_experience.map((w) => ({
      ...w,
      bullets: w.bullets.length ? w.bullets : [""],
    })),
    projects: parsed.projects.map((p) => ({
      ...p,
      technologies: p.technologies ?? [],
      bullets: p.bullets?.length ? p.bullets : [""],
    })),
  };
}
