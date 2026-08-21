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
  imageSrc = "/art/empty-shop.webp",
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
        /*
          NO `mix-blend-multiply`, and that is the fix rather than a tidy-up.
          The blend existed to knock the white background out of the one opaque
          PNG this component used to show. Every illustration is now a real
          transparent WebP, and multiplying one of those against the page muddies
          every mid-tone and softens the edges — which is exactly the "high
          quality but looks slightly blurry at 100%" effect. Compositing it
          normally is both correct and sharper.

          `object-contain`, not `cover`: the art is square and already trimmed to
          its subject, so `cover` could only ever crop it.
        */
        <div className="relative mb-4 size-40">
          <img
            src={imageSrc}
            alt=""
            className="size-full object-contain"
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
