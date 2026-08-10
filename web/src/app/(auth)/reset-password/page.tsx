"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { resetPasswordAction } from "@/lib/supabase/actions";

/**
 * Where a password-recovery link lands.
 *
 * /auth/callback has already exchanged the recovery code for a session by the
 * time this renders, so the user is technically signed in — which is exactly
 * why this screen has to exist. Sending the link straight to the app would log
 * them in and never change the password they came here to change.
 */
export default function ResetPasswordPage() {
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");

  // Derived, not stored in an effect — React Compiler bans synchronous
  // setState inside useEffect (see CLAUDE.md §Traps).
  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= 8 && password === confirm && !loading;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await resetPasswordAction(null, new FormData(e.currentTarget));

    // A successful action redirects, so reaching here at all means it failed.
    setLoading(false);
    if (res?.error) setError(res.error);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Choose a new password
        </h2>
        <p className="text-muted mt-1 text-xs">
          You are signed in from your reset link. Set a new password to finish.
        </p>
      </div>

      {error && (
        <div className="bg-loss/10 border-loss/20 text-loss rounded-control border p-3 text-xs">
          {error}
        </div>
      )}

      {/* The reveal toggle now comes from Input itself, so this page no longer
          carries its own copy — all three password screens share one. */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="New password"
          name="password"
          type="password"
          placeholder="At least 8 characters"
          prefixIcon={<Lock size={16} />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={tooShort ? "Must be at least 8 characters." : undefined}
          autoComplete="new-password"
          required
        />

        <Input
          label="Confirm new password"
          name="confirm_password"
          type="password"
          placeholder="Re-enter the password"
          prefixIcon={<ShieldCheck size={16} />}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch ? "The two passwords do not match." : undefined}
          autoComplete="new-password"
          required
        />

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          isLoading={loading}
          disabled={!canSubmit}
        >
          Update password
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
