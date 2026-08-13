"use client";

import { ArrowDownRight, ArrowUpRight, CalendarDays } from "lucide-react";
import { CategoryChip, CategoryIcon, toneColor } from "@/components/category-icon";
import { MerchantMark } from "@/components/merchant-mark";
import { RowActions } from "@/components/ui/row-actions";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { Tables } from "@/lib/supabase/types";

export type EntryWithCategory = Tables<"transactions"> & {
  categories: Tables<"categories"> | null;
};

/** Just enough of an account to draw its mark and name on a row. */
export type EntryAccountRef = {
  name: string;
  logo: string | null;
  brand: string;
  awaitingLogo: boolean;
  deleted?: boolean;
};

/*
 * ONE grid template, shared by the header and every row.
 *
 * That sharing is the point: columns that are laid out per-row drift the moment
 * one merchant name is longer than another, and the whole list stops reading as
 * a table. Every cell is a fixed track except the title, which takes the slack
 * and truncates — so a long note shortens itself instead of pushing the amount
 * out of line.
 *
 * Below `lg` the middle tracks are display:none and drop out of the grid
 * entirely, leaving mark · title · amount · actions; their content moves into
 * the second line under the title.
 */
/*
 * COLUMNS ONLY — no `grid`. The header needs `hidden lg:grid` instead, and
 * Tailwind emits display utilities in its own order, so a template carrying
 * `grid` next to a `hidden` would win or lose depending on stylesheet order
 * rather than on what was written. Each user states its own display.
 */
const ENTRY_COLS =
  "items-center gap-x-3 grid-cols-[36px_minmax(0,1fr)_auto_auto] " +
  "lg:grid-cols-[36px_minmax(0,1fr)_148px_96px_150px_118px_72px]";

/**
 * Column headings for the entries table.
 *
 * The header sits on `bg-surface-subtle` rather than the card's own white. A
 * heading row that shares its background with the data below it is just smaller
 * grey text; one tint of separation is what makes the block read as a table and
 * gives the list a top edge to hang from.
 */
export function EntryRowHeader() {
  return (
    <li
      className={cn(
        ENTRY_COLS,
        // No border-b: the list's `divide-y` already draws the rule under this
        // row, and both together rendered a 2px line.
        "bg-surface-subtle text-muted hidden px-5 py-2 text-[10px] font-semibold uppercase tracking-widest lg:grid",
      )}
    >
      <span />
      <span>Entry</span>
      <span>Category</span>
      <span>Date</span>
      <span>Account</span>
      <span className="text-right">Amount</span>
      <span className="text-right">Actions</span>
    </li>
  );
}

/**
 * One movement, rendered as an entry row.
 *
 * `group` on the <li> is what drives the hover reveal in RowActions — remove it
 * and the actions never appear.
 */
