"use client";

import * as React from "react";
import { Banknote, Coins, Info, LogOut, Trash2 } from "lucide-react";

import { accountSelectOptions, type AccountWithInstitution } from "@/components/account-options";
import { LedgerRefChip } from "@/components/ledger-ref-chip";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { RichSelect } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatPKR } from "@/lib/format";
import { todayISO } from "@/lib/ledger";
/* No funds check in this file: every movement it writes ARRIVES in an account —
   profit landing, a holding cashed in — and money coming in can never leave an
   account short. The outgoing side lives in `investment-modal.tsx`. */
import {
  closeInvestment,
  deletePayout,
  recordPayout,
  recordValuation,
  updatePayout,
} from "@/lib/investment-actions";
import type { InvestmentStatus, Tables } from "@/lib/supabase/types";

type Holding = Tables<"investments">;

function toPaisa(rupees: string): number {
  const n = parseFloat(rupees);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/* ========================================================================== *
 * Re-value
 * ========================================================================== */

/**
 * "What is it worth now?"
 *
 * For a holding with units the natural question is the PRICE, not the total —
 * nobody knows their 100 shares are worth Rs 26,800, they know MEBL closed at
 * 268. So units-based holdings ask for the price and multiply; everything else
 * asks for the total.
 */
export function ValuationModal({
  isOpen,
  onClose,
  onSaved,
  holding,
  history,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  holding: Holding | null;
  /** Every value recorded for this holding, newest first. */
  history: Tables<"investment_valuations">[];
}) {
  const supabase = createClient();
  const { showToast } = useToast();

  const [asOf, setAsOf] = React.useState(todayISO());
  const [unitPrice, setUnitPrice] = React.useState("");
  const [total, setTotal] = React.useState("");
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const seedKey = `${isOpen}:${holding?.id ?? "none"}`;
  const [seeded, setSeeded] = React.useState(seedKey);
  if (seeded !== seedKey) {
    setSeeded(seedKey);
    setAsOf(todayISO());
    setNote("");
    setUnitPrice("");
    setTotal(holding ? String(Number(holding.current_value_paisa) / 100) : "");
  }

  if (!holding) return null;

  const byUnits = holding.units !== null && Number(holding.units) > 0;
  const computedPaisa = byUnits
    ? Math.round(Number(holding.units) * toPaisa(unitPrice))
    : toPaisa(total);

  const changePaisa = computedPaisa - Number(holding.current_value_paisa);
  const changeFraction =
    Number(holding.current_value_paisa) > 0
      ? changePaisa / Number(holding.current_value_paisa)
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (computedPaisa <= 0) {
      showToast({ type: "error", title: "Enter a value", description: "It has to be worth something." });
      return;
    }

    setSubmitting(true);
    try {
      await recordValuation(supabase, holding, {
        asOf,
        valuePaisa: computedPaisa,
        unitPricePaisa: byUnits ? toPaisa(unitPrice) : null,
        note: note.trim() || null,
      });
      showToast({ type: "success", title: "Value updated", description: `Now worth ${formatPKR(computedPaisa)}.` });
      onSaved();
      onClose();
    } catch (err) {
      showToast({
        type: "error",
        title: "Could not update",
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
      title="Update value"
      subtitle={holding.name}
      icon={<Coins size={18} />}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={submitting}>
            Save value
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {byUnits ? (
          <>
            <Input
              label={`Price per ${holding.unit_label ?? "unit"} today (PKR)`}
              type="number"
              step="any"
              min="0"
              placeholder="268"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              hint={`You hold ${holding.units} ${holding.unit_label ?? "units"}.`}
              required
            />
            {computedPaisa > 0 && (
              <p className="text-muted text-[11.5px]">
                That values the lot at{" "}
                <span className="tnum text-foreground font-semibold">{formatPKR(computedPaisa)}</span>.
              </p>
            )}
          </>
        ) : (
          <Input
            label="What is it worth today? (PKR)"
            type="number"
            step="any"
            min="0"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            required
          />
        )}

        {computedPaisa > 0 && changePaisa !== 0 && (
          <p
            className={`text-[11.5px] font-medium ${changePaisa > 0 ? "text-gain" : "text-loss"}`}
          >
            {changePaisa > 0 ? "Up" : "Down"}{" "}
            <span className="tnum">{formatPKR(Math.abs(changePaisa))}</span>
            {/*
              The magnitude only. `formatPercent` prefixes a "+" on positives,
              so passing an absolute value here printed "Down Rs 500 (+3.2%)" —
              the sign contradicting the word right beside it.
            */}
            {changeFraction !== null && (
              <span className="tnum">
                {" "}
                ({(Math.abs(changeFraction) * 100).toFixed(1)}%)
              </span>
            )}{" "}
            on the last recorded value.
          </p>
        )}

        <DatePicker label="Value as of" value={asOf} onChange={setAsOf} max={todayISO()} required />

        <Input
          label="Note"
          placeholder="e.g. after the July bonus announcement"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {/*
          The history, drawn.
          Keeping every valuation was pointless while nothing ever showed them —
          the whole reason for a dated table rather than one overwritten column
          is to be able to see the shape. A sparkline plus the rows is enough
          here; a full chart belongs on a holding detail page.
        */}
        {history.length > 1 ? (
          <div className="border-border border-t pt-4">
            <p className="text-muted mb-2 text-[11px] font-semibold uppercase tracking-widest">
              How it has moved
            </p>
            <ValueSparkline points={history} />
            <ul className="divide-border border-border mt-3 divide-y rounded-control border">
              {history.slice(0, 5).map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="tnum text-foreground text-[12px] font-medium">
                      {formatPKR(Number(v.value_paisa))}
                    </p>
                    {v.note && <p className="text-faint truncate text-[10.5px]">{v.note}</p>}
                  </div>
                  <span className="text-muted ltr shrink-0 text-[10.5px]">{v.as_of}</span>
                </li>
              ))}
            </ul>
            {history.length > 5 && (
              <p className="text-faint mt-1.5 text-[10.5px]">
                Showing the 5 most recent of {history.length}.
              </p>
            )}
          </div>
        ) : (
          <p className="text-faint text-[11px] leading-relaxed">
            Every value you record is kept with its date, so this holding builds a
            real history rather than one number that keeps being overwritten.
            Saving twice on the same day corrects that day.
          </p>
        )}
      </div>
    </Modal>
  );
}

/**
 * A value line, in plain SVG.
 *
 * `preserveAspectRatio="none"` with a 0–100 viewBox means it stretches to
 * whatever width the modal is without any measuring, and a flat series still
 * draws a centred line rather than dividing by a zero range.
 */
function ValueSparkline({ points }: { points: Tables<"investment_valuations">[] }) {
  // Oldest first, so the line reads left to right like every other chart.
  const series = [...points].sort((a, b) => (a.as_of < b.as_of ? -1 : 1));
  const values = series.map((p) => Number(p.value_paisa));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const d = values
    .map((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * 100;
      const y = 30 - ((v - min) / range) * 26 - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const rising = values[values.length - 1] >= values[0];

  return (
    <svg
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      className="border-border bg-surface-subtle h-16 w-full rounded-control border"
      role="img"
      aria-label={`Value from ${formatPKR(values[0])} to ${formatPKR(values[values.length - 1])}`}
    >
      <path
        d={`${d} L100,30 L0,30 Z`}
        className={rising ? "fill-gain/10" : "fill-loss/10"}
        stroke="none"
      />
      <path
        d={d}
        fill="none"
        className={rising ? "stroke-gain" : "stroke-loss"}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ========================================================================== *
 * Record a payout
 * ========================================================================== */

/**
 * Profit that arrived — recorded, or corrected.
 *
 * The one thing this form must get right is REINVESTED vs RECEIVED. Reinvested
 * money never reaches you, so it writes nothing to the ledger and instead grows
 * the holding. Received money is genuinely new — the only part of an investment
 * that is income — so with the bridge open it lands in an account as income.
 *
 * EDITING ONE PAYMENT IS A REAL MODE HERE. The pencil on a profit row used to
 * open this form blank, against the parent holding: it looked like an edit,
 * behaved like "add another", and a profit typed as 115000 instead of 11500 had
 * no correction path at all. With `payout` set, every field is seeded from that
 * row and saving moves the payment AND the income entry it wrote, together.
 */
export function PayoutModal({
  isOpen,
  onClose,
  onSaved,
  holding,
  accounts,
  syncEnabled,
  payouts,
  payout = null,
  payoutLedgerRow = null,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  holding: Holding | null;
  accounts: AccountWithInstitution[];
  syncEnabled: boolean;
  /** This holding's existing payouts, newest first. */
  payouts: Tables<"investment_payouts">[];
  /** Set to EDIT one payment rather than add a new one. */
  payout?: Tables<"investment_payouts"> | null;
  /** The ledger row that payment wrote, when it wrote one. */
  payoutLedgerRow?: { id: string; date: string; type: string } | null;
}) {
  const supabase = createClient();
  const { showToast } = useToast();

  const [date, setDate] = React.useState(todayISO());
  const [amount, setAmount] = React.useState("");
  const [reinvest, setReinvest] = React.useState(false);
  const [accountId, setAccountId] = React.useState("");
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [removing, setRemoving] = React.useState<string | null>(null);

  const isEdit = Boolean(payout);

  const seedKey = `${isOpen}:${holding?.id ?? "none"}:${payout?.id ?? "new"}`;
  const [seeded, setSeeded] = React.useState(seedKey);
  if (seeded !== seedKey) {
    setSeeded(seedKey);
    if (payout) {
      setDate(payout.date);
      setAmount(String(Number(payout.amount_paisa) / 100));
      setNote(payout.note ?? "");
      setReinvest(payout.destination === "reinvested");
      setAccountId(payout.account_id ?? "");
    } else {
      setDate(todayISO());
      setAmount("");
      setNote("");
      // A fund rolls profit up by default; a certificate pays it out.
      setReinvest(holding?.kind === "mutual_fund");
      setAccountId(holding?.account_id ?? "");
    }
  }

  const removePayout = async (payout: Tables<"investment_payouts">) => {
    if (!holding) return;
    setRemoving(payout.id);
    try {
      await deletePayout(supabase, holding, payout);
      showToast({
        type: "success",
        title: "Payout removed",
        description:
          payout.destination === "reinvested"
            ? "The holding's value has been brought back down by the same amount."
            : "The income entry it created has been removed too.",
      });
      onSaved();
    } catch (err) {
      showToast({
        type: "error",
        title: "Could not remove it",
        description: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setRemoving(null);
    }
  };

  if (!holding) return null;

  // Profit arriving is money coming IN, so a locked account is a valid target —
  // a lock only stops money leaving.
  const accountOptions = accountSelectOptions(accounts, { direction: "income" });

  /*
   * When the account picker exists at all.
   *
   * The household switch decides it for NEW payments. An existing payment that
   * already wrote an entry always shows it, even with syncing off — otherwise
   * turning the switch off would strand a real ledger row with no way to move
   * or detach it, which is the opposite of what "off" is supposed to mean.
   */
  const showAccount = !reinvest && (syncEnabled || Boolean(payout?.transaction_id));
  const resolvedAccountId = reinvest ? null : showAccount ? accountId || null : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountPaisa = toPaisa(amount);

    if (amountPaisa <= 0) {
      showToast({ type: "error", title: "How much came in?", description: "Enter the profit amount." });
      return;
    }
    /*
     * No account is a VALID answer, and it is not asked about again here.
     *
     * The form used to refuse a payment with no account whenever the household
     * switch was on — while showing "No account — just track it" in the very
     * dropdown it was refusing. Profit paid in cash, or into an account nobody
     * is tracking, is an ordinary thing, and the sync icon on the row is there
     * for the day it needs filing.
     */
    setSubmitting(true);
    try {
      const input = {
        date,
        amountPaisa,
        accountId: resolvedAccountId,
        reinvest,
        note: note.trim() || null,
      };

      if (payout) {
        await updatePayout(supabase, holding, payout, input);
      } else {
        await recordPayout(supabase, holding, input);
      }

      showToast({
        type: "success",
        title: payout ? "Payment updated" : reinvest ? "Profit reinvested" : "Profit recorded",
        description: reinvest
          ? "Counted inside what the holding is worth. No account was touched."
          : resolvedAccountId
            ? "Logged as income in that account."
            : "Logged against this holding only.",
      });
      onSaved();
      onClose();
    } catch (err) {
      showToast({
        type: "error",
        title: payout ? "Could not save it" : "Could not record it",
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
      title={payout ? "Edit this payment" : "Record profit"}
      subtitle={holding.name}
      icon={<Banknote size={18} />}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={submitting}>
            {payout ? "Save changes" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="How much? (PKR)"
          type="number"
          step="any"
          min="0"
          placeholder="11500"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />

        <DatePicker label="Received on" value={date} onChange={setDate} max={todayISO()} required />

        <div className="border-border bg-surface-subtle rounded-control flex items-center gap-1 border p-1 text-[11.5px]">
          <button
            type="button"
            onClick={() => setReinvest(false)}
            className={`flex-1 rounded-control px-3 py-1.5 font-medium transition-colors ${
              !reinvest ? "bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900" : "text-muted hover:text-foreground"
            }`}
          >
            Came to me
          </button>
          <button
            type="button"
            onClick={() => setReinvest(true)}
            className={`flex-1 rounded-control px-3 py-1.5 font-medium transition-colors ${
              reinvest ? "bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900" : "text-muted hover:text-foreground"
            }`}
          >
            Reinvested
          </button>
        </div>

        {reinvest ? (
          <p className="border-border bg-surface-subtle text-muted rounded-control flex items-start gap-2 border px-3 py-2.5 text-[11.5px] leading-relaxed">
            <Info size={14} className="text-brass-strong mt-px shrink-0" />
            <span>
              No cash reached you, so nothing is written to your accounts.
              {payout?.transaction_id
                ? " The income entry this payment wrote will be removed and the balance put back."
                : ` The holding is worth ${formatPKR(Number(holding.current_value_paisa) + toPaisa(amount))} after this.`}
            </span>
          </p>
        ) : showAccount ? (
          <>
            <RichSelect
              label="Landed in"
              value={accountId}
              onChange={setAccountId}
              options={[
                {
                  value: "",
                  label: "No account — just track it",
                  description: "Records the profit without moving a balance",
                },
                ...accountOptions,
              ]}
              placeholder="Choose the account…"
              hint={
                payout?.transaction_id
                  ? "Changing this moves the income entry. Clearing it removes the entry and puts the balance back."
                  : "Recorded as income — unlike the money you put in, profit really is new."
              }
            />
            {payoutLedgerRow && (
              <LedgerRefChip
                transactionId={payoutLedgerRow.id}
                date={payoutLedgerRow.date}
                type={payoutLedgerRow.type as "income" | "expense" | "transfer"}
              />
            )}
          </>
        ) : (
          <p className="text-faint text-[11px] leading-relaxed">
            Account syncing is off, so this is recorded against the holding only
            and no bank balance changes.
          </p>
        )}

        <Input
          label="Note"
          placeholder="e.g. August profit, paid two days late"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {/*
          The other payments on this holding, for context.
          Hidden while EDITING one of them: a list of siblings with delete
          buttons, sitting under a form that is already editing a specific row,
          is an invitation to delete the wrong thing.
        */}
        {!isEdit && payouts.length > 0 && (
          <div className="border-border border-t pt-4">
            <p className="text-muted mb-2 text-[11px] font-semibold uppercase tracking-widest">
              Already recorded
            </p>
            <ul className="divide-border border-border divide-y rounded-control border">
              {payouts.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-[12px] font-medium">
                      <span className="tnum">{formatPKR(Number(p.amount_paisa))}</span>
                      <span className="text-muted font-normal">
                        {" "}
                        · {p.destination === "reinvested" ? "reinvested" : "received"}
                      </span>
                    </p>
                    <p className="text-faint ltr text-[10.5px]">{p.date}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void removePayout(p)}
                    disabled={removing === p.id}
                    className="text-muted hover:text-loss shrink-0 rounded-full p-1 transition-colors disabled:opacity-40"
                    aria-label={`Remove the ${formatPKR(Number(p.amount_paisa))} payout dated ${p.date}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
            {payouts.length > 6 && (
              <p className="text-faint mt-1.5 text-[10.5px]">
                Showing the 6 most recent of {payouts.length}.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ========================================================================== *
 * Close it out
 * ========================================================================== */

export function CloseInvestmentModal({
  isOpen,
  onClose,
  onSaved,
  holding,
  accounts,
  syncEnabled,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  holding: Holding | null;
  accounts: AccountWithInstitution[];
  syncEnabled: boolean;
}) {
  const supabase = createClient();
  const { showToast } = useToast();

  const [status, setStatus] = React.useState<Extract<InvestmentStatus, "sold" | "closed">>("sold");
  const [exitDate, setExitDate] = React.useState(todayISO());
  const [exitValue, setExitValue] = React.useState("");
  const [accountId, setAccountId] = React.useState("");
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const seedKey = `${isOpen}:${holding?.id ?? "none"}`;
  const [seeded, setSeeded] = React.useState(seedKey);
  if (seeded !== seedKey) {
    setSeeded(seedKey);
    setStatus("sold");
    setExitDate(todayISO());
    setExitValue(holding ? String(Number(holding.current_value_paisa) / 100) : "");
    setAccountId(holding?.account_id ?? "");
    setNote("");
  }

  if (!holding) return null;

  const exitPaisa = toPaisa(exitValue);
  const gainPaisa = exitPaisa - Number(holding.principal_paisa);
  const accountOptions = accountSelectOptions(accounts, { direction: "income" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (exitPaisa < 0) {
      showToast({ type: "error", title: "Check the amount", description: "It cannot be negative." });
      return;
    }
    // No account is a valid answer here too — a plot sold for cash, or into an
    // account nobody is tracking. Refusing it while offering it in the dropdown
    // is the contradiction this used to ship.
    setSubmitting(true);
    try {
      await closeInvestment(supabase, holding, {
        status,
        exitDate,
        exitValuePaisa: exitPaisa,
        accountId: syncEnabled ? accountId || null : null,
        note: note.trim() || null,
      });
      showToast({
        type: "success",
        title: "Holding closed",
        description:
          gainPaisa >= 0
            ? `Came out ${formatPKR(gainPaisa)} ahead of what you put in.`
            : `Came out ${formatPKR(Math.abs(gainPaisa))} short of what you put in.`,
      });
      onSaved();
      onClose();
    } catch (err) {
      showToast({
        type: "error",
        title: "Could not close it",
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
      title="Cash it in"
      subtitle={holding.name}
      icon={<LogOut size={18} />}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={submitting}>
            Close holding
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <RichSelect
          label="What happened to it?"
          value={status}
          onChange={(v) => setStatus(v as "sold" | "closed")}
          options={[
            { value: "sold", label: "Sold it", description: "Shares, gold, a plot — passed to someone else" },
            { value: "closed", label: "Withdrew it", description: "A certificate encashed or a deposit matured" },
          ]}
        />

        <Input
          label="How much came back? (PKR)"
          type="number"
          step="any"
          min="0"
          value={exitValue}
          onChange={(e) => setExitValue(e.target.value)}
          hint={`You put in ${formatPKR(Number(holding.principal_paisa))}.`}
          required
        />

        {exitPaisa > 0 && (
          <p className={`text-[11.5px] font-medium ${gainPaisa >= 0 ? "text-gain" : "text-loss"}`}>
            {gainPaisa >= 0 ? "A gain of " : "A loss of "}
            <span className="tnum">{formatPKR(Math.abs(gainPaisa))}</span> on what you
            put in. Any profit already paid out is counted on top of this.
          </p>
        )}

        <DatePicker
          label="On"
          value={exitDate}
          onChange={setExitDate}
          min={holding.purchase_date}
          max={todayISO()}
          required
        />

        {syncEnabled ? (
          <RichSelect
            label="Money landed in"
            value={accountId}
            onChange={setAccountId}
            options={[
              {
                value: "",
                label: "No account — just track it",
                description: "Sold for cash, or into an account you do not track here",
              },
              ...accountOptions,
            ]}
            placeholder="Choose the account…"
            hint="Recorded as savings coming back, not as income — this money was always yours."
          />
        ) : (
          <p className="text-faint text-[11px] leading-relaxed">
            Account syncing is off, so no account balance changes. The holding just
            moves out of your active list.
          </p>
        )}

        <Input
          label="Note"
          placeholder="e.g. sold to fund the shop expansion"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </Modal>
  );
}

/*
 * `LinkHoldingModal` used to live here.
 *
 * It has been replaced by the shared `LinkToAccountModal`, which Udhaar and
 * Investments both use. Three reasons the shared one is better than the copy it
 * replaced: it checks whether the account can actually afford the movement
 * (this one did not, so a Rs 20,00,000 holding could be charged to an account
 * holding Rs 500), it shows the amount and the date as facts rather than
 * describing them in a paragraph of warning prose, and there is now one place
 * where that dialog can be got wrong instead of three.
 */
