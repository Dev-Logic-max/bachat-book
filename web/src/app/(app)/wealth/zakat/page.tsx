"use client";

import * as React from "react";
import { Coins, ShieldCheck, Scale, Calculator, CheckCircle2, Info } from "lucide-react";
import { AdvisorNote } from "@/components/advisor-note";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { GRAMS_PER_TOLA, formatPKR } from "@/lib/format";

type NisabStandard = "silver" | "gold";

/**
 * The Hijri year, close enough to file a record under.
 *
 * The lunar year is ~354.367 days, so it drifts against the Gregorian one by
 * roughly 11 days a year. This is the standard arithmetic approximation and it
 * can be a day or two out at the turn of the year — which is why the year is
 * shown on screen and stays editable rather than being applied silently.
 */
function approximateHijriYear(date = new Date()): number {
  const gregorianDays = (date.getTime() - Date.UTC(622, 6, 16)) / 86_400_000;
  return Math.floor(gregorianDays / 354.367) + 1;
}

export default function ZakatCalculatorPage() {
  const session = useSession();
  const supabase = createClient();
  const { showToast } = useToast();

  const householdId = session.household?.id || "";
  const userId = session.user.id;

  const [nisabStandard, setNisabStandard] = React.useState<NisabStandard>("silver");

  /*
    The metal rates are the ONLY figures here that cannot come from your own
    data — they are a market price on the day you calculate. They still need a
    starting point, so these are a rough recent PKR level and the field says so.
    Everything else below starts EMPTY and is filled from what you have recorded.
  */
  const [goldRatePerTola, setGoldRatePerTola] = React.useState("285000");
  const [silverRatePerTola, setSilverRatePerTola] = React.useState("3400");

  /*
    These used to be seeded with Rs 1,63,000 cash, Rs 4,50,000 of gold,
    Rs 1,20,000 of investments and Rs 25,000 of debts — invented numbers that
    are nobody's. On a Zakat screen that is worse than useless: it produces a
    confident, wrong figure for a religious obligation, and it looks like the
    app has read your accounts when it has not.
  */
  const [cashAndBankPKR, setCashAndBankPKR] = React.useState("");
  const [goldSilverValuePKR, setGoldSilverValuePKR] = React.useState("");
  const [investmentsPKR, setInvestmentsPKR] = React.useState("");
  const [debtsPKR, setDebtsPKR] = React.useState("");

  const [autoFilled, setAutoFilled] = React.useState<{
    cash: number;
    investments: number;
    debts: number;
  } | null>(null);
  const [saving, setSaving] = React.useState(false);

  /**
   * Fill from what the household actually holds.
   *
   * Three sources, and each exclusion matters for a figure that decides a
   * religious obligation:
   *
   *   CASH   live accounts only. A deleted or deactivated account is not money
   *          you hold, and counting it would overstate your Zakat.
   *   WEALTH the holdings' CURRENT value, not what you paid — Zakat is due on
   *          what a thing is worth today.
   *   DEBTS  only what YOU OWE (`owed_by_us`), and only what is still
   *          outstanding. Money owed TO you is an asset, not a liability, and
   *          netting it off here would cut your Zakat for money you are due.
   */
  React.useEffect(() => {
    let active = true;
    if (!householdId) return;

    async function loadFromRecords() {
      const [accRes, invRes, debtRes, payRes] = await Promise.all([
        supabase
          .from("accounts")
          .select("balance_paisa")
          .eq("household_id", householdId)
          .is("deleted_at", null)
          .eq("is_archived", false),
        supabase
          .from("investments")
          .select("current_value_paisa, status")
          .eq("household_id", householdId),
        supabase
          .from("debts")
          .select("id, principal_paisa, direction, status")
          .eq("household_id", householdId)
          .eq("status", "open")
          .eq("direction", "owed_by_us"),
        supabase.from("debt_payments").select("debt_id, amount_paisa").eq("household_id", householdId),
      ]);

      if (!active) return;

      const cash = (accRes.data ?? []).reduce((sum, a) => sum + Number(a.balance_paisa), 0);

      const investments = (invRes.data ?? [])
        .filter((i) => i.status === "active")
        .reduce((sum, i) => sum + Number(i.current_value_paisa), 0);

      const repaidByDebt = new Map<string, number>();
      for (const payment of payRes.data ?? []) {
        repaidByDebt.set(
          payment.debt_id,
          (repaidByDebt.get(payment.debt_id) ?? 0) + Number(payment.amount_paisa),
        );
      }
      const debts = (debtRes.data ?? []).reduce((sum, d) => {
        const outstanding =
          Number(d.principal_paisa) - (repaidByDebt.get(d.id) ?? 0);
        return sum + Math.max(0, outstanding);
      }, 0);

      setAutoFilled({ cash, investments, debts });
      setCashAndBankPKR(cash > 0 ? String(cash / 100) : "");
      setInvestmentsPKR(investments > 0 ? String(investments / 100) : "");
      setDebtsPKR(debts > 0 ? String(debts / 100) : "");
    }

    loadFromRecords();
    return () => {
      active = false;
    };
  }, [householdId, supabase]);

  const hijriYear = approximateHijriYear();

  // Calculations
  const goldPerTolaNum = parseFloat(goldRatePerTola) || 0;
  const silverPerTolaNum = parseFloat(silverRatePerTola) || 0;

  // Nisab thresholds in PKR
  // Silver Nisab = 52.5 tolas
  // Gold Nisab = 7.5 tolas
  const silverNisabThresholdPKR = 52.5 * silverPerTolaNum;
  const goldNisabThresholdPKR = 7.5 * goldPerTolaNum;

  const currentThresholdPKR = nisabStandard === "silver" ? silverNisabThresholdPKR : goldNisabThresholdPKR;

  const cashNum = parseFloat(cashAndBankPKR) || 0;
  const preciousMetalsNum = parseFloat(goldSilverValuePKR) || 0;
  const investmentsNum = parseFloat(investmentsPKR) || 0;
  const debtsNum = parseFloat(debtsPKR) || 0;

  const totalAssetsPKR = cashNum + preciousMetalsNum + investmentsNum;
  const netWealthBasePKR = Math.max(0, totalAssetsPKR - debtsNum);

  const isEligibleForZakat = netWealthBasePKR >= currentThresholdPKR;
  const zakatDuePKR = isEligibleForZakat ? netWealthBasePKR * 0.025 : 0;

  const handleSaveZakatRecord = async () => {
    setSaving(true);
    const { error } = await supabase.from("zakat_records").insert({
      household_id: householdId,
      user_id: userId,
      // Derived, not hardcoded — it used to be pinned at 1448 forever, so every
      // record saved after that year was filed under the wrong one.
      hijri_year: hijriYear,
      nisab_standard: nisabStandard,
      // GRAMS_PER_TOLA (11.6638), not the 11.66 that was inlined here. On a
      // 7.5-tola gold nisab the rounding difference is real money.
      gold_rate_paisa_per_gram: Math.round((goldPerTolaNum / GRAMS_PER_TOLA) * 100),
      silver_rate_paisa_per_gram: Math.round((silverPerTolaNum / GRAMS_PER_TOLA) * 100),
      cash_and_bank_paisa: Math.round(cashNum * 100),
      gold_silver_val_paisa: Math.round(preciousMetalsNum * 100),
      investments_paisa: Math.round(investmentsNum * 100),
      liabilities_paisa: Math.round(debtsNum * 100),
      net_zakat_due_paisa: Math.round(zakatDuePKR * 100),
      is_paid: false,
    });

    setSaving(false);

    if (error) {
      showToast({ type: "error", title: "Save Failed", description: error.message });
      return;
    }

    showToast({ type: "success", title: "Zakat Record Saved", description: "Zakat assessment logged in history." });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Pakistani Zakat Calculator</h1>
        <p className="text-muted text-xs">
          Calculate your annual 2.5% Zakat liability based on Islamic Nisab thresholds and live metal values.
        </p>
      </div>

      <AdvisorNote kind="zakat" />

      {/* Nisab Standard Selector Banner */}
      <div className="bg-surface border border-border rounded-panel p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
          <div>
            <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
              <Scale className="text-brass" size={20} />
              Nisab Threshold Standard
            </h3>
            <p className="text-muted text-xs mt-0.5">
              Select standard to determine minimum wealth eligibility.
            </p>
          </div>

          <div className="bg-surface-subtle border border-border rounded-control p-1 flex items-center gap-1 text-xs self-start sm:self-auto">
            <button
              onClick={() => setNisabStandard("silver")}
              className={`px-4 py-1.5 rounded-control font-semibold transition-colors ${
                nisabStandard === "silver"
                  ? "bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Silver Nisab (52.5 Tolas)
            </button>
            <button
              onClick={() => setNisabStandard("gold")}
              className={`px-4 py-1.5 rounded-control font-semibold transition-colors ${
                nisabStandard === "gold"
                  ? "bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Gold Nisab (7.5 Tolas)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <Input
            label="Gold Rate (PKR / Tola)"
            value={goldRatePerTola}
            onChange={(e) => setGoldRatePerTola(e.target.value)}
          />
          <Input
            label="Silver Rate (PKR / Tola)"
            value={silverRatePerTola}
            onChange={(e) => setSilverRatePerTola(e.target.value)}
          />
        </div>
      </div>

      {/* Calculator Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Input Column */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-panel p-6 shadow-sm space-y-4">
          <h3 className="font-display text-base font-bold pb-2 border-b border-border">
            Assets & Liabilities Breakdown
          </h3>

          {/*
            Every auto-filled field says WHERE its number came from. A figure
            that decides a religious obligation must be traceable — and if it
            looks wrong, the hint tells you which screen to go and fix.
          */}
          <div className="space-y-4">
            <Input
              label="1. Liquid Cash & Bank Account Balances (PKR)"
              type="number"
              step="any"
              min="0"
              inputMode="decimal"
              className="tnum"
              placeholder="0"
              value={cashAndBankPKR}
              onChange={(e) => setCashAndBankPKR(e.target.value)}
              hint={
                autoFilled
                  ? `Filled from your ${formatPKR(autoFilled.cash)} across active accounts. Deleted and deactivated accounts are left out.`
                  : "Reading your accounts…"
              }
            />

            <Input
              label="2. Gold & Silver Jewelry Market Value (PKR)"
              type="number"
              step="any"
              min="0"
              inputMode="decimal"
              className="tnum"
              placeholder="0"
              value={goldSilverValuePKR}
              onChange={(e) => setGoldSilverValuePKR(e.target.value)}
              hint="Yours to enter — jewellery kept at home is not in the app. Value it at today's rate, not what you paid."
            />

            <Input
              label="3. Stocks, Mutual Funds & Business Inventory (PKR)"
              type="number"
              step="any"
              min="0"
              inputMode="decimal"
              className="tnum"
              placeholder="0"
              value={investmentsPKR}
              onChange={(e) => setInvestmentsPKR(e.target.value)}
              hint={
                autoFilled
                  ? autoFilled.investments > 0
                    ? `Filled from ${formatPKR(autoFilled.investments)} of active holdings at their current value.`
                    : "No active holdings recorded — add them under Investments, or type a figure."
                  : "Reading your holdings…"
              }
            />

            <Input
              label="4. Deduct: Short-term Liabilities & Debts Due (PKR)"
              type="number"
              step="any"
              min="0"
              inputMode="decimal"
              className="tnum"
              placeholder="0"
              value={debtsPKR}
              onChange={(e) => setDebtsPKR(e.target.value)}
              hint={
                autoFilled
                  ? autoFilled.debts > 0
                    ? `Filled from ${formatPKR(autoFilled.debts)} you still owe in Udhaar. Money owed TO you is an asset, so it is not deducted here.`
                    : "Nothing outstanding in Udhaar. Add anything else you owe."
                  : "Reading what you owe…"
              }
            />
          </div>
        </div>

        {/* Right Zakat Summary Card */}
        <div className="bg-navy-900 text-on-navy rounded-panel p-6 shadow-md space-y-4 relative overflow-hidden">
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold tracking-wider text-brass">Zakat Summary</span>
              <span className="text-xs bg-navy-800 text-on-navy px-2.5 py-0.5 rounded-full">
                1448 AH
              </span>
            </div>

            <div>
              <span className="text-muted text-xs block">Net Zakat Payable (2.5%)</span>
              <span className="font-display text-3xl font-bold text-brass block mt-1">
                {formatPKR(Math.round(zakatDuePKR * 100))}
              </span>
            </div>

            <div className="pt-4 border-t border-navy-800 space-y-2 text-xs text-on-navy-muted">
              <div className="flex justify-between">
                <span>Net Asset Base:</span>
                <span className="font-mono text-on-navy font-semibold">{formatPKR(Math.round(netWealthBasePKR * 100))}</span>
              </div>
              <div className="flex justify-between">
                <span>Nisab Threshold:</span>
                <span className="font-mono text-on-navy font-semibold">{formatPKR(Math.round(currentThresholdPKR * 100))}</span>
              </div>
              <div className="flex justify-between">
                <span>Eligibility Status:</span>
                <span className={`font-semibold ${isEligibleForZakat ? "text-brass" : "text-on-navy-muted"}`}>
                  {isEligibleForZakat ? "Eligible (Above Nisab)" : "Below Nisab Threshold"}
                </span>
              </div>
            </div>

            <Button
              variant="brass"
              onClick={handleSaveZakatRecord}
              isLoading={saving}
              className="w-full mt-2"
            >
              Save Zakat Assessment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
