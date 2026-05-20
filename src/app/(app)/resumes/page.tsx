import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/page-container";
import { ResumeManager } from "@/components/resumes/resume-manager";
import type { Resume } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function ResumesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: resumes } = await supabase
    .from("resumes")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <PageContainer
      title="Resumes"
      description="Upload PDF or Word resumes. The Job Analyzer compares them to each job and recommends which to submit."
      maxWidth="3xl"
    >
      <ResumeManager initialResumes={(resumes as Resume[]) ?? []} />
    </PageContainer>
  );
}
