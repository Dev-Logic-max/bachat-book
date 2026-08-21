"use client";

import * as React from "react";
import { HandCoins, Info } from "lucide-react";

import { accountSelectOptions, type AccountWithInstitution } from "@/components/account-options";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { RichSelect } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import type { Contact } from "@/lib/contacts";
import { DEBT_KINDS, type Debt } from "@/lib/debts";
import { createDebt, updateDebt } from "@/lib/debt-actions";
import { formatPKR } from "@/lib/format";
import { todayISO } from "@/lib/ledger";
import { checkFunds } from "@/lib/module-ledger";
import { createClient } from "@/lib/supabase/client";
import type { DebtDirection, DebtKind } from "@/lib/supabase/types";

/** Sentinel for "this person is not in my contacts", so the name is typed instead. */
const NO_CONTACT = "__none__";
/** Sentinel for "this never touched an account". */
const NO_ACCOUNT = "__none__";

/**
 * Record money lent or borrowed, and correct it afterwards.
 *
 * The DIRECTION is the first question and the loudest control, because it is
 * the only one that cannot be inferred and the only one that changes what every
 * other field means: which way the account moves, and whether a lock on that
 * account should block it. It is fixed once saved — flipping a loan into a
 * borrowing would reverse a real ledger row and turn money you are owed into
 * money you owe, which is a new debt, not an edit.
 *
 * EVERYTHING ELSE IS EDITABLE, including the amount and the account. Those two
 * used to be add-only, so correcting a typo meant deleting the debt and losing
 * every repayment recorded against it, and a loan logged without an account
 * could never be attached to one. `updateDebt` moves the opening transfer with
 * the record, so the pair can never hold two different values for one fact.
 */
