"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function AppHeader({ title, description }: { title: string; description?: string }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex items-start justify-between border-b border-slate-200 bg-white px-8 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>
      <Button variant="ghost" size="sm" onClick={signOut}>
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </header>
  );
}
