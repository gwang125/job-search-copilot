import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/page-container";
import { Card } from "@/components/ui/card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SectionHeader } from "@/components/layout/section-header";
import { Briefcase, Compass, FileText, ScanSearch, TrendingUp } from "lucide-react";
import { resolveJobRelation, type JobSummary } from "@/lib/utils";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { count: applicationsCount },
    { count: resumesCount },
    { count: documentsCount },
    { data: recentApplications },
  ] = await Promise.all([
    supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user!.id),
    supabase
      .from("resumes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user!.id),
    supabase
      .from("generated_documents")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user!.id),
    supabase
      .from("applications")
      .select("id, status, match_score, job:jobs(company, job_title)")
      .eq("user_id", user!.id)
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  const stats = [
    {
      label: "Applications",
      value: applicationsCount ?? 0,
      icon: Briefcase,
      href: "/applications",
    },
    {
      label: "Resumes",
      value: resumesCount ?? 0,
      icon: FileText,
      href: "/resumes",
    },
    {
      label: "Generated docs",
      value: documentsCount ?? 0,
      icon: TrendingUp,
      href: "/documents",
    },
  ];

  return (
    <PageContainer
      title="Dashboard"
      description="Your job search pipeline at a glance."
    >
      <div className="space-y-8">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-white">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
                  Find matching jobs
                </h2>
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-600">
                  Search LinkedIn with filters like post date and work type. Get
                  positions ranked by how well they match your resume.
                </p>
              </div>
              <Link href="/find-jobs" className="shrink-0">
                <PrimaryButton size="lg">
                  <Compass className="h-4 w-4" />
                  Find jobs
                </PrimaryButton>
              </Link>
            </div>
          </Card>

          <Card>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
                  Analyze a new job
                </h2>
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-600">
                  Paste a job URL or description, see how well you match, and get
                  a recommendation for which resume to submit.
                </p>
              </div>
              <Link href="/job-analyzer" className="shrink-0">
                <PrimaryButton size="lg" variant="secondary">
                  <ScanSearch className="h-4 w-4" />
                  Job Analyzer
                </PrimaryButton>
              </Link>
            </div>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map(({ label, value, icon: Icon, href }) => (
            <Link key={label} href={href} className="group">
              <Card className="transition-all hover:border-zinc-300 hover:shadow-md">
                <div className="flex items-center gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-zinc-500">{label}</p>
                    <p className="text-2xl font-semibold tracking-tight text-zinc-900">
                      {value}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        <Card>
          <SectionHeader title="Recent applications" />
          {recentApplications && recentApplications.length > 0 ? (
            <ul className="divide-y divide-zinc-100">
              {recentApplications.map((app) => {
                const job = resolveJobRelation(
                  app.job as JobSummary | JobSummary[] | null | undefined
                );
                return (
                  <li
                    key={app.id}
                    className="flex flex-col gap-1 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-medium text-zinc-900">
                      {job?.job_title ?? "Untitled role"}
                      {job?.company ? ` at ${job.company}` : ""}
                    </span>
                    <span className="text-zinc-500 capitalize">
                      {app.status}
                      {app.match_score != null && ` · ${app.match_score}%`}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">
              No applications yet.{" "}
              <Link
                href="/job-analyzer"
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Analyze your first job
              </Link>
            </p>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
