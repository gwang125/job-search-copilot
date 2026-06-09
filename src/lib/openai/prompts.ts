import type { Profile, Resume } from "@/types/database";

/** Max JD chars sent to OpenAI per job during discovery (full text used for hard filters) */
export const DISCOVERY_SCORE_JD_MAX_LENGTH = 8000;

export function buildProfileContext(profile: Profile): string {
  return JSON.stringify(
    {
      name: profile.name,
      email: profile.email,
      location: profile.location,
      education: profile.education,
      workExperience: profile.work_experience,
      skills: profile.skills,
      projects: profile.projects,
      targetJobTitles: profile.target_job_titles,
      preferredLocations: profile.preferred_locations,
      visaNotes: profile.visa_notes,
    },
    null,
    2
  );
}

export function buildResumesContext(resumes: Resume[]): string {
  return resumes
    .map(
      (r) =>
        `--- Resume ID: ${r.id} | Name: ${r.name} | Primary: ${r.is_primary} ---\n${r.extracted_text}`
    )
    .join("\n\n");
}

export const MATCH_ANALYSIS_SYSTEM = `You are an expert career coach helping active job seekers apply at scale.
Analyze how well the candidate matches a job using their profile and ALL resume versions.
Be honest and practical. Never inflate fit.
Return ONLY valid JSON matching the schema.`;

export function buildMatchAnalysisPrompt(
  profile: Profile,
  resumes: Resume[],
  jobDescription: string,
  company: string | null,
  jobTitle: string | null
): string {
  return `Job:
Company: ${company ?? "Unknown"}
Title: ${jobTitle ?? "Unknown"}

Job Description:
${jobDescription}

Candidate Profile:
${buildProfileContext(profile)}

Available Resumes:
${buildResumesContext(resumes)}

Return JSON:
{
  "matchScore": <0-100 integer, overall fit using profile + best resume>,
  "bestResumeId": "<uuid of the single best resume to submit>",
  "resumeScores": [
    { "resumeId": "<uuid>", "score": <0-100>, "note": "one sentence why" }
  ],
  "reasons": ["..."],
  "matchedSkills": ["..."],
  "missingSkills": ["..."],
  "risks": ["..."],
  "recommendation": "apply" | "maybe" | "skip"
}

Rules:
- Include every provided resume in resumeScores, sorted by score descending
- bestResumeId MUST match the top entry in resumeScores
- bestResumeId MUST be one of the provided resume IDs
- recommendation: apply (strong fit), maybe (stretch), skip (poor fit)
- Do not invent experience`;
}

export const JOB_DISCOVERY_SCORE_SYSTEM = `You score how well job postings match a candidate's resume for job discovery.
Be honest and practical. Never inflate scores.
Return ONLY valid JSON.`;

export interface JobForDiscoveryScore {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  description: string;
}

export function buildJobDiscoveryScorePrompt(
  resume: Resume,
  jobs: JobForDiscoveryScore[]
): string {
  const jobBlocks = jobs
    .map(
      (j, i) =>
        `[Job ${i + 1} id=${j.id}]
Title: ${j.title}
Company: ${j.company ?? "Unknown"}
Location: ${j.location ?? "Unknown"}
Description:
${j.description.slice(0, DISCOVERY_SCORE_JD_MAX_LENGTH)}`
    )
    .join("\n\n");

  return `Score each job against this candidate (0-100). Use only the selected resume as candidate evidence.

Resume (${resume.name}):
${resume.extracted_text.slice(0, 6000)}

Jobs:
${jobBlocks}

Return JSON:
{
  "scores": [
    { "jobId": "<same id as input>", "matchScore": <0-100>, "note": "<one sentence why>" }
  ]
}

Rules:
- Include every job id from the input exactly once
- Use only facts from the selected resume. Do not use profile, saved preferences, or unstated background.
- 80+ = strong match, 60-79 = reasonable, below 60 = weak`;
}

export const COVER_LETTER_SYSTEM = `You write concise, professional cover letters that sound human, not generic AI fluff.
Use only factual details from the profile and resume. 3-4 short paragraphs max.
Return ONLY the cover letter plain text, no JSON.`;

export function buildCoverLetterPrompt(
  profile: Profile,
  resume: Resume,
  jobDescription: string,
  company: string | null,
  jobTitle: string | null
): string {
  return `Write a tailored cover letter.

Company: ${company ?? "the company"}
Role: ${jobTitle ?? "the position"}

Job Description (excerpt for context):
${jobDescription.slice(0, 4000)}

Candidate:
Name: ${profile.name}
${buildProfileContext(profile)}

Resume used:
${resume.extracted_text.slice(0, 6000)}

Requirements:
- Professional, concise, natural tone
- Mention 1-2 specific reasons for interest in the company/role if inferable from JD
- Highlight 2-3 strongest relevant achievements
- Do not invent experience`;
}

export const RESUME_TO_PROFILE_SYSTEM = `You extract structured profile data from resume text for a job search app.
Rules:
- Only include facts explicitly stated in the resume. Do not invent employers, degrees, skills, or dates.
- If a field is missing, use null for strings or empty arrays for lists.
- work_experience bullets should be achievement-oriented phrases from the resume.
- skills should be technical and professional skills mentioned in the resume.
- target_job_titles: infer 1-3 reasonable titles from recent roles if not stated.
- Return ONLY valid JSON matching the schema.`;

export function buildResumeToProfilePrompt(resumeText: string): string {
  return `Extract profile fields from this resume text.

Resume:
${resumeText.slice(0, 14000)}

Return JSON:
{
  "name": "string | null",
  "email": "string | null",
  "location": "string | null",
  "skills": ["..."],
  "target_job_titles": ["..."],
  "preferred_locations": [],
  "visa_notes": "string | null",
  "education": [
    { "school": "", "degree": "", "major": "", "startDate": "", "endDate": "" }
  ],
  "work_experience": [
    {
      "company": "",
      "title": "",
      "location": "",
      "startDate": "",
      "endDate": "",
      "bullets": ["achievement 1", "achievement 2"]
    }
  ],
  "projects": [
    {
      "name": "Project title",
      "technologies": ["gRPC", "MongoDB"],
      "bullets": ["What you built or achieved"]
    }
  ]
}`;
}
