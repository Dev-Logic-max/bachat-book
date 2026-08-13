"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

export interface ConfirmPoint {
  icon: React.ReactNode;
  /** What happens. One short clause. */
  label: string;
  /** Why, or what it does NOT do. Rendered smaller and italic. */
  detail?: string;
}

/**
 * Confirmation for a reversible action — deactivate, reactivate, and anything
 * else that changes what an object can be used for without destroying it.
 *
 * Deliberately NOT ConfirmDeleteModal. That one is red, says "this cannot be
 * undone" and defaults to a cascade; wearing it for "switch this account off"
 * would teach you to dismiss the red dialog, which is the one that matters.
 *
 * The `points` list is the whole reason this exists: the risk with deactivation
 * is not that it is dangerous, it is that nobody knows what it does. Each point
 * states one consequence, with the qualifier under it in small italics.
 */
export function ConfirmActionModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle,
  icon,
  headline,
  points = [],
  confirmLabel = "Confirm",
  tone = "neutral",
  busy = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  /** The record being acted on — name, balance, whatever identifies it. */
  headline?: React.ReactNode;
  points?: ConfirmPoint[];
  confirmLabel?: string;
  /** `warn` tints the confirm button brass; nothing here is ever destructive-red. */
  tone?: "neutral" | "warn";
  busy?: boolean;
}) {
  const [working, setWorking] = React.useState(false);

  const handleConfirm = async () => {
    setWorking(true);
    try {
      await onConfirm();
    } finally {
      setWorking(false);
    }
  };

  const isBusy = busy || working;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={icon}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          {/* The shared Button, so every modal footer is one 36px control row. */}
          <Button
            type="button"
            variant={tone === "warn" ? "brass" : "primary"}
            onClick={handleConfirm}
            isLoading={isBusy}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {headline && (
          <div className="bg-surface-subtle border-border rounded-card border p-3.5">
            {headline}
          </div>
        )}

        {points.length > 0 && (
          <ul className="space-y-2.5">
            {points.map((p, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="text-brass-strong mt-0.5 shrink-0">{p.icon}</span>
                <span className="min-w-0">
                  <span className="text-foreground-2 block text-[12.5px] leading-snug">
                    {p.label}
                  </span>
                  {p.detail && (
                    <span className="text-faint mt-0.5 block text-[11px] italic leading-snug">
                      {p.detail}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
