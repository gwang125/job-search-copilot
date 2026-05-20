import { Sidebar } from "@/components/layout/sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <Sidebar />
      <div className="min-h-screen pt-14 lg:ml-[260px] lg:pt-0">
        <main className="mx-auto min-h-screen max-w-6xl p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
