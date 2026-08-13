"use client";

import * as React from "react";
import { AlertTriangle, Link2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { formatPKR } from "@/lib/format";

export interface LinkedRef {
  /** What kind of thing this is — "Transaction", "Task", "Calendar event". */
  kind: string;
  /** Human name, e.g. "UBL Current · Rs 4,000". */
  label: string;
}

export interface BalanceImpact {
  accountName: string;
  fromPaisa: number;
  toPaisa: number;
}

/**
 * The single delete confirmation for the whole app. Owner-decided behaviour:
 *
 *  - Always shown, linked or not. Nothing is ever deleted on one click.
 *  - Names the record being deleted, with amount and date.
 *  - Lists EVERY linked record by kind and name.
 *  - Unchecking means: unlink first, THEN delete only this record. Order matters,
 *    and `onConfirm` receives the choice so the caller can sequence it.
 *  - Because the default path can move a real bank balance, the consequence is
 *    stated in words rather than left for the user to infer.
 *
 * The checkbox DEFAULT is per call site, not global. Deleting a transfer leg
 * defaults to checked, because one leg alone creates money. Deleting a task that
 * wrote a ledger entry defaults to UNCHECKED, because the money genuinely moved
 * in real life and tidying the to-do list must not quietly un-spend it.
 */
export function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Delete this record?",
  recordLabel,
  recordMeta,
  linkedRefs = [],
  balanceImpact,
  confirmLabel = "Delete",
  defaultCascade = true,
  cascadeLabel,
  cascadeHint,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** `cascade` is the checkbox state: true = delete linked records too. */
  onConfirm: (cascade: boolean) => Promise<void> | void;
  title?: string;
  recordLabel: string;
  recordMeta?: string;
  linkedRefs?: LinkedRef[];
  balanceImpact?: BalanceImpact;
  confirmLabel?: string;
  /** Whether "also delete linked records" starts ticked. */
  defaultCascade?: boolean;
  cascadeLabel?: string;
  /** Replaces the generic explanation under the checkbox when it is UNCHECKED. */
  cascadeHint?: string;
}) {
  const hasLinks = linkedRefs.length > 0;
  const [cascade, setCascade] = React.useState(defaultCascade);
  const [busy, setBusy] = React.useState(false);

  // Reset to this call site's default each time the modal is reopened, rather
  // than carrying the previous record's choice into an unrelated delete.
  const [wasOpen, setWasOpen] = React.useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) setCascade(defaultCascade);
  }

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm(hasLinks ? cascade : false);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const showImpact = balanceImpact && (!hasLinks || cascade);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      icon={<AlertTriangle size={16} />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleConfirm}
            isLoading={busy}
          >
            {hasLinks && cascade ? `${confirmLabel} all` : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* What is being deleted */}
        <div className="bg-surface-subtle border-border rounded-card border p-3.5">
          <p className="text-foreground text-[13px] font-semibold">{recordLabel}</p>
          {recordMeta && (
            <p className="text-muted mt-0.5 text-[11.5px]">{recordMeta}</p>
          )}
        </div>

        {/* Every linked record, named */}
        {hasLinks && (
          <div className="space-y-2">
            <p className="text-foreground-2 text-[12px] font-medium">
              {cascade
                ? "These linked records will be deleted as well:"
                : "These linked records will be kept and unlinked:"}
            </p>
            <ul className="space-y-1.5">
              {linkedRefs.map((ref, i) => (
                <li
                  key={`${ref.kind}-${i}`}
                  className="bg-surface-subtle flex items-center gap-2 rounded-control px-3 py-2"
                >
                  <Link2 size={13} className="text-brass-strong shrink-0" />
                  <span className="text-muted shrink-0 text-[11px] font-medium uppercase tracking-wide">
                    {ref.kind}
                  </span>
                  <span className="text-foreground-2 truncate text-[12px]">
                    {ref.label}
                  </span>
                </li>
              ))}
            </ul>

            <label className="border-border hover:bg-surface-subtle flex cursor-pointer items-start gap-2.5 rounded-control border p-3 transition-colors">
              <input
                type="checkbox"
                checked={cascade}
                onChange={(e) => setCascade(e.target.checked)}
                className="accent-navy-900 dark:accent-brass mt-0.5 size-4 shrink-0 rounded"
              />
              <span className="min-w-0">
                <span className="text-foreground block text-[12.5px] font-medium">
                  {cascadeLabel ??
                    `Also delete the linked ${linkedRefs.length === 1 ? "record" : "records"}`}
                </span>
                <span className="text-muted mt-0.5 block text-[11.5px] leading-snug">
                  {cascade
                    ? "Everything above is removed together."
                    : (cascadeHint ??
                      "Only this record is deleted. The rest are unlinked first and continue on their own.")}
                </span>
              </span>
            </label>
          </div>
        )}

        {/* Money consequence, spelled out */}
        {showImpact && (
          <div className="bg-loss-soft border-loss/20 rounded-card border p-3">
            <p className="text-loss text-[12px] font-semibold">
              This changes a real account balance
            </p>
            <p className="text-foreground-2 mt-1 text-[12px]">
              {balanceImpact.accountName}:{" "}
              <span className="tnum font-mono">
                {formatPKR(balanceImpact.fromPaisa)}
              </span>{" "}
              →{" "}
              <span className="tnum font-mono font-semibold">
                {formatPKR(balanceImpact.toPaisa)}
              </span>
            </p>
          </div>
        )}

        <p className="text-faint text-[11.5px]">This cannot be undone.</p>
      </div>
    </Modal>
  );
}
