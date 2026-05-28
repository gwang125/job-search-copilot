import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/page-container";
import { JobDiscoveryPanel } from "@/components/find-jobs/job-discovery-panel";
import { getOrCreateProfile } from "@/lib/supabase/profile";
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

  const [{ data: resumes }, profile, jobSearchPreferences] = await Promise.all([
    supabase
      .from("resumes")
      .select("*")
      .eq("user_id", user!.id)
      .order("is_primary", { ascending: false }),
    getOrCreateProfile(supabase, user!.id, user!.email),
    getJobSearchPreferences(supabase, user!.id),
  ]);

  const activeSearchKeywords = getActiveSearchKeywords(
    jobSearchPreferences,
    profile
  );
  const defaultLocation =
    profile?.preferred_locations?.[0] ?? profile?.location ?? "";

  return (
    <PageContainer
      title="Find jobs"
      description="Search LinkedIn using your Profile search keywords. Filter by post date and work type, then open listings or mark roles as applied."
      maxWidth="4xl"
    >
      <JobDiscoveryPanel
        userId={user!.id}
        resumes={(resumes as Resume[]) ?? []}
        activeSearchKeywords={activeSearchKeywords}
        defaultLocation={defaultLocation}
      />
    </PageContainer>
  );
}
