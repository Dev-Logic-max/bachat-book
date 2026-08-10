"use client";

import * as React from "react";
import { TrendingUp, Plus, ShieldCheck, Landmark, BarChart3 } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { formatPKR } from "@/lib/format";

export default function InvestmentsVaultPage() {
  const session = useSession();

  const holdings = [
    { id: "1", name: "National Savings - Behbood Certificate (NSS)", type: "Govt Savings", valPaisa: 100000000, profitRate: "13.8%" },
    { id: "2", name: "Meezan Islamic Fund (MIF)", type: "Mutual Fund", valPaisa: 35000000, profitRate: "18.2%" },
    { id: "3", name: "Meezan Bank Limited (MEBL - PSX)", type: "Stocks", valPaisa: 28000000, profitRate: "+12.4%" },
  ];

  const totalVaultPaisa = holdings.reduce((sum, h) => sum + h.valPaisa, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Investments & Savings Vault</h1>
          <p className="text-muted text-xs">
            Track National Savings Certificates (NSS), PSX Stocks, and Mutual Fund holdings.
          </p>
        </div>

        <Button variant="primary" className="flex items-center gap-1.5 self-start sm:self-auto">
          <Plus size={16} />
          <span>Add Holding</span>
        </Button>
      </div>

      {/* Hero Summary Card */}
      <div className="bg-navy-900 text-on-navy rounded-panel p-6 shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-brass">Total Investment Net Worth</span>
            <span className="font-display text-3xl font-bold block mt-1 text-on-navy">
              {formatPKR(totalVaultPaisa)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="bg-gain-subtle text-gain border border-gain/20 text-xs px-3 py-1 rounded-full font-bold">
              + 14.6% Avg Annual Yield
            </span>
          </div>
        </div>
      </div>

      {/* Holdings List */}
      <div className="bg-surface border border-border rounded-panel overflow-hidden shadow-sm divide-y divide-border">
        {holdings.map((h) => (
          <div key={h.id} className="p-4 flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brass/10 text-brass flex items-center justify-center font-bold">
                <TrendingUp size={16} />
              </div>
              <div>
                <h4 className="font-bold text-foreground">{h.name}</h4>
                <span className="text-muted text-[11px]">{h.type}</span>
              </div>
            </div>

            <div className="text-right">
              <span className="font-display font-bold text-foreground block text-sm">{formatPKR(h.valPaisa)}</span>
              <span className="text-gain font-semibold text-[11px]">{h.profitRate}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
