"use client";

import * as React from "react";
import { Info, Waypoints } from "lucide-react";

import { accountSelectOptions, type AccountWithInstitution } from "@/components/account-options";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { RichSelect } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { formatPKR } from "@/lib/format";
import { checkFunds } from "@/lib/module-ledger";

/**
 * The one "put this record into my accounts" dialog, for every module.
 *
 * Investments, Udhaar and Committee all have the same gap: a record that was
 * entered before an account existed, or before syncing was switched on, and now
 * needs the ledger row it never got. Three near-identical modals would drift —
 * one of them would forget the funds check, or the date, or the lock rule — so
 * there is one, and each module supplies only the facts it owns.
 *
 * ONE AT A TIME, always. Turning the household's sync switch on never backfills:
 * twelve holdings would swing the balances by lakhs on a single click with
 * nothing on any screen able to explain it. Each record is a decision, taken
 * here, where the amount and the date are visible while it is being taken.
 */
export function LinkToAccountModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle,
  /** What the record is, in one line. Shown above the picker. */
  recordLabel,
  amountPaisa,
  /** The day the money moved. The ledger row is stamped with this, not today. */
  date,
  /** `expense` = money leaving, `income` = money arriving. Drives locks and funds. */
  direction,
  accounts,
  confirmLabel = "Add to my accounts",
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (accountId: string) => Promise<void>;
  title: string;
  subtitle?: string;
  recordLabel: string;
  amountPaisa: number;
  date: string;
  direction: "income" | "expense";
  accounts: AccountWithInstitution[];
  confirmLabel?: string;
}) {
  const { showToast } = useToast();

  const [accountId, setAccountId] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const seedKey = `${isOpen}:${recordLabel}:${amountPaisa}`;
  const [seeded, setSeeded] = React.useState(seedKey);
  if (seeded !== seedKey) {
    setSeeded(seedKey);
    setAccountId("");
  }

  const options = accountSelectOptions(accounts, { direction });
  const selected = accounts.find((a) => a.id === accountId);
  const funds = checkFunds(
    selected,
    direction === "expense" ? -Math.abs(amountPaisa) : Math.abs(amountPaisa),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) {
      showToast({
        type: "error",
        title: "Pick an account",
        description:
          direction === "expense"
            ? "Choose where the money came from."
            : "Choose where the money landed.",
      });
      return;
    }
    if (funds.message) {
      showToast({ type: "error", title: "Not enough in that account", description: funds.message });
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm(accountId);
      onClose();
    } catch (err) {
      showToast({
        type: "error",
        title: "Could not add it",
        description: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={<Waypoints size={18} />}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={submitting}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* The three facts that decide whether this is the right thing to do,
            shown together rather than described in a paragraph. */}
        <div className="border-border bg-surface-subtle rounded-control border px-3 py-2.5">
          <p className="text-foreground truncate text-[12.5px] font-medium">{recordLabel}</p>
          <p className="text-muted mt-0.5 flex items-baseline gap-2 text-[11.5px]">
            <span className="tnum text-foreground-2 font-semibold">
              {direction === "expense" ? "−" : "+"}
              {formatPKR(Math.abs(amountPaisa))}
            </span>
            <span className="ltr">{date}</span>
          </p>
        </div>

        <RichSelect
          label={direction === "expense" ? "Money came from" : "Money landed in"}
          value={accountId}
          onChange={setAccountId}
          options={options}
          searchable={accounts.length >= 8}
          placeholder="Choose the account…"
        />

        {funds.message ? (
          <p className="border-loss/25 bg-loss/8 text-loss rounded-control flex items-start gap-2 border px-3 py-2.5 text-[11.5px] leading-relaxed">
            <Info size={14} className="mt-px shrink-0" />
            <span>{funds.message}</span>
          </p>
        ) : (
          <p className="text-faint text-[11px] leading-relaxed">
            The entry is dated <span className="ltr">{date}</span> — the day the money
            moved, not today. It also becomes the account this record opens on next
            time, and you can still change it per entry.
          </p>
        )}
      </div>
    </Modal>
  );
}
