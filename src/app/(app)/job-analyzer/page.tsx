import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/page-container";
import { JobAnalyzerFlow } from "@/components/job-analyzer/job-analyzer-flow";
import type { Resume } from "@/types/database";

export default async function JobAnalyzerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: resumes } = await supabase
    .from("resumes")
    .select("*")
    .eq("user_id", user!.id)
    .order("is_primary", { ascending: false });

  return (
    <PageContainer
      title="Job Analyzer"
      description="Compare a job to your resumes and see which file to use when applying."
      maxWidth="3xl"
    >
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <JobAnalyzerFlow initialResumes={(resumes as Resume[]) ?? []} />
      </Suspense>
    </PageContainer>
  );
}
