"use client";

import * as React from "react";
import { TrendingUp, Plus, ShieldCheck, Landmark, BarChart3 } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { PageActions } from "@/components/page-actions";
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
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display truncate text-[19px] font-semibold tracking-[-0.02em] sm:text-[22px]">
            Investments
          </h1>
          <p className="text-muted mt-0.5 text-[12.5px]">
            National Savings certificates, prize bonds, PSX holdings and mutual
            funds.
          </p>
        </div>

        <PageActions
          title="Investments"
          actions={[
            {
              label: "Add holding",
              shortLabel: "Holding",
              hint: "Not wired up yet — this module is still read-only",
              icon: Plus,
              tone: "primary",
              onClick: () => {},
            },
          ]}
        />
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
