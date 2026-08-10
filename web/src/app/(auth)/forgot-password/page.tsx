"use client";

import * as React from "react";
import Link from "next/link";
import { Mail, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { forgotPasswordAction } from "@/lib/supabase/actions";

export default function ForgotPasswordPage() {
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const res = await forgotPasswordAction(null, formData);

    setLoading(false);
    if (res?.error) {
      setError(res.error);
    } else if (res?.success) {
      setSuccess(res.success);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Reset Password
        </h2>
        <p className="text-muted mt-1 text-xs">
          Enter your email address to receive a password reset link
        </p>
      </div>

      {error && (
        <div className="bg-loss/10 border-loss/20 text-loss rounded-control border p-3 text-xs">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-gain/10 border-gain/20 text-gain rounded-control border p-3 text-xs">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email address"
          name="email"
          type="email"
          placeholder="name@example.com"
          prefixIcon={<Mail size={16} />}
          required
        />

        <Button type="submit" variant="primary" className="w-full" isLoading={loading}>
          Send Reset Link
        </Button>
      </form>

      <div className="flex justify-center pt-2">
        <Link
          href="/sign-in"
          className="text-muted hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium"
        >
          <ArrowLeft size={14} />
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