export function EntryRow({
  entry,
  account,
  onEdit,
  onDelete,
  className,
}: {
  entry: EntryWithCategory;
  /** Which balance this moved. Always present — every entry names an account. */
  account?: EntryAccountRef | null;
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
        ENTRY_COLS,
        "group hover:bg-surface-subtle/60 relative grid px-5 py-2.5 transition-colors",
        className,
      )}
    >
      {entry.categories ? (
        <CategoryChip
          icon={entry.categories.icon}
          tone={entry.categories.tone}
          size={34}
          iconSize={15}
        />
      ) : (
        <div
          className={cn(
            "flex size-8.5 shrink-0 items-center justify-center rounded-full",
            isIncome ? "bg-gain-soft text-gain" : "bg-loss-soft text-loss",
          )}
        >
          {isIncome ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
        </div>
      )}

      <div className="min-w-0">
        <p className="truncate text-[12.5px] font-medium">{title}</p>

        {/*
          Narrow screens get the SAME THREE FACTS as the wide table, just
          wrapped instead of columned — the category as a tinted tag, the
          account behind its own bank mark, the date behind a calendar glyph.
          A run of plain grey text separated by dots was technically the same
          information and none of it was scannable.
        */}
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 lg:hidden">
          {entry.categories ? (
            <span
              className="inline-flex min-w-0 max-w-38 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-medium"
              style={{
                background: `color-mix(in oklab, ${toneColor(entry.categories.tone)} 12%, transparent)`,
                color: toneColor(entry.categories.tone),
              }}
            >
              <CategoryIcon icon={entry.categories.icon} size={10} />
              <span className="truncate">{categoryName}</span>
            </span>
          ) : (
            <span className="text-faint text-[10.5px] italic">Uncategorised</span>
          )}

          {account && (
            <span className="bg-surface-subtle inline-flex min-w-0 max-w-38 items-center gap-1 rounded-full py-0.5 pe-1.5 ps-0.5">
              <MerchantMark
                name={account.name}
                brand={account.brand}
                logo={account.logo ?? undefined}
                awaitingLogo={account.awaitingLogo}
                size={14}
              />
              <span
                className={cn(
                  "text-foreground-2 min-w-0 truncate text-[10.5px]",
                  account.deleted && "text-faint line-through",
                )}
              >
                {account.name}
              </span>
            </span>
          )}

          <span className="text-foreground-2 inline-flex shrink-0 items-center gap-1 text-[10.5px] font-medium">
            <CalendarDays size={10} className="text-faint" />
            <span className="ltr">{shortDate(entry.date)}</span>
          </span>
        </div>
      </div>

      {/* Category — a tinted tag, so the colour carries it before the word does. */}
      <span className="hidden min-w-0 lg:block">
        {entry.categories ? (
          <span
            className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium"
            style={{
              background: `color-mix(in oklab, ${toneColor(entry.categories.tone)} 12%, transparent)`,
              color: toneColor(entry.categories.tone),
            }}
          >
            <CategoryIcon icon={entry.categories.icon} size={11} />
            <span className="truncate">{categoryName}</span>
          </span>
        ) : (
          <span className="text-faint text-[11px] italic">Uncategorised</span>
        )}
      </span>

      {/* Date sits a tier darker than the other metadata — it is the thing you
          scan a ledger by. */}
      <span className="text-foreground-2 ltr hidden text-[11.5px] font-medium lg:block">
        {shortDate(entry.date)}
      </span>

      {/* WHERE the money moved. The old badge was a chain icon and a name, which
          said "linked" — a fact that is now true of every row and therefore worth
          nothing. The bank's own mark identifies it at a glance instead. */}
      <span className="hidden min-w-0 items-center gap-1.5 lg:flex">
        {account ? (
          <>
            <MerchantMark
              name={account.name}
              brand={account.brand}
              logo={account.logo ?? undefined}
              awaitingLogo={account.awaitingLogo}
              size={18}
            />
            <span
              className={cn(
                "text-foreground-2 min-w-0 truncate text-[11.5px]",
                account.deleted && "text-faint line-through",
              )}
            >
              {account.name}
            </span>
          </>
        ) : (
          <span className="text-faint text-[11px] italic">Unknown</span>
        )}
      </span>

      <span
        className={cn(
          "tnum text-right font-mono text-[12.5px] font-semibold",
          isIncome ? "text-gain" : "text-foreground",
        )}
      >
        {isIncome ? "+" : "−"}
        {formatPKR(Math.abs(amount))}
      </span>

      {/*
        Always visible and in their own colours — never hover-revealed. The
        column is headed "Actions", and a heading over an empty cell promises
        something the row does not show.
      */}
      <span className="flex justify-end">
        {(onEdit || onDelete) && (
          <RowActions onEdit={onEdit} onDelete={onDelete} reveal="always" colored />
        )}
      </span>
    </li>
  );
}

/** "12 Aug" — the year is noise in a list already filtered by month. */
function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}
