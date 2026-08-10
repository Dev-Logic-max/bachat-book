"use client";

import * as React from "react";
import { Download, Printer, PieChart, TrendingUp, TrendingDown, FileText } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { formatPKR } from "@/lib/format";

export default function ReportsPage() {
  const session = useSession();
  const supabase = createClient();

  const householdId = session.household?.id || "";

  const [totalIncome, setTotalIncome] = React.useState(0);
  const [totalExpense, setTotalExpense] = React.useState(0);
  const [categoryBreakdown, setCategoryBreakdown] = React.useState<{ name: string; amount: number }[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    if (!householdId) return;

    async function loadReportData() {
      const { data: txs } = await supabase
        .from("transactions")
        .select("type, amount_paisa, categories(name)")
        .eq("household_id", householdId);

      if (!active || !txs) return;

      let income = 0;
      let expense = 0;
      const catMap: Record<string, number> = {};

      txs.forEach((tx) => {
        const amt = Math.abs(tx.amount_paisa);
        if (tx.type === "income") income += amt;
        if (tx.type === "expense") {
          expense += amt;
          const catName = (tx.categories as unknown as { name: string })?.name || "Other Expense";
          catMap[catName] = (catMap[catName] || 0) + amt;
        }
      });

      const breakdown = Object.entries(catMap).map(([name, amount]) => ({ name, amount }));

      setTotalIncome(income);
      setTotalExpense(expense);
      setCategoryBreakdown(breakdown);
      setLoading(false);
    }

    loadReportData();
    return () => {
      active = false;
    };
  }, [householdId, supabase]);

  const handleExportCSV = () => {
    const csvRows = [
      ["Category", "Amount (PKR)"],
      ...categoryBreakdown.map((c) => [c.name, (c.amount / 100).toFixed(2)]),
    ];
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BachatBook_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const netSavings = totalIncome - totalExpense;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Financial Analytics & Reports</h1>
          <p className="text-muted text-xs">
            Comprehensive household cashflow trends, spending velocity, and downloadable PDF/CSV exports.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button variant="secondary" onClick={handleExportCSV} className="flex items-center gap-1.5 text-xs">
            <Download size={14} />
            <span>Export CSV</span>
          </Button>
          <Button variant="primary" onClick={handlePrint} className="flex items-center gap-1.5 text-xs">
            <Printer size={14} />
            <span>Print Report</span>
          </Button>
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="bg-surface border border-border rounded-panel p-5 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-gain-subtle text-gain flex items-center justify-center font-bold">
            <TrendingUp size={20} />
          </div>
          <div>
            <span className="text-muted text-xs font-semibold block">Total Household Income</span>
            <span className="font-display text-xl font-bold text-foreground">{formatPKR(totalIncome)}</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-panel p-5 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-loss-subtle text-loss flex items-center justify-center font-bold">
            <TrendingDown size={20} />
          </div>
          <div>
            <span className="text-muted text-xs font-semibold block">Total Household Expenses</span>
            <span className="font-display text-xl font-bold text-foreground">{formatPKR(totalExpense)}</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-panel p-5 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-brass/10 text-brass flex items-center justify-center font-bold">
            <PieChart size={20} />
          </div>
          <div>
            <span className="text-muted text-xs font-semibold block">Net Household Savings</span>
            <span className="font-display text-xl font-bold text-brass">{formatPKR(Math.max(0, netSavings))}</span>
          </div>
        </div>
      </div>

      {/* Category Expense Breakdown */}
      <div className="bg-surface border border-border rounded-panel p-6 shadow-sm space-y-4">
        <h3 className="font-display text-base font-bold text-foreground border-b border-border pb-3">
          Category Expenditure Distribution
        </h3>

        {categoryBreakdown.length === 0 ? (
          <div className="p-8 text-center text-muted text-xs">No expense transactions recorded.</div>
        ) : (
          <div className="space-y-3">
            {categoryBreakdown.map((cat, idx) => {
              const percent = totalExpense > 0 ? (cat.amount / totalExpense) * 100 : 0;

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-foreground">{cat.name}</span>
                    <span className="font-mono text-muted">{formatPKR(cat.amount)} ({percent.toFixed(1)}%)</span>
                  </div>

                  <div className="w-full h-2 bg-surface-subtle border border-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brass transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
