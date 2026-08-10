"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  prefixIcon?: React.ReactNode;
  /** Set false to opt out of the built-in reveal on a password field. */
  revealPassword?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      label,
      error,
      hint,
      prefixIcon,
      id,
      revealPassword = true,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    /*
     * Password visibility lives here rather than in each auth screen. sign-in and
     * sign-up had no toggle at all while /reset-password had its own copy — three
     * password fields, one of which worked. Any `type="password"` now gets it.
     */
    const isPassword = type === "password";
    const [revealed, setRevealed] = React.useState(false);
    const showToggle = isPassword && revealPassword;
    const effectiveType = showToggle && revealed ? "text" : type;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-foreground-2 block text-xs font-medium"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {prefixIcon && (
            <div className="text-faint pointer-events-none absolute left-3.5 flex items-center justify-center">
              {prefixIcon}
            </div>
          )}
          <input
            id={inputId}
            type={effectiveType}
            className={cn(
              "border-border bg-surface text-foreground placeholder:text-faint focus:border-navy-900 focus:ring-navy-900/10 dark:focus:border-brass flex h-10 w-full rounded-control border px-3.5 py-2 text-sm transition-all outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
              prefixIcon && "ps-10",
              showToggle && "pe-10",
              error && "border-loss focus:border-loss focus:ring-loss/10",
              className,
            )}
            ref={ref}
            {...props}
          />
          {showToggle && (
            // A real <button type="button">: a bare div here would submit nothing
            // but would also be invisible to keyboard and screen-reader users.
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? "Hide password" : "Show password"}
              aria-pressed={revealed}
              tabIndex={-1}
              className="text-faint hover:text-foreground-2 absolute end-2.5 flex size-7 items-center justify-center rounded-full transition-colors"
            >
              {revealed ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
            </button>
          )}
        </div>
        {hint && !error && <p className="text-faint text-[11px]">{hint}</p>}
        {error && <p className="text-loss text-[11.5px] font-medium">{error}</p>}
      </div>
    );
  },
);

Input.displayName = "Input";
