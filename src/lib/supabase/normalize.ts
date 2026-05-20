import { resolveJobRelation } from "@/lib/utils";
import type {
  Application,
  ApplicationWithJob,
  GeneratedDocument,
  GeneratedDocumentWithJob,
  Job,
  JobSummaryPick,
} from "@/types/database";

/** Normalize Supabase nested `jobs` relation (object or array) on an application row */
export function normalizeApplicationRow(
  row: Application & { job?: Job | Job[] | null }
): ApplicationWithJob {
  return {
    ...row,
    job: resolveJobRelation(row.job),
  };
}

/** Normalize nested `jobs(company, job_title)` on generated_documents */
export function normalizeDocumentRow(
  row: GeneratedDocument & { job?: JobSummaryPick | JobSummaryPick[] | null }
): GeneratedDocumentWithJob {
  return {
    ...row,
    job: resolveJobRelation(row.job),
  };
}
