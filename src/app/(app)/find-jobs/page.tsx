import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/page-container";
import { JobDiscoveryPanel } from "@/components/find-jobs/job-discovery-panel";
import {
  getActiveSearchKeywords,
  getJobSearchPreferences,
} from "@/lib/supabase/job-search-preferences";
import type { Resume } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function FindJobsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: resumes }, jobSearchPreferences] = await Promise.all([
    supabase
      .from("resumes")
      .select("*")
      .eq("user_id", user!.id)
      .order("is_primary", { ascending: false }),
    getJobSearchPreferences(supabase, user!.id),
  ]);

  const activeSearchKeywords = getActiveSearchKeywords(jobSearchPreferences);

  return (
    <PageContainer
      title="Find jobs"
      description="Search LinkedIn using your Find jobs search keywords. Filter results, score against your selected resume, then open listings or mark roles as applied."
      maxWidth="4xl"
    >
      <JobDiscoveryPanel
        userId={user!.id}
        resumes={(resumes as Resume[]) ?? []}
        activeSearchKeywords={activeSearchKeywords}
      />
    </PageContainer>
  );
}
