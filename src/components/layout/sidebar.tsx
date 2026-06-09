"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Briefcase,
  Compass,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  ScanSearch,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/resumes", label: "Resumes", icon: FileText },
  { href: "/find-jobs", label: "Find jobs", icon: Compass },
  { href: "/job-analyzer", label: "Job Analyzer", icon: ScanSearch },
  { href: "/cover-letters", label: "Cover letters", icon: Mail },
  { href: "/applications", label: "Applications", icon: Briefcase },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Mobile top bar — hidden on lg+ */}
      <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4 lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-zinc-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          Job Copilot
        </Link>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* One sidebar: off-canvas on mobile, fixed on desktop */}
      <aside
        className={cn(
          "fixed left-0 z-50 flex w-[260px] flex-col border-r border-zinc-200 bg-white",
          "transition-transform duration-200 ease-out",
          "top-14 h-[calc(100vh-3.5rem)] lg:top-0 lg:h-screen",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="hidden h-16 shrink-0 items-center gap-3 border-b border-zinc-200 px-5 lg:flex">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <Link href="/dashboard" className="block truncate font-semibold text-zinc-900">
              Job Copilot
            </Link>
            <p className="truncate text-xs text-zinc-500">AI job search</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium",
                  active
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-200 p-3">
          <button
            type="button"
            onClick={signOut}
            className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
