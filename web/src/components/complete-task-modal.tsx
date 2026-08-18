"use client";

import * as React from "react";
import { ArrowRight, CheckCircle2, ListChecks, Wallet2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichSelect } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { CategoryPicker } from "@/components/category-picker";
import { useHiddenCategoryIds } from "@/lib/use-hidden-categories";
import { useSession } from "@/components/session-provider";
import { accountSelectOptions } from "@/components/account-options";
import type { AccountWithInstitution } from "@/components/account-options";
import { todayISO } from "@/lib/ledger";
import { orderedItems, subtaskTotalPaisa } from "@/lib/tasks";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { SettleInput } from "@/lib/task-actions";
import type { SelectOption } from "@/components/ui/select";
import type { TaskWithChecklist } from "@/lib/tasks";
import type { Tables } from "@/lib/supabase/types";

/**
 * The moment a to-do becomes money.
 *
 * Ticking a paid task writes a REAL ledger entry that moves a REAL balance, so
 * it cannot be a one-click toggle — but it also must not be a second trip to the
 * Entries form, or nobody will use the feature. This dialog is the middle: it
 * arrives pre-filled from the task, and the ordinary month is one confirm.
 *
 * THREE FIELDS AND A DATE, nothing else. It used to repeat the direction toggle
 * and the recurrence explainer from the create form, which is asking again about
 * decisions that were already made and cannot sensibly change at the till:
 * whether this is money in or money out is a property of the task, and when the
 * next one appears is driven by the calendar rather than by this click. What is
 * genuinely unknown until now is the amount, the account it left, and the label.
 */
