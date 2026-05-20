import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/page-container";
import { JobDiscoveryPanel } from "@/components/find-jobs/job-discovery-panel";
import { getOrCreateProfile } from "@/lib/supabase/profile";
import type { Resume } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function FindJobsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: resumes }, profile] = await Promise.all([
    supabase
      .from("resumes")
      .select("*")
      .eq("user_id", user!.id)
      .order("is_primary", { ascending: false }),
    getOrCreateProfile(supabase, user!.id, user!.email),
  ]);

  const defaultKeywords =
    profile?.target_job_titles?.length
      ? profile.target_job_titles.join(" ")
      : "";
  const defaultLocation =
    profile?.preferred_locations?.[0] ?? profile?.location ?? "";

  return (
    <PageContainer
      title="Find jobs"
      description="Search LinkedIn for roles that match your resume. Filter by post date and work type, then open the listing or analyze it in depth."
      maxWidth="4xl"
    >
      <JobDiscoveryPanel
        userId={user!.id}
        resumes={(resumes as Resume[]) ?? []}
        defaultKeywords={defaultKeywords}
        defaultLocation={defaultLocation}
      />
    </PageContainer>
  );
}
