"use client";

import * as React from "react";
import Link from "next/link";
import { Mail, Lock, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { signUpAction } from "@/lib/supabase/actions";

export default function SignUpPage() {
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const res = await signUpAction(null, formData);

    if (res?.error) {
      setError(res.error);
      setLoading(false);
    }
  };

  const handleGoogleSignUp = () => {
    showToast({
      type: "info",
      title: "Google Sign-Up",
      description: "Google OAuth is coming soon! Please use email and password for now.",
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Create Account
        </h2>
        <p className="text-muted mt-1 text-xs">
          Start managing your personal & family finances
        </p>
      </div>

      {error && (
        <div className="bg-loss/10 border-loss/20 text-loss rounded-control border p-3 text-xs">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First name"
            name="first_name"
            placeholder="e.g. Tariq"
            prefixIcon={<User size={15} />}
            required
          />
          <Input
            label="Last name"
            name="last_name"
            placeholder="e.g. Khan"
          />
        </div>

        <Input
          label="Email address"
          name="email"
          type="email"
          placeholder="name@example.com"
          prefixIcon={<Mail size={16} />}
          required
        />

        <Input
          label="Password"
          name="password"
          type="password"
          placeholder="At least 8 characters"
          prefixIcon={<Lock size={16} />}
          minLength={8}
          autoComplete="new-password"
          hint="8 characters or more. Avoid a password you use elsewhere — Supabase rejects any that appear in known breaches."
          required
        />

        <Button type="submit" variant="primary" className="w-full" isLoading={loading}>
          Create Account
        </Button>
      </form>

      <div className="relative flex items-center justify-center">
        <div className="border-border w-full border-t" />
        <span className="bg-surface text-faint absolute px-3 text-[11px] uppercase tracking-wider">
          or
        </span>
      </div>

      <Button
        type="button"
        variant="secondary"
        className="w-full gap-2.5"
        onClick={handleGoogleSignUp}
      >
        <svg className="size-4" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        Continue with Google
      </Button>

      <p className="text-muted text-center text-xs">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-brass-strong font-semibold hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
