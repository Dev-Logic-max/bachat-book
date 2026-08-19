"use client";

import * as React from "react";
import { Banknote, Coins, Info, Link2, LogOut, Trash2 } from "lucide-react";

import { accountSelectOptions, type AccountWithInstitution } from "@/components/account-options";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { RichSelect } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatPKR, formatPercent } from "@/lib/format";
import { todayISO } from "@/lib/ledger";
import { investmentKind } from "@/lib/investments";
import {
  closeInvestment,
  deletePayout,
  linkInvestmentToAccount,
  recordPayout,
  recordValuation,
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
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  holding: Holding | null;
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

        <p className="text-faint text-[11px] leading-relaxed">
          Every value you record is kept with its date, so this holding builds a
          real history rather than one number that keeps being overwritten. Saving
          twice on the same day corrects that day.
        </p>
      </div>
    </Modal>
  );
}

/* ========================================================================== *
 * Record a payout
 * ========================================================================== */

/**
 * Profit that arrived.
 *
 * The one thing this form must get right is REINVESTED vs RECEIVED. Reinvested
 * money never reaches you, so it writes nothing to the ledger and instead grows
 * the holding. Received money is genuinely new — the only part of an investment
 * that is income — so with the bridge open it lands in an account as income.
 */
export function PayoutModal({
  isOpen,
  onClose,
  onSaved,
  holding,
  accounts,
  syncEnabled,
  payouts,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  holding: Holding | null;
  accounts: AccountWithInstitution[];
  syncEnabled: boolean;
  /** This holding's existing payouts, newest first. */
  payouts: Tables<"investment_payouts">[];
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

  const seedKey = `${isOpen}:${holding?.id ?? "none"}`;
  const [seeded, setSeeded] = React.useState(seedKey);
  if (seeded !== seedKey) {
    setSeeded(seedKey);
    setDate(todayISO());
    setAmount("");
    setNote("");
    // A fund rolls profit up by default; a certificate pays it out.
    setReinvest(holding?.kind === "mutual_fund");
    setAccountId(holding?.account_id ?? "");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountPaisa = toPaisa(amount);

    if (amountPaisa <= 0) {
      showToast({ type: "error", title: "How much came in?", description: "Enter the profit amount." });
      return;
    }
    if (!reinvest && syncEnabled && !accountId) {
      showToast({
        type: "error",
        title: "Where did it land?",
        description: "Account syncing is on, so name the account it arrived in — or mark it reinvested.",
      });
      return;
    }

    setSubmitting(true);
    try {
      await recordPayout(supabase, holding, {
        date,
        amountPaisa,
        accountId: reinvest ? null : syncEnabled ? accountId || null : null,
        reinvest,
        note: note.trim() || null,
      });
      showToast({
        type: "success",
        title: reinvest ? "Profit reinvested" : "Profit recorded",
        description: reinvest
          ? "Added to what the holding is worth. No account was touched."
          : syncEnabled && accountId
            ? "Logged as income in that account."
            : "Logged against this holding only.",
      });
      onSaved();
      onClose();
    } catch (err) {
      showToast({
        type: "error",
        title: "Could not record it",
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
      title="Record profit"
      subtitle={holding.name}
      icon={<Banknote size={18} />}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={submitting}>
            Save
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
              No cash reached you, so nothing is written to your accounts. The
              holding is worth {formatPKR(Number(holding.current_value_paisa) + toPaisa(amount))} after this.
            </span>
          </p>
        ) : syncEnabled ? (
          <RichSelect
            label="Landed in"
            value={accountId}
            onChange={setAccountId}
            options={accountOptions}
            placeholder="Choose the account…"
            hint="Recorded as income — unlike the money you put in, profit really is new."
          />
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
          Recorded payouts, with a way to undo one.
          Without this there was no correction path at all: a profit typed as
          115000 instead of 11500 was permanent, and it feeds the lifetime return
          on the card and every figure in the profit roll-up.
        */}
        {payouts.length > 0 && (
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
    if (syncEnabled && !accountId) {
      showToast({
        type: "error",
        title: "Where did the money go?",
        description: "Account syncing is on, so name the account it landed in.",
      });
      return;
    }

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
            options={accountOptions}
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

/* ========================================================================== *
 * Attach a standalone holding to an account
 * ========================================================================== */

/**
 * The deliberate, one-at-a-time path for holdings recorded before the bridge was
 * opened. Turning the switch on never does this in bulk — twelve holdings would
 * swing the balances by lakhs on one click with nothing on screen to explain it.
 */
export function LinkHoldingModal({
  isOpen,
  onClose,
  onSaved,
  holding,
  accounts,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  holding: Holding | null;
  accounts: AccountWithInstitution[];
}) {
  const supabase = createClient();
  const { showToast } = useToast();

  const [accountId, setAccountId] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const seedKey = `${isOpen}:${holding?.id ?? "none"}`;
  const [seeded, setSeeded] = React.useState(seedKey);
  if (seeded !== seedKey) {
    setSeeded(seedKey);
    setAccountId("");
  }

  if (!holding) return null;

  const accountOptions = accountSelectOptions(accounts, { direction: "expense" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) {
      showToast({ type: "error", title: "Pick an account", description: "Choose where the money came from." });
      return;
    }

    setSubmitting(true);
    try {
      await linkInvestmentToAccount(supabase, holding, accountId);
      showToast({
        type: "success",
        title: "Linked",
        description: `${formatPKR(Number(holding.principal_paisa))} taken out of that account.`,
      });
      onSaved();
      onClose();
    } catch (err) {
      showToast({
        type: "error",
        title: "Could not link it",
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
      title="Link to an account"
      subtitle={holding.name}
      icon={<Link2 size={18} />}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={submitting}>
            Link and deduct
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-muted text-[12px] leading-relaxed">
          This holding was recorded on its own, so no account was ever charged for
          it. Linking it now takes{" "}
          <span className="tnum text-foreground font-semibold">
            {formatPKR(Number(holding.principal_paisa))}
          </span>{" "}
          out of the account you choose, dated{" "}
          <span className="ltr">{holding.purchase_date}</span> — the day you bought
          it, not today.
        </p>

        <RichSelect
          label="Money came from"
          value={accountId}
          onChange={setAccountId}
          options={accountOptions}
          placeholder="Choose the account…"
        />

        <p className="text-faint text-[11px] leading-relaxed">
          Only do this if that account really did pay for it. For{" "}
          {investmentKind(holding.kind).label.toLowerCase()} you already owned
          before using Bachat Book, leave it unlinked.
        </p>
      </div>
    </Modal>
  );
}
