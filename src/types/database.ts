export type ApplicationStatus =
  | "saved"
  | "applied"
  | "interview"
  | "rejected"
  | "offer"
  | "archived";

export type AiRecommendation = "apply" | "maybe" | "skip";

export type GeneratedDocumentType = "tailored_resume" | "cover_letter";

export interface EducationEntry {
  school: string;
  degree?: string;
  major?: string;
  field?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface WorkExperienceEntry {
  company: string;
  title: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  bullets: string[];
}

export interface ProjectEntry {
  name: string;
  organization?: string;
  location?: string;
  description?: string;
  technologies?: string[];
  url?: string;
  bullets?: string[];
}

export interface JobSearchPreferences {
  id: string;
  user_id: string;
  exclude_us_citizenship_required: boolean;
  exclude_security_clearance_required: boolean;
  exclude_no_visa_sponsorship: boolean;
  exclude_green_card_required: boolean;
  max_years_experience: number | null;
  exclude_phd_required: boolean;
  excluded_certifications: string[];
  remote_only: boolean;
  hybrid_allowed: boolean;
  preferred_locations: string[];
  blocked_keywords: string[];
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  location: string | null;
  education: EducationEntry[];
  work_experience: WorkExperienceEntry[];
  skills: string[];
  projects: ProjectEntry[];
  target_job_titles: string[];
  preferred_locations: string[];
  visa_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParsedProfileFromResume {
  name: string | null;
  email: string | null;
  location: string | null;
  skills: string[];
  target_job_titles: string[];
  preferred_locations: string[];
  visa_notes: string | null;
  education: EducationEntry[];
  work_experience: WorkExperienceEntry[];
  projects: ProjectEntry[];
}

export interface Resume {
  id: string;
  user_id: string;
  name: string;
  file_path: string | null;
  file_name: string | null;
  extracted_text: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResumeTemplate {
  user_id: string;
  name: string;
  file_path: string;
  file_name: string;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  user_id: string;
  company: string | null;
  job_title: string | null;
  location: string | null;
  job_url: string | null;
  job_description: string;
  created_at: string;
  updated_at: string;
}

/** Find Jobs: listings the user chose not to consider again */
export interface JobSearchDismissal {
  id: string;
  user_id: string;
  linkedin_job_id: string;
  job_url: string | null;
  job_title: string | null;
  company: string | null;
  created_at: string;
}

export interface Application {
  id: string;
  user_id: string;
  job_id: string;
  best_resume_id: string | null;
  match_score: number | null;
  status: ApplicationStatus;
  applied_date: string | null;
  follow_up_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  job?: Job;
}

export type ApplicationWithJob = Omit<Application, "job"> & {
  job: Job | null;
};

export type JobSummaryPick = Pick<Job, "company" | "job_title">;

export interface AiAnalysis {
  id: string;
  user_id: string;
  job_id: string;
  application_id: string | null;
  match_score: number;
  best_resume_id: string | null;
  reasons: string[];
  matched_skills: string[];
  missing_skills: string[];
  risks: string[];
  recommendation: AiRecommendation;
  suggested_changes: string[];
  raw_response: Record<string, unknown> | null;
  created_at: string;
}

export interface GeneratedDocument {
  id: string;
  user_id: string;
  job_id: string;
  application_id: string | null;
  resume_id: string | null;
  document_type: GeneratedDocumentType;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  job?: Job;
}

export type GeneratedDocumentWithJob = Omit<GeneratedDocument, "job"> & {
  job: JobSummaryPick | null;
};

export interface ResumeMatchScore {
  resumeId: string;
  score: number;
  note: string;
}

export interface JobMatchAnalysis {
  matchScore: number;
  bestResumeId: string;
  reasons: string[];
  matchedSkills: string[];
  missingSkills: string[];
  risks: string[];
  recommendation: AiRecommendation;
  suggestedChanges: string[];
  resumeScores?: ResumeMatchScore[];
}

export interface ParsedJob {
  company: string | null;
  jobTitle: string | null;
  location: string | null;
  jobDescription: string;
  parseError?: string;
  requiresLinkedInAuth?: boolean;
}

export interface DuplicateWarning {
  isDuplicate: boolean;
  message: string;
  similarApplications: Array<{
    id: string;
    company: string | null;
    job_title: string | null;
    status: ApplicationStatus;
  }>;
}

export interface TailoredResumeContent {
  summary: string;
  skills: string[];
  experience: Array<{
    company: string;
    title: string;
    location?: string;
    dates?: string;
    bullets: string[];
  }>;
  education: Array<{
    school: string;
    degree?: string;
    major?: string;
    dates?: string;
    details?: string;
  }>;
  projects?: Array<{
    name: string;
    technologies?: string[];
    bullets: string[];
  }>;
}

export interface DiscoveredJobMatch {
  linkedInJobId: string;
  title: string;
  company: string | null;
  location: string | null;
  jobUrl: string;
  postedText: string | null;
  matchScore: number;
  matchNote: string;
}
