"use client";

import * as React from "react";
import { ScanLine, Plus, FileText, ExternalLink, Trash2 } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatPKR } from "@/lib/format";
import type { Tables } from "@/lib/supabase/types";

export default function ReceiptsPage() {
  const session = useSession();
  const supabase = createClient();
  const { showToast } = useToast();

  const householdId = session.household?.id || "";

  const [receipts, setReceipts] = React.useState<Tables<"receipts">[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [addModalOpen, setAddModalOpen] = React.useState(false);

  const [merchantName, setMerchantName] = React.useState("");
  const [amountPKR, setAmountPKR] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    if (!householdId) return;

    async function loadReceipts() {
      const { data } = await supabase
        .from("receipts")
        .select("*")
        .eq("household_id", householdId)
        .order("receipt_date", { ascending: false });

      if (active && data) {
        setReceipts(data);
        setLoading(false);
      }
    }

    loadReceipts();
    return () => {
      active = false;
    };
  }, [householdId, supabase]);

  const handleAddReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchantName.trim()) {
      showToast({ type: "error", title: "Missing Merchant", description: "Enter merchant or store name." });
      return;
    }

    setSubmitting(true);
    const amountPaisa = amountPKR ? Math.round(parseFloat(amountPKR) * 100) : null;

    const { error } = await supabase.from("receipts").insert({
      household_id: householdId,
      merchant_name: merchantName.trim(),
      total_amount_paisa: amountPaisa,
      receipt_date: new Date().toISOString().split("T")[0],
      file_path: "/logos/imtiaz.png",
      notes: notes.trim() || null,
    });

    setSubmitting(false);

    if (error) {
      showToast({ type: "error", title: "Upload Failed", description: error.message });
      return;
    }

    showToast({ type: "success", title: "Receipt Uploaded", description: `Receipt for "${merchantName}" saved.` });
    setMerchantName("");
    setAmountPKR("");
    setNotes("");
    setAddModalOpen(false);

    const { data } = await supabase.from("receipts").select("*").eq("household_id", householdId).order("receipt_date", { ascending: false });
    if (data) setReceipts(data);
  };

  const handleDeleteReceipt = async (id: string) => {
    const { error } = await supabase.from("receipts").delete().eq("id", id);
    if (error) {
      showToast({ type: "error", title: "Delete Failed", description: error.message });
      return;
    }
    showToast({ type: "success", title: "Receipt Deleted", description: "Receipt removed from vault." });
    setReceipts(receipts.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Smart Receipts & Document Vault</h1>
          <p className="text-muted text-xs">
            Store and attach Kiryana bills, fuel slips, and utility receipts directly to transaction records.
          </p>
        </div>

        <Button variant="primary" onClick={() => setAddModalOpen(true)} className="flex items-center gap-1.5 self-start sm:self-auto">
          <Plus size={16} />
          <span>Upload Receipt</span>
        </Button>
      </div>

      {loading ? (
        <div className="bg-surface border-border rounded-panel border p-8 text-center text-muted text-xs">
          Loading receipts vault...
        </div>
      ) : receipts.length === 0 ? (
        <div className="bg-surface border-border rounded-panel border p-12 text-center">
          <ScanLine size={40} className="text-muted mx-auto mb-3" />
          <h3 className="font-display text-base font-semibold">No Receipts Uploaded</h3>
          <p className="text-muted text-xs mt-1 max-w-sm mx-auto">
            Upload images or PDFs of store receipts, fuel slips, or bill payment proofs.
          </p>
          <Button variant="primary" onClick={() => setAddModalOpen(true)} className="mt-4">
            + Upload First Receipt
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {receipts.map((receipt) => (
            <div key={receipt.id} className="bg-surface border border-border rounded-panel p-5 shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                  <div className="flex items-center gap-2.5">
                    <img src={receipt.file_path} alt="" className="w-7 h-7 rounded-full object-contain shrink-0" />
                    <h3 className="font-display text-sm font-bold text-foreground truncate">{receipt.merchant_name}</h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteReceipt(receipt.id)}
                    className="p-1 text-muted hover:text-loss rounded-full transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="mt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted">Total Amount:</span>
                    <span className="font-display font-bold text-foreground">
                      {receipt.total_amount_paisa ? formatPKR(receipt.total_amount_paisa) : "Unspecified"}
                    </span>
                  </div>

                  <div className="flex justify-between text-muted">
                    <span>Date:</span>
                    <span className="font-mono">{receipt.receipt_date}</span>
                  </div>

                  {receipt.notes && (
                    <p className="text-[11px] text-muted pt-1 italic">{receipt.notes}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Receipt Modal */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Upload Receipt Document">
        <form onSubmit={handleAddReceipt} className="space-y-4">
          <Input
            label="Merchant / Store Name"
            placeholder="e.g. Imtiaz Super Market, Shell Petrol"
            value={merchantName}
            onChange={(e) => setMerchantName(e.target.value)}
            required
          />

          <Input
            label="Total Amount (PKR)"
            placeholder="e.g. 18500"
            type="number"
            value={amountPKR}
            onChange={(e) => setAmountPKR(e.target.value)}
          />

          <Input
            label="Notes / Line Items"
            placeholder="e.g. Monthly ration bill PDF"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Save Receipt
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
