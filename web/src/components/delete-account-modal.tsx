"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { Tables } from "@/lib/supabase/types";

/**
 * Permanent account deletion.
 *
 * Deletion here is a TOMBSTONE, not a DELETE. The account stops being usable
 * forever, but every transaction it ever carried stays exactly where it is and
 * starts rendering a "Deleted account" tag. Removing the rows instead would
 * silently rewrite months of history — last month's spending total would change
 * because an account was tidied up today.
 *
 * The name must be typed out. A destructive action reached from a hover menu is
 * one misclick from gone, and this one cannot be undone.
 */
export function DeleteAccountModal({
  isOpen,
  onClose,
  onConfirm,
  account,
  movementCount,
  busy = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  account: Tables<"accounts"> | null;
  /** How many transactions will keep pointing at it. */
  movementCount: number | null;
  busy?: boolean;
}) {
  const [typed, setTyped] = React.useState("");

  // Clear the box each time the dialog opens, so a previous attempt cannot leave
  // it pre-filled and one click from deleting.
  const seedKey = `${isOpen}:${account?.id ?? "none"}`;
  const [seeded, setSeeded] = React.useState(seedKey);
  if (seeded !== seedKey) {
    setSeeded(seedKey);
    setTyped("");
  }

  if (!account) return null;

  const matches = typed.trim() === account.name.trim();
  const balance = Number(account.balance_paisa);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete this account permanently?"
      subtitle="This cannot be undone"
      icon={<AlertTriangle size={16} />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!matches || busy}
            className={cn(
              "bg-loss rounded-control px-4 py-2 text-xs font-semibold text-white transition-opacity",
              "hover:opacity-90 disabled:opacity-40",
            )}
          >
            {busy ? "Deleting…" : "Delete account"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-surface-subtle border-border rounded-card border p-3.5">
          <p className="text-foreground text-[13px] font-semibold">{account.name}</p>
          <p className="text-muted mt-0.5 text-[11.5px]">
            Holds <span className="tnum font-medium">{formatPKR(balance)}</span>
            {movementCount !== null && (
              <>
                {" · "}
                <span className="tnum">{movementCount}</span> recorded{" "}
                {movementCount === 1 ? "movement" : "movements"}
              </>
            )}
          </p>
        </div>

        {balance !== 0 && (
          <p className="border-loss/30 bg-loss-soft text-loss rounded-control border px-3 py-2 text-[11.5px] leading-snug">
            This account still holds {formatPKR(balance)}. Deleting it removes that
            from what you hold, so your total will drop by the same amount. Move the
            money first if it still exists in real life.
          </p>
        )}

        <ul className="text-muted space-y-1.5 text-[11.5px] leading-snug">
          <li>
            · Past transactions are <span className="text-foreground font-medium">kept</span>{" "}
            and will show a “Deleted account” tag. Your history for previous months
            does not change.
          </li>
          <li>· The account disappears from every picker and can never be used again.</li>
          <li>
            · This cannot be reversed. To stop using an account but keep the option
            of coming back, <span className="text-foreground font-medium">deactivate</span>{" "}
            it instead.
          </li>
        </ul>

        <Input
          label={`Type “${account.name}” to confirm`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={account.name}
          autoComplete="off"
          error={typed.length > 0 && !matches ? "The name does not match yet." : undefined}
        />
      </div>
    </Modal>
  );
}
