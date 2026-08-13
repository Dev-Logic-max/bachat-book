"use client";

import * as React from "react";
import { Pencil, Power, PowerOff, Trash2, Link2, Link2Off } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The one edit/delete affordance for the whole app.
 *
 * Placement rules (owner-decided):
 *   cards / list rows -> visible on hover AND on :focus-within, so keyboard users
 *                        can reach them. Hover-only is an accessibility bug.
 *   detail pages      -> always visible, in the page header.
 *   below `lg`        -> always visible; touch has no hover state at all.
 *
 * Icon spec: 15px glyph, strokeWidth 1.75, inside a 28px round hit area. Small
 * and coloured, never a filled red button inside a list row.
 */
export function RowActions({
  onEdit,
  onDelete,
  onUnlink,
  onToggleActive,
  isActive = true,
  editLabel = "Edit",
  deleteLabel = "Delete",
  /** `hover` for cards and rows, `always` for detail-page headers. */
  reveal = "hover",
  className,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  onUnlink?: () => void;
  /**
   * Deactivate / reactivate. Distinct from delete on purpose — deactivating is
   * reversible and keeps every record, so it must not sit behind the same red
   * icon as the permanent one.
   */
  onToggleActive?: () => void;
  isActive?: boolean;
  editLabel?: string;
  deleteLabel?: string;
  reveal?: "hover" | "always";
  className?: string;
}) {
  const base =
    "flex size-7 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/40";

  return (
    <div
      className={cn(
        "flex items-center gap-1",
        reveal === "hover" &&
          // Opacity, not `hidden`: a display-toggled button is unreachable by tab
          // order until it is shown, so focus-within could never fire.
          "opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100",
        className,
      )}
    >
      {onUnlink && (
        <button
          type="button"
          onClick={onUnlink}
          title="Unlink"
          aria-label="Unlink"
          className={cn(base, "text-muted hover:text-foreground-2 hover:bg-surface-3")}
        >
          <Link2Off size={15} strokeWidth={1.75} />
        </button>
      )}
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          title={editLabel}
          aria-label={editLabel}
          className={cn(
            base,
            "text-foreground-2 hover:text-brass-strong hover:bg-brass-soft",
          )}
        >
          <Pencil size={15} strokeWidth={1.75} />
        </button>
      )}
      {onToggleActive && (
        <button
          type="button"
          onClick={onToggleActive}
          title={isActive ? "Deactivate" : "Reactivate"}
          aria-label={isActive ? "Deactivate" : "Reactivate"}
          className={cn(base, "text-muted hover:text-foreground-2 hover:bg-surface-3")}
        >
          {isActive ? (
            <PowerOff size={15} strokeWidth={1.75} />
          ) : (
            <Power size={15} strokeWidth={1.75} />
          )}
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          title={deleteLabel}
          aria-label={deleteLabel}
          className={cn(base, "text-muted hover:text-loss hover:bg-loss-soft")}
        >
          <Trash2 size={15} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}

/** Small "synced to an account" marker for entry rows. */
export function LinkBadge({
  label,
  href,
  className,
}: {
  label: string;
  href?: string;
  className?: string;
}) {
  const content = (
    <>
      <Link2 size={11} strokeWidth={2} className="shrink-0" />
      <span className="truncate">{label}</span>
    </>
  );

  const classes = cn(
    "bg-brass-soft text-brass-strong inline-flex max-w-[11rem] items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
    href && "hover:underline",
    className,
  );

  if (href) {
    return (
      <a href={href} className={classes} onClick={(e) => e.stopPropagation()}>
        {content}
      </a>
    );
  }
  return <span className={classes}>{content}</span>;
}
