"use client";

import Link from "next/link";
import { ArrowUpRight, Link2, Unlink } from "lucide-react";

import { ledgerRefFor } from "@/lib/module-ledger";
import type { TransactionType } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * "This record also exists in your ledger — here it is."
 *
 * Every satellite module (Investments, Udhaar, Committee) writes at most one row
 * into `transactions` per record, and until now the only place that link was
 * ever named was the delete dialog. You could learn a holding had charged an
 * account only by trying to remove it. This chip puts the same fact on the card,
 * as a link you can follow to the actual row and check it.
 *
 * It deliberately says WHICH SCREEN rather than "linked": Entries and
 * Transactions are two filtered views of one table, and a one-legged transfer —
 * every loan, every holding's funding leg — only ever appears on Transactions.
 * Promising "Entries" and landing on a page that cannot contain the row is worse
 * than saying nothing.
 */
export function LedgerRefChip({
  transactionId,
  date,
  type = "expense",
  label,
  className,
}: {
  transactionId: string;
  /** The ledger row's own date. Carries the month, which the deep link needs. */
  date: string;
  type?: TransactionType;
  /** Override the chip text. The default names the destination screen. */
  label?: string;
  className?: string;
}) {
  const ref = ledgerRefFor(transactionId, date, type);

  return (
    <Link
      href={ref.href}
      title={ref.title}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "border-brass/25 bg-brass/8 text-brass-strong hover:bg-brass/16 inline-flex max-w-full items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none transition-colors",
        className,
      )}
    >
      <Link2 size={9} className="shrink-0" />
      <span className="truncate">{label ?? ref.label}</span>
      <ArrowUpRight size={9} className="shrink-0 opacity-70" />
    </Link>
  );
}

/**
 * The opposite state: a record that never touched an account.
 *
 * Rendered as a BUTTON, not a label, when something can be done about it —
 * clicking asks which account and writes the row. Silent when the household has
 * the bridge shut, because then "not in your accounts" is the intended state and
 * flagging it would nag about a decision already made.
 */
export function LedgerSyncChip({
  onClick,
  label = "Not in your accounts",
  className,
}: {
  onClick?: () => void;
  label?: string;
  className?: string;
}) {
  const classes = cn(
    "border-border bg-surface-subtle text-muted inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none",
    onClick && "hover:border-brass/40 hover:text-brass-strong cursor-pointer transition-colors",
    className,
  );

  if (!onClick) {
    return (
      <span className={classes}>
        <Unlink size={9} className="shrink-0" />
        {label}
      </span>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      <Unlink size={9} className="shrink-0" />
      {label}
    </button>
  );
}
