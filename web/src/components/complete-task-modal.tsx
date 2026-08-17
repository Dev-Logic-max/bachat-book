"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import {
  ArrowRight,
  CheckCircle2,
  Info,
  Repeat,
  Wallet2,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichSelect } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { CategoryIcon, categoryLabel } from "@/components/category-icon";
import { useHiddenCategoryIds } from "@/lib/use-hidden-categories";
import { useSession } from "@/components/session-provider";
import { accountSelectOptions } from "@/components/account-options";
import type { AccountWithInstitution } from "@/components/account-options";
import { groupCategories, todayISO } from "@/lib/ledger";
import { REPEAT_LABEL, nextDueDate } from "@/lib/tasks";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { SettleInput } from "@/lib/task-actions";
import type { SelectOption } from "@/components/ui/select";
import type { Task } from "@/lib/tasks";
import type { MovementDirection, Tables } from "@/lib/supabase/types";

/**
 * The moment a to-do becomes money.
 *
 * Ticking a paid task writes a REAL ledger entry that moves a REAL balance, so
 * it cannot be a one-click toggle — but it also must not be a second trip to the
 * Entries form, or nobody will use the feature. This dialog is the middle: it
 * arrives pre-filled from the task, and the ordinary month is one confirm.
 *
 * Everything is editable, because the estimate on a bill is rarely what the bill
 * says and the account you meant to pay from is rarely the one you had on you.
 * Whatever you settle on is folded back onto the task, so next month's estimate
 * is last month's actual rather than the original guess.
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
  task: Task | null;
  accounts: AccountWithInstitution[];
  categories: Tables<"categories">[];
  busy?: boolean;
}) {
  const session = useSession();
  // Catalogue order, this household's pruning, and the active language all come
  // from one place so every picker in the app agrees with the others.
  const locale = useLocale();
  const hiddenCategoryIds = useHiddenCategoryIds(session.household?.id);

  const [amount, setAmount] = React.useState("");
  const [direction, setDirection] = React.useState<MovementDirection>("expense");
  const [accountId, setAccountId] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [date, setDate] = React.useState(todayISO());

  // Re-seed each time a different task is confirmed. The component stays mounted
  // between openings, so a state initialiser cannot do this, and React Compiler
  // bans a synchronous setState in an effect.
  const seedKey = `${isOpen}:${task?.id ?? "none"}`;
  const [seeded, setSeeded] = React.useState(seedKey);
  if (seeded !== seedKey) {
    setSeeded(seedKey);
    if (isOpen && task) {
      setAmount(task.amount_paisa ? String(task.amount_paisa / 100) : "");
      setDirection(task.direction ?? "expense");
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

  const accountOptions: SelectOption[] = React.useMemo(
    () => accountSelectOptions(accounts, { direction }),
    [accounts, direction],
  );

  const categoryOptions: SelectOption[] = React.useMemo(
    () =>
      groupCategories(categories, direction, {
      hiddenIds: hiddenCategoryIds,
      locale,
    }).map(({ category, groupLabel }) => ({
        value: category.id,
        label: categoryLabel(category, locale),
        group: groupLabel,
        icon: <CategoryIcon icon={category.icon} size={15} />,
      })),
    [categories, direction, hiddenCategoryIds, locale],
  );
  const categoryStillValid = categoryOptions.some((o) => o.value === categoryId);
  const effectiveCategoryId = categoryStillValid ? categoryId : "";

  if (!task) return null;

  const paisa = Math.round((parseFloat(amount) || 0) * 100);
  const account = accounts.find((a) => a.id === effectiveAccountId);
  const balanceNow = account ? Number(account.balance_paisa) : 0;
  const balanceAfter =
    balanceNow + (direction === "income" ? paisa : -paisa);
  const wouldOverdraw = direction === "expense" && balanceAfter < 0;

  const nextDue =
    task.repeat_rule !== "none" ? nextDueDate(task.due_date, task.repeat_rule) : null;

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
      <div className="space-y-4">
        {!task.is_paid ? (
          <p className="text-muted text-[12.5px] leading-snug">
            This task does not move money, so nothing will be written to your
            ledger. It just moves to Completed.
          </p>
        ) : (
          <>
            <p className="text-faint text-[11.5px] italic leading-snug">
              Confirming writes one entry into your ledger and moves the balance
              below. Adjust anything that differs from the estimate — what you
              confirm here becomes next time&apos;s estimate.
            </p>

            <div className="bg-surface-subtle grid grid-cols-2 gap-1 rounded-control p-1">
              {(["expense", "income"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  aria-pressed={direction === d}
                  className={cn(
                    "rounded-control py-1.5 text-xs font-medium capitalize transition-colors",
                    direction === d
                      ? "bg-surface text-foreground shadow-xs"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  {d === "expense" ? "Paid out" : "Received"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Amount actually paid (PKR)"
                type="number"
                step="any"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="tnum"
                autoFocus
                required
              />
              <DatePicker
                label="Date paid"
                value={date}
                onChange={setDate}
                max={todayISO()}
                required
              />
            </div>

            <RichSelect
              label="Paid from"
              value={effectiveAccountId}
              onChange={setAccountId}
              options={accountOptions}
              placeholder={accounts.length === 0 ? "Loading…" : "Choose an account"}
              emptyMessage="Add an account first"
              error={wouldOverdraw ? "This would take the account below zero." : undefined}
              hint={
                account && paisa > 0
                  ? `${formatPKR(balanceNow)} → ${formatPKR(balanceAfter)} after this`
                  : "Defaults to cash — every entry moves an account."
              }
            />

            <RichSelect
              label="Category"
              value={effectiveCategoryId}
              onChange={setCategoryId}
              options={categoryOptions}
              placeholder="Choose a category"
              emptyMessage="No categories for this direction"
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
          </>
        )}

        {/*
          What happens next, said out loud. A task quietly reappearing next month
          is delightful only if you were told it would.
        */}
        {nextDue && (
          <div className="border-border flex items-start gap-2.5 rounded-card border p-3">
            <Repeat size={14} className="text-brass-strong mt-0.5 shrink-0" />
            <span className="min-w-0">
              <span className="text-foreground-2 block text-[12px]">
                {REPEAT_LABEL[task.repeat_rule]} — the next one is due{" "}
                <span className="ltr font-medium">{nextDue}</span>.
              </span>
              <span className="text-faint mt-0.5 block text-[11px] italic leading-snug">
                It appears on the board on its own schedule, a few days before it
                is due. Completing this one does not bring it forward.
              </span>
            </span>
          </div>
        )}

        {task.is_paid && !task.amount_paisa && (
          <p className="text-faint flex items-start gap-1.5 text-[11px] italic leading-snug">
            <Info size={12} className="mt-0.5 shrink-0" />
            This task had no estimate saved, so the amount starts empty. What you
            enter now is remembered.
          </p>
        )}
      </div>
    </Modal>
  );
}
