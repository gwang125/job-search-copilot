import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/page-container";
import { CoverLetterGenerator } from "@/components/cover-letters/cover-letter-generator";
import type { Resume } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function CoverLettersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: resumes } = await supabase
    .from("resumes")
    .select("*")
    .eq("user_id", user!.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <PageContainer
      title="Cover letters"
      description="Generate a cover letter from a selected resume and download it as a PDF without saving an archive."
      maxWidth="6xl"
    >
      <CoverLetterGenerator resumes={(resumes as Resume[]) ?? []} />
    </PageContainer>
  );
}
