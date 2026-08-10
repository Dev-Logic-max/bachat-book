"use client";

import * as React from "react";
import { Landmark, ShieldCheck, CheckSquare, Square, Calculator, Upload, FileCheck, ArrowUpRight } from "lucide-react";
import { AdvisorNote } from "@/components/advisor-note";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatPKR } from "@/lib/format";

type EmploymentType = "salaried" | "business" | "freelancer";

export default function TaxPage() {
  const session = useSession();
  const supabase = createClient();
  const { showToast } = useToast();

  const householdId = session.household?.id || "";
  const userId = session.user.id;

  const [isFiler, setIsFiler] = React.useState(true);
  const [employmentType, setEmploymentType] = React.useState<EmploymentType>("salaried");
  const [annualIncomePKR, setAnnualIncomePKR] = React.useState("2400000"); // 2.4M PKR
  const [taxCreditsPKR, setTaxCreditsPKR] = React.useState("45000");
  const [whtDeductedPKR, setWhtDeductedPKR] = React.useState("185000");

  const [checklist, setChecklist] = React.useState([
    { id: "1", text: "Download Salary Tax Certificate (Section 149) from HR", done: true },
    { id: "2", text: "Collect Bank Cash Withdrawal WHT statement (Section 231A)", done: true },
    { id: "3", text: "Gather Mutual Fund investment tax rebate receipts (Section 60C)", done: false },
    { id: "4", text: "Log in to FBR IRIS Portal (iris.fbr.gov.pk) with CNIC", done: false },
    { id: "5", text: "Submit 114(1) Return of Income & 116 Wealth Statement", done: false },
  ]);

  const incomeNum = parseFloat(annualIncomePKR) || 0;
  const creditsNum = parseFloat(taxCreditsPKR) || 0;
  const whtNum = parseFloat(whtDeductedPKR) || 0;

  // 2025-2026 Pakistani Tax Slabs Calculation (Salaried)
  const calculateSalariedTax = (inc: number) => {
    if (inc <= 600000) return 0;
    if (inc <= 1200000) return (inc - 600000) * 0.05;
    if (inc <= 2200000) return 30000 + (inc - 1200000) * 0.15;
    if (inc <= 3200000) return 180000 + (inc - 2200000) * 0.25;
    if (inc <= 4100000) return 430000 + (inc - 3200000) * 0.30;
    return 700000 + (inc - 4100000) * 0.35;
  };

  // 2025-2026 Pakistani Tax Slabs Calculation (Non-Salaried / Business)
  const calculateBusinessTax = (inc: number) => {
    if (inc <= 600000) return 0;
    if (inc <= 1200000) return (inc - 600000) * 0.15;
    if (inc <= 1600000) return 90000 + (inc - 1200000) * 0.20;
    if (inc <= 3200000) return 170000 + (inc - 1600000) * 0.30;
    if (inc <= 5600000) return 650000 + (inc - 3200000) * 0.40;
    return 1610000 + (inc - 5600000) * 0.45;
  };

  const grossTaxPKR = employmentType === "salaried" ? calculateSalariedTax(incomeNum) : calculateBusinessTax(incomeNum);
  const netTaxAfterCreditsPKR = Math.max(0, grossTaxPKR - creditsNum);
  const finalTaxPayableOrRefundPKR = netTaxAfterCreditsPKR - whtNum;

  const toggleChecklist = (id: string) => {
    setChecklist(
      checklist.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Pakistani Tax & FBR Filing Assistant</h1>
          <p className="text-muted text-xs">
            2025–2026 Tax Slabs, Filer WHT savings calculator, tax rebate vault, and FBR IRIS checklist.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-surface border border-border px-3 py-1.5 rounded-full text-xs font-semibold">
          <ShieldCheck size={16} className={isFiler ? "text-gain" : "text-loss"} />
          <span>FBR Status: {isFiler ? "Active Filer (ATL)" : "Non-Filer"}</span>
        </div>
      </div>

      <AdvisorNote kind="tax" />

      {/* Tax Slabs Calculator Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 bg-surface border border-border rounded-panel p-6 shadow-sm space-y-4">
          <h3 className="font-display text-base font-bold pb-2 border-b border-border flex items-center gap-2">
            <Calculator size={18} className="text-brass" />
            Annual Tax Slabs Estimator (2025–2026)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Employment Category"
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
              options={[
                { value: "salaried", label: "Salaried Individual (60%+ Salary)" },
                { value: "business", label: "Non-Salaried / Business" },
                { value: "freelancer", label: "IT / Freelancer (0.25% Export Tax)" },
              ]}
            />

            <Input
              label="Annual Taxable Income (PKR)"
              value={annualIncomePKR}
              onChange={(e) => setAnnualIncomePKR(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Tax Credits / Investment Rebates (Section 60C/60D)"
              value={taxCreditsPKR}
              onChange={(e) => setTaxCreditsPKR(e.target.value)}
            />

            <Input
              label="Already Deducted WHT / Advance Tax (PKR)"
              value={whtDeductedPKR}
              onChange={(e) => setWhtDeductedPKR(e.target.value)}
            />
          </div>
        </div>

        {/* Tax Output Summary */}
        <div className="bg-navy-900 text-on-navy rounded-panel p-6 shadow-md space-y-4">
          <span className="text-xs uppercase font-bold tracking-wider text-brass">Est. FBR Tax Liability</span>

          <div>
            <span className="text-muted text-xs block">
              {finalTaxPayableOrRefundPKR >= 0 ? "Tax Payable at Filing" : "Refund Claimable"}
            </span>
            <span className={`font-display text-3xl font-bold block mt-1 ${finalTaxPayableOrRefundPKR >= 0 ? "text-on-navy" : "text-gain"}`}>
              {formatPKR(Math.abs(Math.round(finalTaxPayableOrRefundPKR * 100)))}
            </span>
          </div>

          <div className="pt-3 border-t border-navy-800 space-y-1.5 text-xs text-on-navy-muted">
            <div className="flex justify-between">
              <span>Gross Income Tax:</span>
              <span className="font-mono text-on-navy font-semibold">{formatPKR(Math.round(grossTaxPKR * 100))}</span>
            </div>
            <div className="flex justify-between">
              <span>Less Rebates:</span>
              <span className="font-mono text-on-navy font-semibold">{formatPKR(Math.round(creditsNum * 100))}</span>
            </div>
            <div className="flex justify-between">
              <span>Advance WHT Paid:</span>
              <span className="font-mono text-on-navy font-semibold">{formatPKR(Math.round(whtNum * 100))}</span>
            </div>
          </div>
        </div>
      </div>

      {/* FBR IRIS Filing Checklist */}
      <div className="bg-surface border border-border rounded-panel p-6 shadow-sm space-y-4">
        <h3 className="font-display text-base font-bold text-foreground border-b border-border pb-3">
          FBR IRIS Portal Annual Filing Checklist (Tax Year 2026)
        </h3>

        <div className="space-y-2">
          {checklist.map((item) => (
            <button
              key={item.id}
              onClick={() => toggleChecklist(item.id)}
              className="flex items-center gap-3 w-full text-left p-3 rounded-control bg-surface-subtle hover:bg-surface-subtle/80 transition-colors text-xs"
            >
              {item.done ? (
                <CheckSquare size={16} className="text-gain shrink-0" />
              ) : (
                <Square size={16} className="text-muted shrink-0" />
              )}
              <span className={item.done ? "line-through text-muted" : "font-medium text-foreground"}>
                {item.text}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
