import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description: string;
  imageSrc?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  imageSrc = "/art/store.png",
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "bg-surface border-border flex flex-col items-center justify-center rounded-panel border p-8 text-center",
        className,
      )}
    >
      {imageSrc && (
        <div className="relative mb-4 size-32 overflow-hidden rounded-card">
          <img
            src={imageSrc}
            alt={title}
            className="size-full object-cover rounded-card mix-blend-multiply dark:mix-blend-normal"
          />
        </div>
      )}
      <h3 className="font-display text-base font-semibold tracking-tight">
        {title}
      </h3>
      <p className="text-muted mt-1 max-w-xs text-xs leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
