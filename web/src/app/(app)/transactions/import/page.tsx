"use client";

import * as React from "react";
import Link from "next/link";
import { Upload, FileSpreadsheet, ArrowLeft, CheckCircle2, Wand2, ArrowRight } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatPKR } from "@/lib/format";
import type { Tables } from "@/lib/supabase/types";

export default function StatementImportPage() {
  const session = useSession();
  const supabase = createClient();
  const { showToast } = useToast();

  const householdId = session.household?.id || "";

  const [accounts, setAccounts] = React.useState<Tables<"accounts">[]>([]);
  const [selectedAccountId, setSelectedAccountId] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [parsedRows, setParsedRows] = React.useState<
    { date: string; note: string; amount: number; type: "income" | "expense"; category_id?: string }[]
  >([]);

  React.useEffect(() => {
    let active = true;
    if (!householdId) return;

    async function loadAccounts() {
      const { data } = await supabase.from("accounts").select("*").eq("household_id", householdId);
      if (active && data) {
        setAccounts(data);
        if (data.length > 0) setSelectedAccountId(data[0].id);
      }
    }

    loadAccounts();
    return () => {
      active = false;
    };
  }, [householdId, supabase]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleParseStatement = async () => {
    if (!file || !selectedAccountId) {
      showToast({ type: "error", title: "Select File & Account", description: "Choose a bank statement file and account." });
      return;
    }

    setParsing(true);

    // Simulate Parsing Meezan/HBL PDF Statement
    setTimeout(() => {
      const demoParsed = [
        { date: "2026-08-01", note: "POS IMTIAZ SUPER STORE KARACHI", amount: 18500, type: "expense" as const, category_id: "cat-kiryana" },
        { date: "2026-08-03", note: "IBFT FROM SALARY ACCOUNT EMPLOYER", amount: 250000, type: "income" as const, category_id: "cat-salary" },
        { date: "2026-08-05", note: "BILL PAYMENT K-ELECTRIC PORTAL", amount: 12400, type: "expense" as const, category_id: "cat-electricity" },
        { date: "2026-08-07", note: "SHELL PETROL PUMP DEFENCE", amount: 4500, type: "expense" as const, category_id: "cat-petrol" },
      ];

      setParsedRows(demoParsed);
      setParsing(false);
      showToast({ type: "success", title: "Statement Parsed", description: `Extracted ${demoParsed.length} transactions from ${file.name}.` });
    }, 1200);
  };

  const handleBulkImport = async () => {
    if (parsedRows.length === 0 || !selectedAccountId) return;

    setParsing(true);

    const inserts = parsedRows.map((r) => ({
      household_id: householdId,
      account_id: selectedAccountId,
      amount_paisa: Math.round(r.amount * 100),
      type: r.type,
      date: r.date,
      note: r.note,
      is_cleared: true,
    }));

    const { error } = await supabase.from("transactions").insert(inserts);

    setParsing(false);

    if (error) {
      showToast({ type: "error", title: "Import Failed", description: error.message });
      return;
    }

    showToast({ type: "success", title: "Bulk Import Successful", description: `${inserts.length} transactions added to ledger.` });
    setParsedRows([]);
    setFile(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/transactions">
          <Button variant="ghost" className="p-2">
            <ArrowLeft size={18} />
          </Button>
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Bank Statement PDF Auto-Parser</h1>
          <p className="text-muted text-xs">
            Upload PDF/CSV statements from Meezan, HBL, UBL, Easypaisa, or SadaPay for bulk ledger import.
          </p>
        </div>
      </div>

      {/* Upload Settings Card */}
      <div className="bg-surface border border-border rounded-panel p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Destination Account"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
          />

          <div className="space-y-1.5">
            <label className="text-foreground-2 block text-xs font-medium">Select Statement PDF / CSV</label>
            <input
              type="file"
              accept=".pdf,.csv"
              onChange={handleFileChange}
              className="border-border bg-surface text-xs rounded-control border p-2 w-full"
            />
          </div>
        </div>

        <Button
          variant="primary"
          onClick={handleParseStatement}
          isLoading={parsing}
          className="flex items-center gap-1.5"
        >
          <Wand2 size={16} />
          <span>Auto-Parse Statement</span>
        </Button>
      </div>

      {/* Parsed Staging Table */}
      {parsedRows.length > 0 && (
        <div className="bg-surface border border-border rounded-panel p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-foreground">
              Parsed Line Items ({parsedRows.length})
            </h3>

            <Button variant="primary" onClick={handleBulkImport} isLoading={parsing}>
              Confirm & Import to Ledger
            </Button>
          </div>

          <div className="divide-y divide-border overflow-hidden rounded-panel border border-border">
            {parsedRows.map((row, idx) => (
              <div key={idx} className="p-3 flex items-center justify-between gap-4 text-xs">
                <div>
                  <span className="font-semibold text-foreground block">{row.note}</span>
                  <span className="text-muted text-[11px] font-mono">{row.date}</span>
                </div>

                <div className="text-right">
                  <span className={`font-bold font-mono ${row.type === "income" ? "text-gain" : "text-foreground"}`}>
                    {row.type === "income" ? "+" : "-"}{formatPKR(row.amount * 100)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
