"use client";

import { ArrowDownRight, ArrowUpRight, CalendarDays, Tag } from "lucide-react";
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
/*
 * At `lg` the content column is genuinely narrow (1024px less a 248px rail), so
 * the fixed tracks below are right there and must not grow.
 *
 * On a wide monitor they are wrong in the other direction: Entry is the only
 * `1fr` track, so it swallows every spare pixel and sits half-empty while
 * Category is pushed to the far right and still truncates "Home & Kitchen
 * Goods". From `2xl` the slack is SHARED — Category becomes a second flexible
 * track — which pulls it left and widens it at the same time.
 */
const ENTRY_COLS =
  "items-center gap-x-3 grid-cols-[36px_minmax(0,1fr)_auto_auto] " +
  "lg:grid-cols-[36px_minmax(0,1fr)_148px_96px_150px_118px_72px] " +
  "2xl:grid-cols-[36px_minmax(0,1fr)_minmax(200px,0.45fr)_96px_170px_130px_72px]";

/**
 * The SAME row, in a narrower container.
 *
 * `EntryRow` is shared by the Entries page and the dashboard panel, and those
 * are very different widths: Entries gets the full content column, the panel
 * gets two thirds of a three-column grid. The fixed tracks above are tuned for
 * the wide one and are correct there — but in the panel they consume almost
 * everything, so the title is squeezed to a few characters while the slack in
 * the right-aligned amount track opens a gap between the account and the
 * figure.
 *
 * Fixing that by editing the shared template broke the page it was already
 * right on. So the panel opts into its own template instead: the two metadata
 * columns give up ~60px, and amount and actions become `max-content` so they
 * size to the widest figure rather than to a guess. Grid tracks are shared down
 * a column, so every row still lines up.
 */
const ENTRY_COLS_DENSE =
  "items-center gap-x-3 grid-cols-[36px_minmax(0,1fr)_auto_auto] " +
  "lg:grid-cols-[32px_minmax(0,1fr)_132px_74px_minmax(96px,128px)_max-content_max-content]";

/**
 * Column headings for the entries table.
 *
 * The header sits on `bg-surface-subtle` rather than the card's own white. A
 * heading row that shares its background with the data below it is just smaller
 * grey text; one tint of separation is what makes the block read as a table and
 * gives the list a top edge to hang from.
 */
export function EntryRowHeader({ dense = false }: { dense?: boolean }) {
  return (
    <li
      className={cn(
        dense ? ENTRY_COLS_DENSE : ENTRY_COLS,
        /*
          A GRADIENT, not a flat tint — the same language as the category card
          heads: deepest at the top edge, fading into the first row, with the
          list's own `divide-y` drawing the rule beneath. A flat block of
          `surface-subtle` sat as a grey slab; the fade gives the table a top
          edge to hang from without adding a second hard line.
          No border-b here: `divide-y` already draws it, and both together
          rendered 2px.
        */
        "bg-linear-to-b from-surface-3 to-surface-subtle text-muted hidden px-5 py-2.5 text-[10px] font-semibold uppercase tracking-widest lg:grid",
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
  dense = false,
}: {
  entry: EntryWithCategory;
  /** Which balance this moved. Always present — every entry names an account. */
  account?: EntryAccountRef | null;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
  /** Narrower tracks, for the dashboard panel rather than the full-width page. */
  dense?: boolean;
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
        dense ? ENTRY_COLS_DENSE : ENTRY_COLS,
        "group hover:bg-surface-subtle/60 relative grid px-5 py-2.5 transition-colors",
        className,
      )}
    >
      {entry.categories ? (
        /*
          The three marks on this row are now one family: the leading chip, the
          category tag's glyph and the account's brand mark used to be 34 / 11 /
          18, which read as three unrelated things competing down the row. The
          leading chip stays the largest — it is the row's anchor — but only by
          a step, and the two inline marks now match each other.
        */
        <CategoryChip
          icon={entry.categories.icon}
          tone={entry.categories.tone}
          size={32}
          iconSize={16}
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
            <CategoryIcon icon={entry.categories.icon} size={13} />
            <span className="truncate">{categoryName}</span>
          </span>
        ) : (
          /*
            The SAME pill shape, not bare text.
            A tagged row's label starts ~27px into the cell (8px padding + a
            13px glyph + the gap); plain text started at 0, so every
            uncategorised row visibly hung left of the column it was in. Giving
            it the same box — dashed and muted, so it still reads as "nothing
            chosen" — lines the column up without pretending it has a category.
          */
          <span className="border-border text-faint inline-flex items-center gap-1.5 rounded-full border border-dashed px-2 py-1 text-[11px] font-medium">
            <Tag size={13} className="opacity-60" />
            Uncategorised
          </span>
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
              size={26}
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