export function CompleteTaskModal({
  isOpen,
  onClose,
  onConfirm,
  task,
  accounts,
  categories,
  busy = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** `null` for an unpaid task — nothing is written to the ledger. */
  onConfirm: (settle: SettleInput | null) => Promise<void> | void;
  task: TaskWithChecklist | null;
  accounts: AccountWithInstitution[];
  categories: Tables<"categories">[];
  busy?: boolean;
}) {
  const session = useSession();
  // Catalogue order, this household's pruning, and the active language all come
  // from one place so every picker in the app agrees with the others.
  const hiddenCategoryIds = useHiddenCategoryIds(session.household?.id);

  const [amount, setAmount] = React.useState("");
  const [accountId, setAccountId] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [date, setDate] = React.useState(todayISO());

  /*
   * Prices entered against the subtasks win over the saved estimate.
   *
   * Eggs 230, oil 520, tissue 110 was typed one item at a time as the trolley
   * filled; opening on the original guess of 900 would throw away the only
   * figures anyone actually measured.
   */
  const subtaskTotal = task ? subtaskTotalPaisa(task) : null;

  // Re-seed each time a different task is confirmed. The component stays mounted
  // between openings, so a state initialiser cannot do this, and React Compiler
  // bans a synchronous setState in an effect.
  const seedKey = `${isOpen}:${task?.id ?? "none"}:${subtaskTotal ?? ""}`;
  const [seeded, setSeeded] = React.useState(seedKey);
  if (seeded !== seedKey) {
    setSeeded(seedKey);
    if (isOpen && task) {
      const seedPaisa = subtaskTotal ?? task.amount_paisa;
      setAmount(seedPaisa ? String(Number(seedPaisa) / 100) : "");
      setAccountId(task.account_id ?? "");
      setCategoryId(task.category_id ?? "");
      setDate(todayISO());
    }
  }

  const cashAccountId = React.useMemo(
    () =>
      accounts.find((a) => a.type === "cash" && !a.is_archived && !a.deleted_at)?.id ??
      "",
    [accounts],
  );
  // Derived, never stored — an effect that set this once accounts arrived would
  // be a synchronous setState in useEffect.
  const effectiveAccountId = accountId || cashAccountId;

  // Money in or money out was settled when the task was created. It is shown
  // here as a fact, not offered as a choice.
  const direction = task?.direction ?? "expense";

  const accountOptions: SelectOption[] = React.useMemo(
    () => accountSelectOptions(accounts, { direction }),
    [accounts, direction],
  );

  // A category from the other kind is meaningless — the kinds are disjoint sets
  // in the database. Derived during render, not reset in an effect.
  const chosenCategory = categories.find((c) => c.id === categoryId);
  const effectiveCategoryId = chosenCategory?.kind === direction ? categoryId : "";

  if (!task) return null;

  const paisa = Math.round((parseFloat(amount) || 0) * 100);
  const account = accounts.find((a) => a.id === effectiveAccountId);
  const balanceNow = account ? Number(account.balance_paisa) : 0;
  const balanceAfter = balanceNow + (direction === "income" ? paisa : -paisa);
  const wouldOverdraw = direction === "expense" && balanceAfter < 0;

  const pricedItems = orderedItems(task).filter(
    (i) => i.amount_paisa !== null && i.amount_paisa !== undefined,
  );

  const canConfirm = !task.is_paid || (paisa > 0 && Boolean(effectiveAccountId));

  const handleConfirm = async () => {
    if (!task.is_paid) {
      await onConfirm(null);
      return;
    }
    await onConfirm({
      amountPaisa: paisa,
      direction,
      accountId: effectiveAccountId,
      categoryId: effectiveCategoryId || null,
      date,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={task.is_paid ? "Complete and record payment" : "Complete this task?"}
      subtitle={task.title}
      icon={<CheckCircle2 size={16} />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleConfirm}
            isLoading={busy}
            disabled={!canConfirm}
          >
            {task.is_paid ? `Confirm ${formatPKR(paisa)}` : "Mark complete"}
          </Button>
        </>
      }
    >
      {!task.is_paid ? (
        <p className="text-muted text-[12.5px] leading-snug">
          This task does not move money, so nothing will be written to your
          ledger. It just moves to Completed.
        </p>
      ) : (
        <div className="space-y-4">
          {/*
            The prices already collected, before the field they add up to. Shown
            only when subtasks were priced — otherwise it is an empty box
            explaining a feature nobody used on this task.
          */}
          {pricedItems.length > 0 && (
            <section className="border-border overflow-hidden rounded-card border">
              <header className="bg-surface-subtle border-border flex items-center gap-2 border-b px-3 py-2">
                <ListChecks size={12} className="text-brass-strong shrink-0" />
                <span className="text-foreground-2 text-[11.5px] font-medium">
                  From your subtasks
                </span>
                <span className="tnum text-foreground ms-auto text-[12px] font-semibold">
                  {formatPKR(subtaskTotal ?? 0)}
                </span>
              </header>
              <ul className="divide-border divide-y">
                {pricedItems.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between gap-3 px-3 py-1.5"
                  >
                    <span className="text-foreground-2 min-w-0 truncate text-[11.5px]">
                      {i.title}
                    </span>
                    <span className="tnum text-muted shrink-0 text-[11.5px]">
                      {formatPKR(Number(i.amount_paisa))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={direction === "income" ? "Amount received (PKR)" : "Amount paid (PKR)"}
              type="number"
              step="any"
              min="0"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="tnum"
              autoFocus
              required
              hint={
                subtaskTotal !== null
                  ? "Totalled from your subtasks — change it if the till said otherwise."
                  : undefined
              }
            />
            <DatePicker
              label={direction === "income" ? "Date received" : "Date paid"}
              value={date}
              onChange={setDate}
              max={todayISO()}
              required
            />
          </div>

          <RichSelect
            label={direction === "income" ? "Received into" : "Paid from"}
            value={effectiveAccountId}
            onChange={setAccountId}
            options={accountOptions}
            placeholder={accounts.length === 0 ? "Loading…" : "Choose an account"}
            emptyMessage="Add an account first"
            error={wouldOverdraw ? "This would take the account below zero." : undefined}
          />

          <CategoryPicker
            value={effectiveCategoryId}
            onChange={setCategoryId}
            categories={categories}
            kind={direction}
            householdId={session.household?.id ?? ""}
            hiddenIds={hiddenCategoryIds}
          />

          {/* The consequence, in one line, before the click. */}
          {paisa > 0 && account && (
            <div className="bg-surface-subtle border-border flex items-center gap-2.5 rounded-card border p-3">
              <Wallet2 size={14} className="text-brass-strong shrink-0" />
              <span className="text-foreground-2 min-w-0 text-[12px]">
                <span className="font-medium">{account.name}</span>{" "}
                <span className="tnum">{formatPKR(balanceNow)}</span>
                <ArrowRight size={11} className="mx-1 inline shrink-0" />
                <span
                  className={cn(
                    "tnum font-semibold",
                    wouldOverdraw ? "text-loss" : "text-foreground",
                  )}
                >
                  {formatPKR(balanceAfter)}
                </span>
              </span>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
