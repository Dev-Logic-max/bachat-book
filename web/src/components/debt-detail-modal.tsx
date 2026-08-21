"use client";

import * as React from "react";
import { History, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { RowActions } from "@/components/ui/row-actions";
import {
  DIRECTION_LABEL,
  debtKind,
  outstandingPaisa,
  overpaidByPaisa,
  repaidFraction,
  repaidPaisa,
  type DebtPayment,
  type DebtWithPayments,
} from "@/lib/debts";
import { formatPKR } from "@/lib/format";

/**
 * The full history for one debt.
 *
 * The payment list used to sit INSIDE the card, which worked for two payments
 * and fell apart at ten — a khata settled in small amounts turns every card into
 * a scroll and buries the one figure the card exists to show. The card now
 * carries the summary and a button; everything per-payment happens here.
 */
export function DebtDetailModal({
  isOpen,
  onClose,
  debt,
  readOnly,
  onAddPayment,
  onEditPayment,
  onDeletePayment,
}: {
  isOpen: boolean;
  onClose: () => void;
  debt: DebtWithPayments | null;
  readOnly: boolean;
  onAddPayment: () => void;
  onEditPayment: (payment: DebtPayment) => void;
  onDeletePayment: (payment: DebtPayment) => void;
}) {
  if (!debt) return null;

  const kind = debtKind(debt.kind);
  const outstanding = outstandingPaisa(debt);
  const repaid = repaidPaisa(debt);
  const overpaid = overpaidByPaisa(debt);
  const fraction = repaidFraction(debt);
  const isIncoming = debt.direction === "owed_to_us";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={debt.counterparty_name}
      subtitle={`${DIRECTION_LABEL[debt.direction]} · ${kind.label}`}
      icon={<History size={18} />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
          {!readOnly && debt.status === "open" && (
            <Button type="button" variant="primary" onClick={onAddPayment}>
              <Plus size={14} />
              Record payment
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {/* ---- The position ------------------------------------------------ */}
        <div className="border-border bg-surface-subtle rounded-control grid grid-cols-3 gap-2 border p-3">
          <Figure label="Original" value={formatPKR(Number(debt.principal_paisa))} />
          <Figure label="Repaid" value={formatPKR(repaid)} tone="gain" />
          <Figure
            label={isIncoming ? "Still owed" : "Still to pay"}
            value={formatPKR(outstanding)}
            tone={outstanding > 0 ? "loss" : "muted"}
          />
        </div>

        <div>
          <div className="bg-surface-3 h-1.5 w-full overflow-hidden rounded-full">
            <div
              className={`h-full rounded-full ${outstanding === 0 ? "bg-gain" : "bg-brass"}`}
              style={{ width: `${Math.round(fraction * 100)}%` }}
            />
          </div>
          {overpaid > 0 && (
            <p className="text-brass-strong mt-1 text-[11px]">
              <span className="tnum">{formatPKR(overpaid)}</span> more than owed — recorded
              as given.
            </p>
          )}
        </div>

        {/* ---- When it started --------------------------------------------- */}
        <dl className="border-border divide-border divide-y rounded-control border text-[11.5px]">
          <Row
            label={isIncoming ? "Lent on" : "Borrowed on"}
            value={<span className="ltr">{debt.created_at.slice(0, 10)}</span>}
          />
          {debt.due_date && (
            <Row label="Due" value={<span className="ltr">{debt.due_date}</span>} />
          )}
          <Row
            label="Touched an account"
            value={debt.opening_transaction_id ? "Yes — the balance moved" : "No — tracked only"}
          />
          {debt.note && <Row label="Note" value={debt.note} />}
        </dl>

        {/* ---- Every payment ------------------------------------------------ */}
        <div>
          <p className="text-muted mb-1.5 text-[10px] font-semibold uppercase tracking-widest">
            {debt.payments.length === 0
              ? "No payments yet"
              : `${debt.payments.length} ${debt.payments.length === 1 ? "payment" : "payments"}`}
          </p>

          {debt.payments.length === 0 ? (
            <p className="border-border text-muted rounded-control border border-dashed p-4 text-center text-[11.5px]">
              {isIncoming
                ? "Nothing has come back yet."
                : "You have not paid any of this back yet."}
            </p>
          ) : (
            <ul className="border-border divide-border divide-y rounded-control border">
              {debt.payments.map((payment) => (
                <li
                  key={payment.id}
                  className="group hover:bg-surface-subtle focus-within:bg-surface-subtle flex items-center justify-between gap-2 px-3 py-2 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="tnum text-foreground text-[12.5px] font-semibold">
                      {formatPKR(Number(payment.amount_paisa))}
                    </p>
                    <p className="text-faint truncate text-[10.5px]">
                      <span className="ltr">{payment.date}</span>
                      {payment.note && ` · ${payment.note}`}
                      {!payment.transaction_id && " · not linked to an account"}
                    </p>
                  </div>
                  {!readOnly && (
                    <RowActions
                      onEdit={() => onEditPayment(payment)}
                      onDelete={() => onDeletePayment(payment)}
                      editLabel="Edit this payment"
                      deleteLabel="Remove this payment"
                      reveal="hover"
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Figure({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "gain" | "loss" | "muted";
}) {
  const toneClass =
    tone === "gain"
      ? "text-gain"
      : tone === "loss"
        ? "text-loss"
        : tone === "muted"
          ? "text-muted"
          : "text-foreground";
  return (
    <div className="min-w-0">
      <p className="text-muted text-[10px] font-semibold uppercase tracking-widest">{label}</p>
      <p className={`tnum mt-0.5 truncate text-[13.5px] font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2">
      <dt className="text-muted shrink-0">{label}</dt>
      <dd className="text-foreground-2 min-w-0 truncate text-end">{value}</dd>
    </div>
  );
}
