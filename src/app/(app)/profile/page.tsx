import { createClient } from "@/lib/supabase/server";
import { getOrCreateProfile } from "@/lib/supabase/profile";
import { getJobSearchPreferences } from "@/lib/supabase/job-search-preferences";
import { PageContainer } from "@/components/layout/page-container";
import { ProfileForm } from "@/components/profile/profile-form";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [profile, jobSearchPreferences] = await Promise.all([
    getOrCreateProfile(supabase, user.id, user.email),
    getJobSearchPreferences(supabase, user.id),
  ]);

  return (
    <PageContainer
      title="Profile"
      description="Your background powers job match analysis and application tracking."
      maxWidth="3xl"
    >
      <ProfileForm
        profile={profile}
        userId={user.id}
        jobSearchPreferences={jobSearchPreferences}
      />
    </PageContainer>
  );
}
