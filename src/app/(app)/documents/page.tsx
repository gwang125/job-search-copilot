import { createClient } from "@/lib/supabase/server";
import { normalizeDocumentRow } from "@/lib/supabase/normalize";
import { PageContainer } from "@/components/layout/page-container";
import { DocumentsList } from "@/components/documents/documents-list";
import type {
  GeneratedDocument,
  JobSummaryPick,
} from "@/types/database";

export default async function DocumentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: documents } = await supabase
    .from("generated_documents")
    .select("*, job:jobs(company, job_title)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  const rows = (documents ?? []).map((row) =>
    normalizeDocumentRow(
      row as GeneratedDocument & {
        job?: JobSummaryPick | JobSummaryPick[] | null;
      }
    )
  );

  return (
    <PageContainer
      title="Documents"
      description="Archived PDFs from earlier sessions (optional)."
      maxWidth="3xl"
    >
      <DocumentsList documents={rows} />
    </PageContainer>
  );
}
