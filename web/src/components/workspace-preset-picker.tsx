"use client";

import * as React from "react";
import {
  Building,
  Factory,
  Laptop,
  Store,
  User,
  Users,
  Wheat,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PRESETS, presetModuleCounts, type WorkspacePreset } from "@/lib/modules";

const ICONS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  User, Users, Store, Wheat, Laptop, Factory, Building,
};

/**
 * Choose what a workspace is for.
 *
 * The count on the right is the point. "Business" as a bare label tells you
 * nothing about what you get; "14 modules, 4 more coming" does. Live and
 * upcoming are counted separately on purpose — a card advertising modules that
 * are not built yet is a card that lies to you at signup.
 */
export function WorkspacePresetPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: WorkspacePreset;
  onChange: (preset: WorkspacePreset) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="text-foreground-2 mb-2 text-[12.5px] font-medium">
        What is it for
      </p>

      <div
        role="radiogroup"
        aria-label="Workspace type"
        className="scroll-hidden max-h-[19rem] space-y-1.5 overflow-y-auto pe-0.5"
      >
        {PRESETS.map((preset) => {
          const Icon = ICONS[preset.icon] ?? User;
          const counts = presetModuleCounts(preset.key);
          const active = value === preset.key;

          return (
            <button
              key={preset.key}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(preset.key)}
              className={cn(
                "flex w-full items-center gap-3 rounded-card border p-2.5 text-left transition-colors disabled:opacity-50",
                active
                  ? "border-brass bg-brass-soft"
                  : "border-border hover:bg-surface-subtle",
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-card",
                  active ? "bg-brass text-navy-900" : "bg-surface-subtle text-brass-strong",
                )}
              >
                <Icon size={17} strokeWidth={1.75} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="text-foreground flex items-center gap-1.5 text-[13px] font-medium leading-tight">
                  {preset.label}
                  {preset.labelUr && (
                    <span className="text-faint copy text-[11px]" dir="auto">
                      {preset.labelUr}
                    </span>
                  )}
                </span>
                <span className="text-faint block text-[11px] leading-snug">
                  {preset.description}
                </span>
              </span>

              <span className="shrink-0 text-right">
                <span
                  className={cn(
                    "block text-[13px] font-semibold tabular-nums leading-tight",
                    active ? "text-brass-strong" : "text-foreground-2",
                  )}
                >
                  {counts.live}
                </span>
                <span className="text-faint block text-[9.5px] uppercase tracking-wide">
                  modules
                </span>
                {counts.soon > 0 && (
                  <span className="text-faint block text-[9.5px]">
                    +{counts.soon} soon
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-faint mt-2 text-[11px] leading-snug">
        This only decides what you start with. Every module can be turned on or
        off afterwards without changing the workspace type.
      </p>
    </div>
  );
}
