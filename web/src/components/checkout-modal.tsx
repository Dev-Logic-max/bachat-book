"use client";

import * as React from "react";
import { Info, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { MerchantMark } from "@/components/merchant-mark";
import { useToast } from "@/components/ui/toast";
import { formatPKR } from "@/lib/format";
import { yearlySavingPercent } from "@/lib/plan";
import { cn } from "@/lib/utils";

import type { Tables } from "@/lib/supabase/types";

export type BillingCycle = "monthly" | "yearly";

/**
 * Payment methods, with honest marks.
 *
 * Only JazzCash has a verified logo in /public/logos. `easypaisa.png` exists on
 * disk but is one of the eleven files that turned out to be another company's
 * artwork, so it is NOT used here — MerchantMark's `awaitingLogo` placeholder
 * shows a brand-coloured dashed ring instead, which makes the gap visible rather
 * than quietly wrong.
 */
const METHODS = [
  { id: "jazzcash", name: "JazzCash", brand: "#c8102e", logo: "/logos/jazzcash.png", note: "Mobile wallet" },
  { id: "easypaisa", name: "Easypaisa", brand: "#4a9c2d", logo: undefined, note: "Mobile wallet" },
  { id: "card", name: "Debit or credit card", brand: "#1a1f71", logo: undefined, note: "Visa, Mastercard" },
  { id: "bank", name: "Bank transfer", brand: "#0B1A33", logo: undefined, note: "IBFT or raast" },
];

/**
 * Checkout for a Pro upgrade.
 *
 * Built in full and deliberately NOT live. No gateway is connected yet, so the
 * screen says so plainly instead of pretending to take a payment and failing at
 * the last step — and it collects nothing, because a form that asks for a card
 * number it cannot process is worse than no form.
 *
 * Everything it displays comes from the plan row, so when a gateway is wired the
 * only change is what the confirm button does.
 */
export function CheckoutModal({
  isOpen,
  onClose,
  plan,
  cycle,
  onCycleChange,
  supportEmail,
}: {
  isOpen: boolean;
  onClose: () => void;
  plan: Tables<"plans"> | null;
  cycle: BillingCycle;
  onCycleChange: (c: BillingCycle) => void;
  supportEmail?: string;
}) {
  const { showToast } = useToast();
  const [method, setMethod] = React.useState("jazzcash");

  if (!plan) return null;

  const amount = cycle === "yearly" ? plan.price_yearly_paisa : plan.price_monthly_paisa;
  const saving = yearlySavingPercent(plan.price_monthly_paisa, plan.price_yearly_paisa);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Upgrade to ${plan.name}`}
      subtitle="Review your order"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() =>
              showToast({
                type: "info",
                title: "Payments are not live yet",
                description: supportEmail
                  ? `Contact ${supportEmail} to activate Pro on your account.`
                  : "Ask an administrator to activate Pro on your account.",
              })
            }
          >
            <Lock size={14} className="me-1.5" />
            Pay {formatPKR(amount)}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Cycle */}
        <div className="border-border bg-surface-subtle flex gap-1 rounded-control border p-1">
          {(["monthly", "yearly"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onCycleChange(c)}
              aria-pressed={cycle === c}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-control px-3 py-1.5 text-[12.5px] font-medium capitalize transition-colors",
                cycle === c
                  ? "bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900"
                  : "text-muted hover:text-foreground",
              )}
            >
              {c}
              {c === "yearly" && saving > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[9.5px] font-bold",
                    cycle === c ? "bg-white/20" : "bg-gain-soft text-gain",
                  )}
                >
                  −{saving}%
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Order summary */}
        <div className="border-border rounded-card border p-3.5">
          <div className="flex items-baseline justify-between">
            <span className="text-foreground text-[13px] font-medium">
              {plan.name}, billed {cycle}
            </span>
            <span className="font-display tabular-nums text-lg font-semibold">
              {formatPKR(amount)}
            </span>
          </div>
          {cycle === "yearly" && saving > 0 && (
            <p className="text-gain mt-1 text-[11.5px]">
              {formatPKR(plan.price_monthly_paisa * 12 - plan.price_yearly_paisa)} less than
              paying monthly for a year.
            </p>
          )}
          <p className="text-faint mt-1.5 text-[11px]">
            Renews every {cycle === "yearly" ? "year" : "month"}. Cancel any time —
            your workspaces stay readable either way.
          </p>
        </div>

        {/* Methods */}
        <div>
          <p className="text-faint mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]">
            Pay with
          </p>
          <div className="space-y-1.5">
            {METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                aria-pressed={method === m.id}
                className={cn(
                  "flex w-full items-center gap-3 rounded-card border p-2.5 text-left transition-colors",
                  method === m.id
                    ? "border-brass bg-brass-soft"
                    : "border-border hover:bg-surface-subtle",
                )}
              >
                <MerchantMark
                  name={m.name}
                  brand={m.brand}
                  logo={m.logo}
                  awaitingLogo={!m.logo}
                  size={30}
                />
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block truncate text-[12.5px] font-medium">
                    {m.name}
                  </span>
                  <span className="text-faint block text-[10.5px]">{m.note}</span>
                </span>
                <span
                  className={cn(
                    "size-4 shrink-0 rounded-full border-2 transition-colors",
                    method === m.id ? "border-brass bg-brass" : "border-border",
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        {/*
          Said once, plainly, where the decision is made. A checkout that looks
          finished and then fails at the last step is the worse outcome.
        */}
        <div className="border-brass/30 bg-brass-soft text-brass-strong flex items-start gap-2.5 rounded-card border p-3">
          <Info size={15} className="mt-0.5 shrink-0" />
          <p className="text-[12px] leading-snug">
            Online payments are not switched on yet. Nothing is charged and no card
            details are collected here.{" "}
            {supportEmail
              ? `Email ${supportEmail} and Pro will be activated on your account.`
              : "Ask an administrator to activate Pro on your account."}
          </p>
        </div>

        <p className="text-faint flex items-center justify-center gap-1.5 text-[10.5px]">
          <ShieldCheck size={12} />
          Card details will never be stored by Bachat Book.
        </p>
      </div>
    </Modal>
  );
}
