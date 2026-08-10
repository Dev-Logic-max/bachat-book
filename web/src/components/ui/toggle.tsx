"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
}

export function Toggle({ checked, onChange, label, description }: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      {(label || description) && (
        <div className="min-w-0 flex-1">
          {label && <p className="text-sm font-medium">{label}</p>}
          {description && (
            <p className="text-muted text-xs mt-0.5">{description}</p>
          )}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2",
          checked ? "bg-navy-900 dark:bg-brass" : "bg-surface-3",
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out dark:bg-navy-900",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}
