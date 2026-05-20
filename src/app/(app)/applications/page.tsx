import { createClient } from "@/lib/supabase/server";
import { normalizeApplicationRow } from "@/lib/supabase/normalize";
import { PageContainer } from "@/components/layout/page-container";
import { ApplicationsTable } from "@/components/applications/applications-table";
import type { Application, Job } from "@/types/database";

export default async function ApplicationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: applications } = await supabase
    .from("applications")
    .select("*, job:jobs(*)")
    .eq("user_id", user!.id)
    .order("updated_at", { ascending: false });

  const rows = (applications ?? []).map((row) =>
    normalizeApplicationRow(row as Application & { job?: Job | Job[] | null })
  );

  return (
    <PageContainer
      title="Applications"
      description="Track every role you're pursuing."
      maxWidth="6xl"
    >
      <ApplicationsTable applications={rows} />
    </PageContainer>
  );
}
