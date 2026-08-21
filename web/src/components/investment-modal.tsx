"use client";

import * as React from "react";
import { Info, TrendingUp } from "lucide-react";

import { accountSelectOptions, type AccountWithInstitution } from "@/components/account-options";
import { MerchantMark } from "@/components/merchant-mark";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { RichSelect, type SelectOption } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatPKR } from "@/lib/format";
import { institutionLogo, todayISO } from "@/lib/ledger";
import { INVESTMENT_KINDS, PAYOUT_FREQUENCIES, investmentKind } from "@/lib/investments";
import { createInvestment, updateInvestment } from "@/lib/investment-actions";
import { checkFunds } from "@/lib/module-ledger";
import type { InvestmentKind, PayoutFrequency, Tables } from "@/lib/supabase/types";

/** Sentinel for "this holding was never paid for out of a tracked account". */
const NO_ACCOUNT = "__none__";

/* -------------------------------------------------------------------------- *
 * Rupee <-> paisa at the form boundary
 *
 * Money is bigint paisa everywhere behind this line. `Math.round` rather than a
 * truncation, so 1234.565 rupees does not silently lose a paisa.
 * -------------------------------------------------------------------------- */
function toPaisa(rupees: string): number {
  const n = parseFloat(rupees);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
function toRupees(paisa: number | null | undefined): string {
  return paisa === null || paisa === undefined ? "" : String(Number(paisa) / 100);
}

/** Which way the form collects the amount. */
type AmountMode = "units" | "total";

export function InvestmentModal({
  isOpen,
  onClose,
  onSaved,
  householdId,
  holding,
  accounts,
  institutions,
  /** Whether the ledger bridge is open. Decides if "Paid from" exists at all. */
  syncEnabled,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  householdId: string;
  /** Null for a new holding. */
  holding: Tables<"investments"> | null;
  accounts: AccountWithInstitution[];
  institutions: Tables<"institutions">[];
  syncEnabled: boolean;
}) {
  const supabase = createClient();
  const { showToast } = useToast();
  const isEdit = Boolean(holding);

  const [kind, setKind] = React.useState<InvestmentKind>("nss");
  const [name, setName] = React.useState("");
  const [institutionId, setInstitutionId] = React.useState("");
  const [purchaseDate, setPurchaseDate] = React.useState(todayISO());
  const [expectedExitDate, setExpectedExitDate] = React.useState("");
  const [expectedReturnPct, setExpectedReturnPct] = React.useState("");
  const [payoutFrequency, setPayoutFrequency] = React.useState<PayoutFrequency>("on_maturity");

  const [amountMode, setAmountMode] = React.useState<AmountMode>("total");
  const [units, setUnits] = React.useState("");
  const [unitLabel, setUnitLabel] = React.useState("");
  const [unitCost, setUnitCost] = React.useState("");
  const [totalCost, setTotalCost] = React.useState("");
  const [valueToday, setValueToday] = React.useState("");

  const [accountId, setAccountId] = React.useState("");
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const kindDef = investmentKind(kind);

  /*
   * Seeding the form from the row being edited.
   *
   * Keyed on the holding's id (and the open flag) rather than run on every
   * render, because these are plain setState calls: React Compiler rejects a
   * synchronous setState in useEffect, and this is the sanctioned escape — a
   * render-phase reset guarded by a "have I already done this" ref-free check
   * using state itself. `seededFor` IS state, so the comparison is a pure
   * render-time decision and no effect is involved.
   */
  const [seededFor, setSeededFor] = React.useState<string | null>(null);
  const seedKey = isOpen ? (holding?.id ?? "new") : null;

  if (seedKey !== null && seedKey !== seededFor) {
    setSeededFor(seedKey);

    if (holding) {
      setKind(holding.kind);
      setName(holding.name);
      setInstitutionId(holding.institution_id ?? "");
      setPurchaseDate(holding.purchase_date);
      setExpectedExitDate(holding.expected_exit_date ?? "");
      setExpectedReturnPct(holding.expected_return_pct === null ? "" : String(holding.expected_return_pct));
      setPayoutFrequency(holding.payout_frequency);
      setAmountMode(holding.units !== null ? "units" : "total");
      setUnits(holding.units === null ? "" : String(holding.units));
      setUnitLabel(holding.unit_label ?? "");
      setUnitCost(toRupees(holding.unit_cost_paisa));
      setTotalCost(toRupees(holding.principal_paisa));
      setValueToday(toRupees(holding.current_value_paisa));
      setAccountId(holding.account_id ?? NO_ACCOUNT);
      setNote(holding.note ?? "");
    } else {
      setKind("nss");
      setName("");
      setInstitutionId("");
      setPurchaseDate(todayISO());
      setExpectedExitDate("");
      setExpectedReturnPct("");
      setPayoutFrequency("on_maturity");
      setAmountMode("total");
      setUnits("");
      setUnitLabel("");
      setUnitCost("");
      setTotalCost("");
      setValueToday("");
      setAccountId(NO_ACCOUNT);
      setNote("");
    }
  }

  /** Picking a kind carries its unit convention with it — tola, shares, units. */
  const pickKind = (next: InvestmentKind) => {
    const def = investmentKind(next);
    setKind(next);
    setAmountMode(def.hasUnits ? "units" : "total");
    setUnitLabel(def.unitLabel ?? "");
  };

  /*
   * What was put in. Units × price when the holding has units, otherwise the
   * typed total. One derived value with one source, so the two entry modes can
   * never both claim to be the principal.
   */
  const principalPaisa =
    amountMode === "units"
      ? Math.round((parseFloat(units) || 0) * toPaisa(unitCost))
      : toPaisa(totalCost);

  // "What is it worth today" defaults to what was paid — true the day you buy
  // it, and the field exists for the other case: gold you have owned for years.
  const currentValuePaisa = valueToday.trim() === "" ? principalPaisa : toPaisa(valueToday);

  const kindOptions: SelectOption[] = INVESTMENT_KINDS.map((k) => ({
    value: k.key,
    label: k.label,
    secondaryLabel: k.labelUr,
    description: k.hint,
  }));

  const institutionOptions: SelectOption[] = [
    { value: "", label: "Not through an institution", description: "A private deal, a plot, cash gold" },
    ...institutions
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((inst) => ({
        value: inst.id,
        label: inst.name,
        description: inst.short_name,
        icon: (
          <MerchantMark
            name={inst.short_name || inst.name}
            brand={inst.brand_color}
            logo={institutionLogo(inst.logo_path) ?? undefined}
            awaitingLogo={!inst.logo_path}
            size={22}
          />
        ),
      })),
  ];

  // A locked account may be paid INTO but never out of, and the money for a
  // holding goes OUT. So the picker is built with the expense direction.
  const accountOptions = accountSelectOptions(accounts, { direction: "expense" });
  const usableAccounts = accountOptions.filter((o) => !o.disabled);

  const resolvedAccountId = accountId === NO_ACCOUNT ? null : accountId || null;

  /*
   * Can the account afford it?
   *
   * The gap this closes, in the owner's words: "if the amount of 2000000 is not
   * present in accounts, how would it get deducted from there". It could not,
   * and nothing said so — the holding saved, the balance went deeply negative,
   * and every figure built on that account was wrong from then on.
   *
   * On an EDIT the account already carries the old funding leg, so what is being
   * asked for is the DIFFERENCE. Treating a Rs 20,00,000 holding whose name is
   * being corrected as a fresh Rs 20,00,000 charge would refuse the edit.
   */
  const selectedAccount = accounts.find((a) => a.id === resolvedAccountId);
  const alreadyCharged =
    Boolean(holding?.funding_transaction_id) && holding?.account_id === resolvedAccountId;
  const funds = checkFunds(
    selectedAccount,
    -principalPaisa,
    alreadyCharged ? -Number(holding?.principal_paisa ?? 0) : 0,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast({ type: "error", title: "Give it a name", description: "Something you will recognise in a list." });
      return;
    }
    if (principalPaisa <= 0) {
      showToast({ type: "error", title: "How much went in?", description: "Enter what you paid for it." });
      return;
    }
    if (funds.message) {
      showToast({ type: "error", title: "Not enough in that account", description: funds.message });
      return;
    }

    setSubmitting(true);
    try {
      const shared = {
        name: name.trim(),
        kind,
        institutionId: institutionId || null,
        purchaseDate,
        expectedExitDate: expectedExitDate || null,
        expectedReturnPct: expectedReturnPct.trim() === "" ? null : parseFloat(expectedReturnPct),
        payoutFrequency,
        principalPaisa,
        units: amountMode === "units" && units.trim() !== "" ? parseFloat(units) : null,
        unitLabel: amountMode === "units" && units.trim() !== "" ? unitLabel.trim() || "units" : null,
        unitCostPaisa: amountMode === "units" && unitCost.trim() !== "" ? toPaisa(unitCost) : null,
        note: note.trim() || null,
        // With the bridge shut the picker is not shown at all, so whatever the
        // holding already points at is kept rather than silently cleared.
        accountId: syncEnabled ? resolvedAccountId : (holding?.account_id ?? null),
      };

      if (holding) {
        await updateInvestment(supabase, holding, shared);
      } else {
        await createInvestment(supabase, { householdId, currentValuePaisa, ...shared });
      }

      showToast({
        type: "success",
        title: holding ? "Holding updated" : "Holding added",
        description: syncEnabled && shared.accountId
          ? "The money has been taken out of that account."
          : "Kept in Investments only — no account was touched.",
      });
      onSaved();
      onClose();
    } catch (err) {
      showToast({
        type: "error",
        title: "Could not save",
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
      title={isEdit ? "Edit holding" : "Add a holding"}
      subtitle={
        isEdit
          ? "Changing what went in also moves the linked account entry, if there is one."
          : "Anything you own that is not sitting in a bank account."
      }
      icon={<TrendingUp size={18} />}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={submitting}>
            {isEdit ? "Save changes" : "Add holding"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <RichSelect
          label="What is it?"
          value={kind}
          onChange={(v) => pickKind(v as InvestmentKind)}
          options={kindOptions}
          searchable
        />

        <Input
          label="Name it"
          placeholder={
            kind === "property"
              ? "e.g. Bahria Town plot, 240-C"
              : kind === "business"
                ? "e.g. 30% of Rehman Cement"
                : "e.g. Behbood Certificate 2024"
          }
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint={kindDef.hint}
          required
        />

        {/* ---- What went in --------------------------------------------- */}
        {kindDef.hasUnits && (
          <div className="border-border bg-surface-subtle rounded-control flex items-center gap-1 border p-1 text-[11.5px]">
            {(["units", "total"] as AmountMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setAmountMode(mode)}
                className={`flex-1 rounded-control px-3 py-1.5 font-medium transition-colors ${
                  amountMode === mode
                    ? "bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {mode === "units" ? `By ${kindDef.unitLabel ?? "units"}` : "Total amount"}
              </button>
            ))}
          </div>
        )}

        {amountMode === "units" ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={`How many ${unitLabel || kindDef.unitLabel || "units"}?`}
                type="number"
                step="any"
                min="0"
                placeholder="100"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
              />
              <Input
                label="Price each (PKR)"
                type="number"
                step="any"
                min="0"
                placeholder="240"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
              />
            </div>

            {principalPaisa > 0 && (
              <p className="text-muted text-[11.5px]">
                That comes to <span className="tnum text-foreground font-semibold">{formatPKR(principalPaisa)}</span>.
              </p>
            )}
          </>
        ) : (
          <Input
            label="How much went in? (PKR)"
            type="number"
            step="any"
            min="0"
            placeholder="2000000"
            value={totalCost}
            onChange={(e) => setTotalCost(e.target.value)}
            required
          />
        )}

        {!isEdit && (
          <Input
            label="What is it worth today? (PKR)"
            type="number"
            step="any"
            min="0"
            placeholder={principalPaisa > 0 ? String(principalPaisa / 100) : "Same as what you paid"}
            value={valueToday}
            onChange={(e) => setValueToday(e.target.value)}
            hint="Leave empty if you just bought it. Fill it in for gold or a plot you have held for years."
          />
        )}

        {/* ---- Dates and return ------------------------------------------ */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DatePicker label="Bought on" value={purchaseDate} onChange={setPurchaseDate} max={todayISO()} required />
          <DatePicker
            label="Expected back on"
            value={expectedExitDate}
            onChange={setExpectedExitDate}
            min={purchaseDate}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Expected return (% a year)"
            type="number"
            step="any"
            placeholder="13.8"
            value={expectedReturnPct}
            onChange={(e) => setExpectedReturnPct(e.target.value)}
            hint="A projection only. Nothing is added to your money from this."
          />
          <RichSelect
            label="Pays profit"
            value={payoutFrequency}
            onChange={(v) => setPayoutFrequency(v as PayoutFrequency)}
            options={PAYOUT_FREQUENCIES.map((f) => ({ value: f.key, label: f.label }))}
          />
        </div>

        <RichSelect
          label="Where is it held?"
          value={institutionId}
          onChange={setInstitutionId}
          options={institutionOptions}
          searchable
        />

        {/* ---- The ledger bridge ------------------------------------------ */}
        {syncEnabled ? (
          usableAccounts.length === 0 ? (
            <p className="border-loss/25 bg-loss/8 text-loss rounded-control border px-3 py-2.5 text-[11.5px] leading-relaxed">
              Account syncing is on, but you have no account this money could come
              out of. Add one first, or turn syncing off in Settings to record the
              holding on its own.
            </p>
          ) : (
            <>
              {/*
                NOT REQUIRED, even with syncing on.

                It used to be, which made the gold your mother has owned for
                thirty years unrecordable: the form demanded an account for money
                that never came out of one, and the only way round it was to
                switch a household-wide setting off and back on. "No account" is
                a real answer, and the sync icon on the card is there for the day
                it stops being the right one.
              */}
              <RichSelect
                label="Paid from"
                value={accountId}
                onChange={setAccountId}
                options={[
                  {
                    value: NO_ACCOUNT,
                    label: "No account — just track it",
                    description: "Gold, a plot or shares you already owned before using the app",
                  },
                  ...accountOptions,
                ]}
                placeholder="Choose the account…"
                hint={
                  resolvedAccountId
                    ? "This much comes out of that account, and it becomes the account this holding's profit and cash-in open on. It is recorded as savings moving, never as spending."
                    : "Nothing is taken out of any account. You can add it to one later from the card."
                }
              />
              {funds.message && (
                <p className="border-loss/25 bg-loss/8 text-loss rounded-control flex items-start gap-2 border px-3 py-2.5 text-[11.5px] leading-relaxed">
                  <Info size={14} className="mt-px shrink-0" />
                  <span>{funds.message}</span>
                </p>
              )}
            </>
          )
        ) : (
          <p className="border-border bg-surface-subtle text-muted rounded-control flex items-start gap-2 border px-3 py-2.5 text-[11.5px] leading-relaxed">
            <Info size={14} className="text-brass-strong mt-px shrink-0" />
            <span>
              Investments are kept separate from your accounts, so nothing here
              changes a bank balance. Turn on{" "}
              <span className="text-foreground font-medium">
                Settings → Preferences → Sync Wealth to my ledger
              </span>{" "}
              if you want holdings to come out of a real account.
            </span>
          </p>
        )}

        <Input
          label="Note"
          placeholder="e.g. In Abbu's name, certificate no. 4471"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </Modal>
  );
}
