"use client";

import * as React from "react";
import { Check, Tag } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPKR } from "@/lib/format";

import type { ChecklistItem } from "@/lib/tasks";

/**
 * What one item on the list cost.
 *
 * ONE FIELD, deliberately. A subtask price is a reference figure and nothing
 * else — it never reaches the ledger on its own, so asking which account it came
 * from or what category it belongs to would be asking three times for answers
 * that already live on the parent task. There is exactly one ledger row per
 * task, written when the task itself is completed, and these are what it adds up
 * from.
 *
 * Skipping is a first-class outcome. Half a trolley gets priced and half does
 * not, and a dialog you cannot leave without a number is a dialog people stop
 * ticking subtasks to avoid.
 */
export function SubtaskPriceModal({
  isOpen,
  onClose,
  onConfirm,
  item,
  /** Sum of the other priced subtasks — so the running total is visible here. */
  otherTotalPaisa,
  busy = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** `null` = ticked without a price. */
  onConfirm: (amountPaisa: number | null) => Promise<void> | void;
  item: ChecklistItem | null;
  otherTotalPaisa: number;
  busy?: boolean;
}) {
  const [amount, setAmount] = React.useState("");

  // Re-seed per item. The component stays mounted between openings, so a state
  // initialiser cannot do this and React Compiler rejects a setState in an effect.
  const seedKey = `${isOpen}:${item?.id ?? "none"}`;
  const [seeded, setSeeded] = React.useState(seedKey);
  if (seeded !== seedKey) {
    setSeeded(seedKey);
    if (isOpen) {
      setAmount(item?.amount_paisa ? String(Number(item.amount_paisa) / 100) : "");
    }
  }

  if (!item) return null;

  const paisa = Math.round((parseFloat(amount) || 0) * 100);
  const runningTotal = otherTotalPaisa + paisa;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="What did it cost?"
      subtitle={item.title}
      icon={<Tag size={16} />}
      onSubmit={async (e) => {
        e.preventDefault();
        await onConfirm(paisa > 0 ? paisa : null);
      }}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => onConfirm(null)}>
            Skip
          </Button>
          <Button type="submit" variant="primary" isLoading={busy}>
            <Check size={14} />
            {paisa > 0 ? `Tick · ${formatPKR(paisa)}` : "Tick it off"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input
          label="Price (PKR)"
          type="number"
          step="any"
          min="0"
          inputMode="decimal"
          placeholder="e.g. 230"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="tnum"
          autoFocus
        />

        {otherTotalPaisa > 0 && (
          <p className="bg-surface-subtle text-foreground-2 rounded-control px-3 py-2 text-[11.5px]">
            Running total{" "}
            <span className="tnum text-foreground font-semibold">
              {formatPKR(runningTotal)}
            </span>
          </p>
        )}

        <p className="text-faint text-[11px] italic leading-snug">
          Just a reference figure for this item. Nothing is written to your
          ledger until you complete the whole task — and the amount there starts
          at whatever these add up to, still yours to correct.
        </p>
      </div>
    </Modal>
  );
}
