"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PrimaryButton } from "@/components/ui/primary-button";
import { FormInput } from "@/components/ui/form-input";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold tracking-tight text-zinc-900">
            Job Copilot
          </p>
          <p className="text-sm text-zinc-500">AI job search assistant</p>
        </div>
      </div>

      <Card className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Sign in to continue your job search
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <Alert variant="error">{error}</Alert>}

          <FormInput
            label="Email"
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <FormInput
            label="Password"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <PrimaryButton type="submit" className="w-full" loading={loading} size="lg">
            Sign in
          </PrimaryButton>
        </form>

        <p className="mt-8 text-center text-sm text-zinc-500">
          No account?{" "}
          <Link
            href="/signup"
            className="font-medium text-indigo-600 hover:text-indigo-500"
          >
            Sign up
          </Link>
        </p>
      </Card>
    </div>
  );
}
