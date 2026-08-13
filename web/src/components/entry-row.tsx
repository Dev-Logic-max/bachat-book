"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { CategoryChip } from "@/components/category-icon";
import { LinkBadge, RowActions } from "@/components/ui/row-actions";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { Tables } from "@/lib/supabase/types";

export type EntryWithCategory = Tables<"transactions"> & {
  categories: Tables<"categories"> | null;
};

/**
 * One movement, rendered as an entry. Shared by /entries and the dashboard's
 * Recent Activity so the same record never renders two different ways.
 *
 * `group` on the <li> is what drives the hover reveal in RowActions — remove it
 * and the actions never appear.
 */
export function EntryRow({
  entry,
  accountName,
  onEdit,
  onDelete,
  className,
}: {
  entry: EntryWithCategory;
  /** Which balance this moved. Always present now — every entry names an account. */
  accountName?: string | null;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}) {
  // The column is SIGNED; `type` agrees with it by constraint. Read the sign so
  // the row cannot disagree with the balance it moved.
  const amount = Number(entry.amount_paisa);
  const isIncome = amount >= 0;
  const categoryName = entry.categories?.name ?? "Uncategorised";
  const title = entry.note?.trim() || categoryName;

  return (
    <li
      className={cn(
        "group hover:bg-surface-subtle/60 relative flex items-center gap-3 px-5 py-3 transition-colors",
        className,
      )}
    >
      {entry.categories ? (
        <CategoryChip
          icon={entry.categories.icon}
          tone={entry.categories.tone}
          size={36}
          iconSize={16}
        />
      ) : (
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            isIncome ? "bg-gain-soft text-gain" : "bg-loss-soft text-loss",
          )}
        >
          {isIncome ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-xs font-medium">{title}</p>
          {accountName && <LinkBadge label={accountName} />}
        </div>
        <p className="text-faint mt-0.5 text-[11px]">
          <span className="ltr">{entry.date}</span>
          {" · "}
          <span>{categoryName}</span>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            "tnum font-mono text-[13px] font-semibold",
            isIncome ? "text-gain" : "text-foreground",
          )}
        >
          {isIncome ? "+" : "−"}
          {formatPKR(Math.abs(amount))}
        </span>
        {(onEdit || onDelete) && (
          <RowActions onEdit={onEdit} onDelete={onDelete} reveal="hover" />
        )}
      </div>
    </li>
  );
}
