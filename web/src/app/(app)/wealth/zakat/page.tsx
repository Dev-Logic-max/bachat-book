"use client";

import * as React from "react";
import { Coins, ShieldCheck, Scale, Calculator, CheckCircle2, Info } from "lucide-react";
import { AdvisorNote } from "@/components/advisor-note";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatPKR } from "@/lib/format";

type NisabStandard = "silver" | "gold";

export default function ZakatCalculatorPage() {
  const session = useSession();
  const supabase = createClient();
  const { showToast } = useToast();

  const householdId = session.household?.id || "";
  const userId = session.user.id;

  const [nisabStandard, setNisabStandard] = React.useState<NisabStandard>("silver");
  const [goldRatePerTola, setGoldRatePerTola] = React.useState("285000"); // Standard current PKR rate
  const [silverRatePerTola, setSilverRatePerTola] = React.useState("3400"); // Standard current PKR rate

  const [cashAndBankPKR, setCashAndBankPKR] = React.useState("163000");
  const [goldSilverValuePKR, setGoldSilverValuePKR] = React.useState("450000");
  const [investmentsPKR, setInvestmentsPKR] = React.useState("120000");
  const [debtsPKR, setDebtsPKR] = React.useState("25000");

  const [saving, setSaving] = React.useState(false);

  // Auto-fetch bank balances from accounts
  React.useEffect(() => {
    let active = true;
    if (!householdId) return;

    async function loadBalances() {
      const { data } = await supabase.from("accounts").select("balance_paisa").eq("household_id", householdId);
      if (active && data) {
        const totalPaisa = data.reduce((sum, a) => sum + Number(a.balance_paisa), 0);
        if (totalPaisa > 0) {
          setCashAndBankPKR((totalPaisa / 100).toString());
        }
      }
    }

    loadBalances();
    return () => {
      active = false;
    };
  }, [householdId, supabase]);

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
      hijri_year: 1448,
      nisab_standard: nisabStandard,
      gold_rate_paisa_per_gram: Math.round((goldPerTolaNum / 11.66) * 100),
      silver_rate_paisa_per_gram: Math.round((silverPerTolaNum / 11.66) * 100),
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

          <div className="space-y-4">
            <Input
              label="1. Liquid Cash & Bank Account Balances (PKR)"
              value={cashAndBankPKR}
              onChange={(e) => setCashAndBankPKR(e.target.value)}
            />

            <Input
              label="2. Gold & Silver Jewelry Market Value (PKR)"
              value={goldSilverValuePKR}
              onChange={(e) => setGoldSilverValuePKR(e.target.value)}
            />

            <Input
              label="3. Stocks, Mutual Funds & Business Inventory (PKR)"
              value={investmentsPKR}
              onChange={(e) => setInvestmentsPKR(e.target.value)}
            />

            <Input
              label="4. Deduct: Short-term Liabilities & Debts Due (PKR)"
              value={debtsPKR}
              onChange={(e) => setDebtsPKR(e.target.value)}
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