export function DebtModal({
  isOpen,
  onClose,
  onSaved,
  householdId,
  contacts,
  accounts,
  debt,
  /** Which account the existing opening leg sits on, when there is one. */
  openingAccountId = null,
  initialDirection = "owed_to_us",
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  householdId: string;
  contacts: Contact[];
  accounts: AccountWithInstitution[];
  /** Null for a new debt. */
  debt: Debt | null;
  openingAccountId?: string | null;
  initialDirection?: DebtDirection;
}) {
  const supabase = createClient();
  const { showToast } = useToast();
  const isEdit = Boolean(debt);

  const [direction, setDirection] = React.useState<DebtDirection>(initialDirection);
  const [contactId, setContactId] = React.useState(NO_CONTACT);
  const [typedName, setTypedName] = React.useState("");
  const [kind, setKind] = React.useState<DebtKind>("qarz");
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState(todayISO());
  const [dueDate, setDueDate] = React.useState("");
  const [accountId, setAccountId] = React.useState(NO_ACCOUNT);
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  // Re-seed per opening. The component stays mounted between openings, so a
  // state initialiser cannot do this and React Compiler rejects setState in an
  // effect.
  const seedKey = `${isOpen}:${debt?.id ?? "new"}:${initialDirection}:${openingAccountId ?? ""}`;
  const [seeded, setSeeded] = React.useState(seedKey);
  if (seeded !== seedKey) {
    setSeeded(seedKey);
    if (isOpen) {
      setDirection(debt?.direction ?? initialDirection);
      setContactId(debt?.contact_id ?? NO_CONTACT);
      setTypedName(debt && !debt.contact_id ? debt.counterparty_name : "");
      setKind(debt?.kind ?? "qarz");
      setAmount(debt ? String(Number(debt.principal_paisa) / 100) : "");
      // `opened_on`, not `created_at` — the day the money changed hands, which
      // is not the day somebody got round to typing it in.
      setDate(debt?.opened_on ?? todayISO());
      setDueDate(debt?.due_date ?? "");
      setAccountId(openingAccountId ?? NO_ACCOUNT);
      setNote(debt?.note ?? "");
    }
  }

  const paisa = Math.round((parseFloat(amount) || 0) * 100);
  const chosenContact = contacts.find((c) => c.id === contactId) ?? null;
  const resolvedName = chosenContact?.name ?? typedName.trim();
  const resolvedAccountId = accountId === NO_ACCOUNT ? null : accountId;

  // A lock only bites on the way OUT. Lending money leaves the account, so it
  // is checked as an expense; borrowing arrives, so it is checked as income.
  const moneyDirection = direction === "owed_to_us" ? "expense" : "income";

  /*
   * Can the account afford it?
   *
   * Only lending can fail. On an EDIT the account is already carrying the old
   * leg, so what is being asked for is the DIFFERENCE — raising a Rs 5,000 loan
   * to Rs 6,000 needs Rs 1,000 more, not a fresh Rs 6,000, and treating it as
   * the latter would refuse edits the account can plainly afford.
   *
   * The database enforces this too, in `assert_account_has_funds`. This is the
   * sentence; that is the protection.
   */
  const selectedAccount = accounts.find((a) => a.id === resolvedAccountId);
  const alreadyOnThisAccount = isEdit && openingAccountId === resolvedAccountId;
  const funds = checkFunds(
    selectedAccount,
    direction === "owed_to_us" ? -paisa : paisa,
    alreadyOnThisAccount ? -Number(debt?.principal_paisa ?? 0) : 0,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resolvedName) {
      showToast({
        type: "error",
        title: "Who is this?",
        description: "Pick a contact, or type their name.",
      });
      return;
    }
    if (paisa <= 0) {
      showToast({
        type: "error",
        title: "How much?",
        description: "An amount greater than zero is needed.",
      });
      return;
    }
    if (funds.message) {
      showToast({ type: "error", title: "Not enough in that account", description: funds.message });
      return;
    }

    setSubmitting(true);
    try {
      if (debt) {
        await updateDebt(supabase, debt, {
          counterpartyName: resolvedName,
          contactId: contactId === NO_CONTACT ? null : contactId,
          kind,
          principalPaisa: paisa,
          openedOn: date,
          dueDate: dueDate || null,
          note: note.trim() || null,
          accountId: resolvedAccountId,
        });
        showToast({
          type: "success",
          title: "Saved",
          description: resolvedAccountId
            ? "The account entry was moved to match."
            : "Tracked only — no account balance is involved.",
        });
      } else {
        await createDebt(supabase, {
          householdId,
          contactId: contactId === NO_CONTACT ? null : contactId,
          counterpartyName: resolvedName,
          direction,
          kind,
          principalPaisa: paisa,
          date,
          dueDate: dueDate || null,
          note: note.trim() || null,
          accountId: resolvedAccountId,
        });
        showToast({
          type: "success",
          title: direction === "owed_to_us" ? "Loan recorded" : "Borrowing recorded",
          description: resolvedAccountId
            ? `${formatPKR(paisa)} — your balance moved, your spending did not.`
            : "Tracked only — no account balance was touched.",
        });
      }
      onSaved();
      onClose();
    } catch (error) {
      showToast({
        type: "error",
        title: "Could not save",
        description: error instanceof Error ? error.message : "Something went wrong.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit debt" : direction === "owed_to_us" ? "Lend money" : "Record borrowing"}
      subtitle={
        isEdit
          ? "Changing the amount or the account moves the entry in your accounts with it."
          : "Your balance moves. Your spending figures do not."
      }
      icon={<HandCoins size={18} />}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={submitting}>
            {isEdit ? "Save changes" : "Record it"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* ---- Direction: the question everything else depends on ----------
            Fixed after saving. Flipping it would reverse a real ledger row and
            turn money you are owed into money you owe — a different debt, not
            an edit to this one. */}
        {!isEdit && (
          <div>
            <span className="text-foreground-2 mb-1.5 block text-xs font-medium">
              Which way is the money going?
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(["owed_to_us", "owed_by_us"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  aria-pressed={direction === d}
                  className={
                    direction === d
                      ? "border-navy-900 bg-navy-900 text-on-navy rounded-control border px-3 py-2.5 text-[12.5px] font-semibold"
                      : "border-border bg-surface-subtle text-foreground-2 hover:border-navy-900/30 rounded-control border px-3 py-2.5 text-[12.5px] font-medium transition-colors"
                  }
                >
                  {d === "owed_to_us" ? "I am lending" : "I am borrowing"}
                  <span className="mt-0.5 block text-[10.5px] font-normal opacity-70">
                    {d === "owed_to_us" ? "Money leaves me" : "Money comes to me"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ---- Who ---------------------------------------------------------- */}
        <RichSelect
          label={direction === "owed_to_us" ? "Who are you lending to?" : "Who are you borrowing from?"}
          value={contactId}
          onChange={setContactId}
          searchable={contacts.length >= 8}
          options={[
            {
              value: NO_CONTACT,
              label: "Not in my contacts",
              description: "Type their name instead",
            },
            ...contacts.map((c) => ({
              value: c.id,
              label: c.name,
              description: c.phone ?? undefined,
              avatarUrl: c.avatar_url,
            })),
          ]}
        />

        {contactId === NO_CONTACT && (
          <Input
            label="Their name"
            placeholder="e.g. Ahmed bhai"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            hint="Saved on the debt itself, so it survives even if you later delete the contact."
            required
          />
        )}

        {/* ---- How much and when -------------------------------------------- */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Amount (PKR)"
            type="number"
            step="any"
            min="0"
            inputMode="decimal"
            placeholder="e.g. 5000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="tnum"
            required
          />
          <DatePicker
            label={direction === "owed_to_us" ? "Lent on" : "Borrowed on"}
            value={date}
            onChange={setDate}
            max={todayISO()}
          />
        </div>

        <RichSelect
          label="What kind of arrangement?"
          value={kind}
          onChange={(v) => setKind(v as DebtKind)}
          options={DEBT_KINDS.map((k) => ({
            value: k.key,
            label: k.label,
            secondaryLabel: k.labelUr,
            description: k.hint,
          }))}
        />

        {/* ---- Which account ------------------------------------------------ */}
        <RichSelect
          label={
            direction === "owed_to_us"
              ? "Which account did the money come from?"
              : "Which account did the money arrive in?"
          }
          value={accountId}
          onChange={setAccountId}
          searchable={accounts.length >= 8}
          options={[
            {
              value: NO_ACCOUNT,
              label: "No account — just track it",
              description: "Money that changed hands before you started using the app",
            },
            ...accountSelectOptions(accounts, { direction: moneyDirection }),
          ]}
          hint={
            isEdit
              ? openingAccountId
                ? "Changing this moves the existing entry to the other account. Clearing it removes the entry and puts the balance back."
                : "This debt has no entry in your accounts. Naming one now writes it, dated the day above."
              : undefined
          }
        />

        {/* The one thing the dropdown cannot say: that the account is short.
            Shown live rather than on submit, because the fix is to pick a
            different account and that choice is right here. */}
        {funds.message && (
          <p className="border-loss/25 bg-loss/8 text-loss rounded-control flex items-start gap-2 border px-3 py-2.5 text-[11.5px] leading-relaxed">
            <Info size={14} className="mt-px shrink-0" />
            <span>{funds.message}</span>
          </p>
        )}

        <DatePicker
          label="Due date"
          value={dueDate}
          onChange={setDueDate}
          hint="Optional. A qarz between family usually has none — leave it empty and it simply never goes overdue."
        />

        <Input
          label="Note"
          placeholder="e.g. for his daughter's school fees"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {/*
          Said plainly, on the screen, because it is the single most surprising
          thing about this feature and the reason it is built the way it is.
        */}
        {!isEdit && (
          <p className="border-border bg-surface-subtle text-foreground-2 rounded-control border px-3 py-2 text-[11.5px] leading-snug">
            {direction === "owed_to_us"
              ? "This is not spending. Your account balance drops, but your money-out figures, budgets and reports stay exactly where they are — you still own this money."
              : "This is not income. Your account balance rises, but your money-in figures stay where they are — this money is not yours to keep."}
          </p>
        )}
      </div>
    </Modal>
  );
}
