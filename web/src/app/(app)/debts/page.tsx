"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  BookUser,
  CalendarClock,
  Check,
  HandCoins,
  History,
  Landmark,
  Plus,
  Search,
  Undo2,
  Wallet,
} from "lucide-react";

import type { AccountWithInstitution } from "@/components/account-options";
import { ConfirmActionModal } from "@/components/confirm-action-modal";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { DebtDetailModal } from "@/components/debt-detail-modal";
import { DebtModal } from "@/components/debt-modal";
import { DebtPaymentModal } from "@/components/debt-payment-modal";
import { EmptyState } from "@/components/empty-state";
import { LedgerRefChip } from "@/components/ledger-ref-chip";
import { LinkToAccountModal } from "@/components/link-to-account-modal";
import { PageActions } from "@/components/page-actions";
import { Reveal } from "@/components/reveal";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichSelect } from "@/components/ui/select";
import { RowActions } from "@/components/ui/row-actions";
import { useToast } from "@/components/ui/toast";
import type { Contact } from "@/lib/contacts";
import {
  DIRECTION_ACTION,
  DIRECTION_LABEL,
  compareDebts,
  debtKind,
  dueTone,
  isFullyRepaid,
  matchesDebt,
  outstandingPaisa,
  overpaidByPaisa,
  repaidFraction,
  repaidPaisa,
  summariseDebts,
  withPayments,
  type Debt,
  type DebtPayment,
  type DebtWithPayments,
} from "@/lib/debts";
import {
  deleteDebt,
  deletePayment,
  setDebtStatus,
  updateDebt,
  updateDebtPayment,
} from "@/lib/debt-actions";
import { formatPKR } from "@/lib/format";
import { ledgerRefFor } from "@/lib/module-ledger";
import { createClient } from "@/lib/supabase/client";
import { dueLabel } from "@/lib/tasks";
import type { DebtDirection } from "@/lib/supabase/types";

/**
 * The ledger rows this page's records point at.
 *
 * A debt stores `opening_transaction_id` and a payment stores `transaction_id`,
 * but neither carries the row's own DATE or ACCOUNT — and both are needed:
 * the date because a deep link into Entries or Transactions must name the month,
 * and the account because the edit forms now offer to move it.
 */
type LedgerRow = { id: string; date: string; type: string; account_id: string };

/** Lucide name → component, so `lib/debts.ts` stays JSX-free. */
const KIND_ICON: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  HandCoins,
  BookUser,
  Landmark,
};

export default function DebtsPage() {
  const session = useSession();
  const supabase = createClient();
  const { showToast } = useToast();

  const householdId = session.household?.id || "";
  const readOnly = session.workspace ? !session.workspace.is_active : false;

  const [debts, setDebts] = React.useState<Debt[]>([]);
  const [payments, setPayments] = React.useState<DebtPayment[]>([]);
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [accounts, setAccounts] = React.useState<AccountWithInstitution[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("open");

  const [adding, setAdding] = React.useState<DebtDirection | null>(null);
  const [editing, setEditing] = React.useState<Debt | null>(null);
  const [paying, setPaying] = React.useState<DebtWithPayments | null>(null);
  const [editingPayment, setEditingPayment] = React.useState<{
    debt: DebtWithPayments;
    payment: DebtPayment;
  } | null>(null);
  const [deletingPayment, setDeletingPayment] = React.useState<{
    debt: DebtWithPayments;
    payment: DebtPayment;
  } | null>(null);
  const [deleting, setDeleting] = React.useState<DebtWithPayments | null>(null);
  const [writingOff, setWritingOff] = React.useState<DebtWithPayments | null>(null);
  const [viewing, setViewing] = React.useState<DebtWithPayments | null>(null);
  const [ledgerRows, setLedgerRows] = React.useState<Record<string, LedgerRow>>({});
  /** Which record is being given a ledger entry it never got. */
  const [linking, setLinking] = React.useState<
    { debt: DebtWithPayments; payment: DebtPayment | null } | null
  >(null);

  React.useEffect(() => {
    let active = true;
    if (!householdId) return;

    async function load() {
      const [debtRes, paymentRes, contactRes, accountRes] = await Promise.all([
        supabase.from("debts").select("*").eq("household_id", householdId),
        supabase.from("debt_payments").select("*").eq("household_id", householdId).order("date"),
        supabase.from("contacts").select("*").eq("household_id", householdId).order("name"),
        supabase
          .from("accounts")
          .select("*, institutions(*)")
          .eq("household_id", householdId)
          .is("deleted_at", null)
          .eq("is_archived", false)
          .order("name"),
      ]);

      if (!active) return;

      // Surface `error` separately from "no rows" — a real failure must never
      // wear the empty state's clothes.
      const firstError =
        debtRes.error || paymentRes.error || contactRes.error || accountRes.error;
      if (firstError) {
        setLoadError(firstError.message);
        setLoading(false);
        return;
      }

      setDebts(debtRes.data ?? []);
      setPayments(paymentRes.data ?? []);
      setContacts(contactRes.data ?? []);
      // `as unknown as` because the hand-written types do not declare the
      // accounts→institutions embed, exactly as the Entries page does.
      setAccounts((accountRes.data ?? []) as unknown as AccountWithInstitution[]);
      setLoadError(null);
      setLoading(false);

      /*
       * The ledger rows behind these records, fetched second because their ids
       * only exist once the debts and payments are back. Scoped by household as
       * well as by id — RLS already does that, and saying it here means a
       * mismatched id can never read across a tenant boundary.
       */
      const ids = [
        ...(debtRes.data ?? []).map((d) => d.opening_transaction_id),
        ...(paymentRes.data ?? []).map((p) => p.transaction_id),
      ].filter((id): id is string => Boolean(id));

      if (ids.length === 0) {
        setLedgerRows({});
        return;
      }

      const { data: rows } = await supabase
        .from("transactions")
        .select("id, date, type, account_id")
        .eq("household_id", householdId)
        .in("id", ids);

      if (!active) return;
      setLedgerRows(
        Object.fromEntries(((rows ?? []) as LedgerRow[]).map((r) => [r.id, r])),
      );
    }

    load();
    return () => {
      active = false;
    };
  }, [householdId, refreshKey, supabase]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const all = React.useMemo(() => withPayments(debts, payments), [debts, payments]);
  const totals = React.useMemo(() => summariseDebts(all), [all]);

  const visible = React.useMemo(
    () =>
      all
        .filter((d) => (statusFilter === "all" ? true : d.status === statusFilter))
        .filter((d) => matchesDebt(d, query))
        .sort(compareDebts),
    [all, statusFilter, query],
  );

  const owedToUs = visible.filter((d) => d.direction === "owed_to_us");
  const owedByUs = visible.filter((d) => d.direction === "owed_by_us");

  const handleSettle = async (debt: DebtWithPayments) => {
    try {
      await setDebtStatus(supabase, debt.id, "settled");
      showToast({
        type: "success",
        title: "Marked settled",
        description: `${debt.counterparty_name} is squared up.`,
      });
      refresh();
    } catch (error) {
      showToast({
        type: "error",
        title: "Could not settle it",
        description: error instanceof Error ? error.message : "Something went wrong.",
      });
    }
  };

  const handleReopen = async (debt: DebtWithPayments) => {
    try {
      await setDebtStatus(supabase, debt.id, "open");
      showToast({ type: "success", title: "Reopened", description: "It is back on the list." });
      refresh();
    } catch (error) {
      showToast({
        type: "error",
        title: "Could not reopen it",
        description: error instanceof Error ? error.message : "Something went wrong.",
      });
    }
  };

  const handleWriteOff = async () => {
    if (!writingOff) return;
    try {
      await setDebtStatus(supabase, writingOff.id, "written_off");
      showToast({
        type: "success",
        title: "Written off",
        description: "Every row is kept and no balance moved.",
      });
      setWritingOff(null);
      refresh();
    } catch (error) {
      showToast({
        type: "error",
        title: "Could not write it off",
        description: error instanceof Error ? error.message : "Something went wrong.",
      });
    }
  };

  const handleDeletePayment = async () => {
    if (!deletingPayment) return;
    const { payment } = deletingPayment;
    try {
      await deletePayment(supabase, payment);
      showToast({
        type: "success",
        title: "Repayment removed",
        description: payment.transaction_id
          ? "The ledger entry it wrote went with it, and the balance is back."
          : "It never touched an account, so no balance changed.",
      });
      setDeletingPayment(null);
      refresh();
    } catch (error) {
      showToast({
        type: "error",
        title: "Could not remove it",
        description: error instanceof Error ? error.message : "Something went wrong.",
      });
    }
  };

  const handleDeleteDebt = async (cascade: boolean) => {
    if (!deleting) return;
    try {
      await deleteDebt(supabase, deleting, cascade);
      showToast({
        type: "success",
        title: "Debt deleted",
        description: cascade
          ? "The account entries went too, so the balances are back where they were."
          : "The account entries stay — the money really did change hands.",
      });
      setDeleting(null);
      refresh();
    } catch (error) {
      showToast({
        type: "error",
        title: "Could not delete it",
        description: error instanceof Error ? error.message : "Something went wrong.",
      });
    }
  };

  /**
   * Give a record the ledger entry it never got.
   *
   * Routed through the SAME update functions the edit forms use, rather than a
   * shortcut that only knows how to insert. That is what keeps a record with a
   * leg and a record that just grew one indistinguishable afterwards — there is
   * one way for a debt to hold an opening transfer, not two.
   */
  const handleLinkToAccount = async (accountId: string) => {
    if (!linking) return;
    const { debt, payment } = linking;

    if (payment) {
      await updateDebtPayment(supabase, debt, payment, {
        amountPaisa: Number(payment.amount_paisa),
        date: payment.date,
        note: payment.note,
        accountId,
      });
    } else {
      await updateDebt(supabase, debt, {
        counterpartyName: debt.counterparty_name,
        contactId: debt.contact_id,
        kind: debt.kind,
        principalPaisa: Number(debt.principal_paisa),
        openedOn: debt.opened_on,
        dueDate: debt.due_date,
        note: debt.note,
        accountId,
      });
    }

    showToast({
      type: "success",
      title: "Added to your accounts",
      description: `${accounts.find((a) => a.id === accountId)?.name ?? "That account"} now carries this entry.`,
    });
    setLinking(null);
    refresh();
  };

  const nothingRecorded = !loading && debts.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display truncate text-[19px] font-semibold tracking-[-0.02em] sm:text-[22px]">
            Udhaar
          </h1>
          <p className="text-muted mt-0.5 text-[12.5px]">
            Money lent and money borrowed — who owes you, and who you owe.
          </p>
        </div>

        <PageActions
          title="Udhaar"
          actions={[
            {
              label: DIRECTION_ACTION.owed_to_us,
              shortLabel: "Lend",
              hint: "Money going out that is coming back",
              icon: ArrowUpRight,
              tone: "primary",
              disabled: readOnly,
              onClick: () => setAdding("owed_to_us"),
            },
            {
              label: DIRECTION_ACTION.owed_by_us,
              shortLabel: "Borrow",
              hint: "Money coming in that you have to return",
              icon: ArrowDownLeft,
              disabled: readOnly,
              onClick: () => setAdding("owed_by_us"),
            },
          ]}
        />
      </div>

      {loadError && (
        <div className="border-loss/25 bg-loss/8 text-loss rounded-panel border px-4 py-3 text-[12.5px]">
          Could not load your udhaar: {loadError}
        </div>
      )}

      {/* ---- The two running totals ---------------------------------------- */}
      {!nothingRecorded && (
        <Reveal>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TotalTile
              label="Owed to me"
              sublabel="مجھے ملنا ہے"
              amountPaisa={totals.owedToUsPaisa}
              tone="gain"
              icon={<ArrowDownLeft size={13} />}
            />
            <TotalTile
              label="I owe"
              sublabel="مجھے دینا ہے"
              amountPaisa={totals.owedByUsPaisa}
              tone="loss"
              icon={<ArrowUpRight size={13} />}
            />
            <div className="bg-navy-900 rounded-panel flex flex-col justify-center p-5">
              <p className="text-on-navy-muted text-[10px] font-semibold uppercase tracking-widest">
                Net position
              </p>
              <p className="tnum text-on-navy mt-1 text-[22px] font-semibold">
                {totals.netPaisa >= 0 ? "+" : "−"}
                {formatPKR(Math.abs(totals.netPaisa))}
              </p>
              <p className="text-on-navy-muted mt-1 text-[11px]">
                {totals.openCount === 0
                  ? "Nothing outstanding"
                  : `${totals.openCount} open${totals.overdueCount > 0 ? ` · ${totals.overdueCount} overdue` : ""}`}
              </p>
            </div>
          </div>
        </Reveal>
      )}

      {/*
        Said once, at the top, because it is the single most surprising thing
        about this module — and the reason it exists in this shape at all.
      */}
      {!nothingRecorded && (
        <p className="border-border bg-surface-subtle text-foreground-2 rounded-panel border px-4 py-2.5 text-[11.5px] leading-snug">
          Lending is not spending. These amounts move your{" "}
          <Link href="/accounts" className="text-brass-strong underline underline-offset-2">
            account balances
          </Link>{" "}
          but never your money-in, money-out, budgets or reports — you still own
          what you lent.
        </p>
      )}

      {/* ---- Search and filter --------------------------------------------- */}
      {!nothingRecorded && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px]">
          <Input
            placeholder="Search by name or note…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            prefixIcon={<Search size={15} />}
            aria-label="Search udhaar"
          />
          <RichSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "open", label: "Open", description: "Still outstanding" },
              { value: "settled", label: "Settled", description: "Paid off" },
              { value: "written_off", label: "Written off", description: "Given up on" },
              { value: "all", label: "Everything" },
            ]}
          />
        </div>
      )}

      {/* ---- The lists ------------------------------------------------------ */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="bg-surface border-border rounded-panel shimmer h-56 border" />
          ))}
        </div>
      ) : nothingRecorded ? (
        <EmptyState
          title="No udhaar recorded"
          imageSrc="/art/empty-generic.webp"
          description="Lend Rs 5,000 to a cousin and your cash drops — but you have not spent it, you are owed it. Record it here and it stays visible until it comes back."
          action={
            <Button variant="primary" onClick={() => setAdding("owed_to_us")} disabled={readOnly}>
              Record your first loan
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <div className="bg-surface border-border rounded-panel text-muted border p-8 text-center text-xs">
          Nothing matches that.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {(["owed_to_us", "owed_by_us"] as const).map((direction) => (
            <DebtColumn
              key={direction}
              direction={direction}
              debts={direction === "owed_to_us" ? owedToUs : owedByUs}
              readOnly={readOnly}
              ledgerRows={ledgerRows}
              onAdd={() => setAdding(direction)}
              onPay={setPaying}
              onEdit={setEditing}
              onDelete={setDeleting}
              onSettle={handleSettle}
              onReopen={handleReopen}
              onWriteOff={setWritingOff}
              onOpenHistory={setViewing}
              onLink={(debt) => setLinking({ debt, payment: null })}
            />
          ))}
        </div>
      )}

      <DebtModal
        isOpen={adding !== null || editing !== null}
        onClose={() => {
          setAdding(null);
          setEditing(null);
        }}
        onSaved={refresh}
        householdId={householdId}
        contacts={contacts}
        accounts={accounts}
        debt={editing}
        openingAccountId={
          editing?.opening_transaction_id
            ? (ledgerRows[editing.opening_transaction_id]?.account_id ?? null)
            : null
        }
        initialDirection={adding ?? "owed_to_us"}
      />

      <DebtDetailModal
        isOpen={viewing !== null}
        onClose={() => setViewing(null)}
        debt={viewing}
        readOnly={readOnly}
        ledgerRows={ledgerRows}
        onAddPayment={() => {
          setPaying(viewing);
          setViewing(null);
        }}
        onEditPayment={(payment) => {
          if (viewing) setEditingPayment({ debt: viewing, payment });
          setViewing(null);
        }}
        onDeletePayment={(payment) => {
          if (viewing) setDeletingPayment({ debt: viewing, payment });
          setViewing(null);
        }}
        onLinkPayment={(payment) => {
          if (viewing) setLinking({ debt: viewing, payment });
          setViewing(null);
        }}
      />

      <DebtPaymentModal
        isOpen={paying !== null || editingPayment !== null}
        onClose={() => {
          setPaying(null);
          setEditingPayment(null);
        }}
        onSaved={refresh}
        debt={paying ?? editingPayment?.debt ?? null}
        payment={editingPayment?.payment ?? null}
        paymentAccountId={
          editingPayment?.payment.transaction_id
            ? (ledgerRows[editingPayment.payment.transaction_id]?.account_id ?? null)
            : null
        }
        accounts={accounts}
      />

      {/*
        The gap this closes: a debt or a repayment recorded with "no account —
        just track it", which afterwards had no route to an account at all. The
        only fix was to delete it and type it in again, and for a debt that also
        threw away every repayment recorded against it.
      */}
      <LinkToAccountModal
        isOpen={linking !== null}
        onClose={() => setLinking(null)}
        onConfirm={handleLinkToAccount}
        title="Add this to your accounts"
        subtitle={linking?.debt.counterparty_name}
        recordLabel={
          linking
            ? linking.payment
              ? `Repayment · ${debtKind(linking.debt.kind).label}`
              : linking.debt.direction === "owed_to_us"
                ? `Lent to ${linking.debt.counterparty_name}`
                : `Borrowed from ${linking.debt.counterparty_name}`
            : ""
        }
        amountPaisa={
          linking
            ? Number(linking.payment?.amount_paisa ?? linking.debt.principal_paisa)
            : 0
        }
        date={linking ? (linking.payment?.date ?? linking.debt.opened_on) : ""}
        /*
          The direction flips for a repayment: lending money out means the
          opening leg leaves the account, while the repayment coming back
          arrives. Getting this wrong would test a lock on the wrong side and
          check funds on money that is arriving.
        */
        direction={
          linking
            ? linking.payment
              ? linking.debt.direction === "owed_to_us"
                ? "income"
                : "expense"
              : linking.debt.direction === "owed_to_us"
                ? "expense"
                : "income"
            : "expense"
        }
        accounts={accounts}
      />

      {/*
        Deleting one payment names the bank entry it wrote and removes both
        together. This is the gap that made "write off" feel broken: a repayment
        could leave the debt while its Rs 10,000 stayed in the UBL account, with
        nothing on either screen explaining the difference.
      */}
      <ConfirmDeleteModal
        isOpen={deletingPayment !== null}
        onClose={() => setDeletingPayment(null)}
        onConfirm={handleDeletePayment}
        title="Remove this payment?"
        recordLabel={
          deletingPayment
            ? `${formatPKR(Number(deletingPayment.payment.amount_paisa))} · ${deletingPayment.debt.counterparty_name}`
            : ""
        }
        recordMeta={deletingPayment?.payment.date}
        linkedRefs={
          deletingPayment?.payment.transaction_id
            ? [
                {
                  kind: "Account entry",
                  label: `${deletingPayment.debt.direction === "owed_to_us" ? `${deletingPayment.debt.counterparty_name} repaid` : `Repaid ${deletingPayment.debt.counterparty_name}`} · ${formatPKR(Number(deletingPayment.payment.amount_paisa))}`,
                  // Named AND reachable. A dialog that lists what it is about to
                  // destroy but offers no way to look at it asks for the user's
                  // trust rather than their judgement.
                  href: ledgerRefFor(
                    deletingPayment.payment.transaction_id,
                    ledgerRows[deletingPayment.payment.transaction_id]?.date ??
                      deletingPayment.payment.date,
                    "transfer",
                  ).href,
                },
              ]
            : []
        }
        cascadeLabel="Also remove the account entry this created"
        cascadeHint={
          deletingPayment?.payment.transaction_id
            ? "The money moved in your account when this was recorded, so removing the payment removes that entry too and the balance goes back to where it was. Leave it and your bank would keep money the debt no longer accounts for."
            : "This payment never touched an account, so no balance changes."
        }
        confirmLabel="Remove payment"
      />

      <ConfirmDeleteModal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDeleteDebt}
        title="Delete this debt?"
        recordLabel={deleting?.counterparty_name ?? ""}
        recordMeta={
          deleting
            ? `${formatPKR(Number(deleting.principal_paisa))} · ${debtKind(deleting.kind).label}`
            : undefined
        }
        linkedRefs={
          deleting
            ? [
                ...(deleting.opening_transaction_id
                  ? [
                      {
                        kind: "Transaction",
                        label: `The opening entry · ${formatPKR(Number(deleting.principal_paisa))}`,
                        href: ledgerRefFor(
                          deleting.opening_transaction_id,
                          ledgerRows[deleting.opening_transaction_id]?.date ?? deleting.opened_on,
                          "transfer",
                        ).href,
                      },
                    ]
                  : []),
                ...deleting.payments
                  .filter((p) => p.transaction_id)
                  .map((p) => ({
                    kind: "Transaction",
                    label: `Repayment · ${formatPKR(Number(p.amount_paisa))}`,
                    href: ledgerRefFor(
                      p.transaction_id as string,
                      ledgerRows[p.transaction_id as string]?.date ?? p.date,
                      "transfer",
                    ).href,
                  })),
              ]
            : []
        }
        cascadeLabel="Also delete the account entries this created"
        cascadeHint="Checked — the default — the balances go back to where they were, which is right when the debt was recorded by mistake. Unchecked, the entries stay in your accounts: the money really did change hands, and tidying this record must not un-move it."
        confirmLabel="Delete debt"
      />

      {/*
        Giving up on a debt. This replaces the old "Write off" button, which sat
        among ordinary actions and quietly set a status — the debt disappeared
        from the list while its bank entries stayed, which is indistinguishable
        from a delete that half worked. Here it says what it keeps and what it
        does not, and the money is explicitly left alone.
      */}
      <ConfirmActionModal
        isOpen={writingOff !== null}
        onClose={() => setWritingOff(null)}
        onConfirm={handleWriteOff}
        title="Write this off?"
        subtitle="You have stopped expecting this money back."
        icon={<Ban size={18} />}
        headline={
          writingOff
            ? `${writingOff.counterparty_name} · ${formatPKR(outstandingPaisa(writingOff))} still outstanding`
            : undefined
        }
        confirmLabel="Write it off"
        tone="warn"
        points={[
          {
            icon: <Wallet size={15} />,
            label: "Nothing moves in your accounts",
            detail:
              "The money already left when you lent it. Writing it off records that you have given up on it, not that it came back.",
          },
          {
            icon: <Check size={15} />,
            label: "Every payment already recorded is kept",
            detail:
              "Last year's totals must not change because you gave up on it today.",
          },
          {
            icon: <Undo2 size={15} />,
            label: "You can reopen it later",
            detail: "If they do pay, reopen it and record the payment as normal.",
          },
        ]}
      />
    </div>
  );
}

/* ========================================================================== */

function TotalTile({
  label,
  sublabel,
  amountPaisa,
  tone,
  icon,
}: {
  label: string;
  sublabel: string;
  amountPaisa: number;
  tone: "gain" | "loss";
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-surface border-border rounded-panel border p-5 shadow-xs">
      <p className="text-muted flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest">
        <span className={tone === "gain" ? "text-gain" : "text-loss"}>{icon}</span>
        {label}
      </p>
      <p className="tnum text-foreground mt-1 text-[22px] font-semibold">
        {formatPKR(amountPaisa)}
      </p>
      {/* dir="auto" so the Urdu runs right-to-left inside its own box. The
          layout itself never mirrors. */}
      <p className="copy text-faint mt-0.5 text-[11px]" dir="auto">
        {sublabel}
      </p>
    </div>
  );
}

function DebtColumn({
  direction,
  debts,
  readOnly,
  ledgerRows,
  onAdd,
  onPay,
  onEdit,
  onDelete,
  onSettle,
  onReopen,
  onWriteOff,
  onOpenHistory,
  onLink,
}: {
  direction: DebtDirection;
  debts: DebtWithPayments[];
  readOnly: boolean;
  ledgerRows: Record<string, LedgerRow>;
  onAdd: () => void;
  onPay: (debt: DebtWithPayments) => void;
  onEdit: (debt: Debt) => void;
  onDelete: (debt: DebtWithPayments) => void;
  onSettle: (debt: DebtWithPayments) => void;
  onReopen: (debt: DebtWithPayments) => void;
  onWriteOff: (debt: DebtWithPayments) => void;
  onOpenHistory: (debt: DebtWithPayments) => void;
  onLink: (debt: DebtWithPayments) => void;
}) {
  const openTotal = debts
    .filter((d) => d.status === "open")
    .reduce((sum, d) => sum + outstandingPaisa(d), 0);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-foreground text-[14px] font-semibold">
          {DIRECTION_LABEL[direction]}
        </h2>
        <span className="tnum text-muted text-[12px] font-medium">
          {formatPKR(openTotal)}
        </span>
      </div>

      {debts.length === 0 ? (
        <div className="border-border rounded-panel text-muted border border-dashed p-6 text-center text-[11.5px]">
          <p>
            {direction === "owed_to_us"
              ? "Nobody owes you anything here."
              : "You owe nothing here."}
          </p>
          {!readOnly && (
            <button
              type="button"
              onClick={onAdd}
              className="text-brass-strong mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium underline underline-offset-2"
            >
              <Plus size={12} />
              {DIRECTION_ACTION[direction]}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {debts.map((debt, i) => (
            <Reveal key={debt.id} index={i}>
              <DebtCard
                debt={debt}
                readOnly={readOnly}
                openingRow={
                  debt.opening_transaction_id
                    ? (ledgerRows[debt.opening_transaction_id] ?? null)
                    : null
                }
                onPay={() => onPay(debt)}
                onEdit={() => onEdit(debt)}
                onDelete={() => onDelete(debt)}
                onSettle={() => onSettle(debt)}
                onReopen={() => onReopen(debt)}
                onWriteOff={() => onWriteOff(debt)}
                onOpenHistory={() => onOpenHistory(debt)}
                onLink={() => onLink(debt)}
              />
            </Reveal>
          ))}
        </div>
      )}
    </section>
  );
}

const TONE_CHIP: Record<string, string> = {
  overdue: "border-loss/30 bg-loss/10 text-loss",
  today: "border-brass/35 bg-brass/12 text-brass-strong",
  soon: "border-brass/25 bg-brass/8 text-brass-strong",
  later: "border-border bg-surface-subtle text-muted",
};

function DebtCard({
  debt,
  readOnly,
  openingRow,
  onPay,
  onEdit,
  onDelete,
  onSettle,
  onReopen,
  onWriteOff,
  onOpenHistory,
  onLink,
}: {
  debt: DebtWithPayments;
  readOnly: boolean;
  /** The ledger row the opening leg wrote, or null when it never wrote one. */
  openingRow: LedgerRow | null;
  onPay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSettle: () => void;
  onReopen: () => void;
  onWriteOff: () => void;
  onOpenHistory: () => void;
  onLink: () => void;
}) {
  const kind = debtKind(debt.kind);
  const KindIcon = KIND_ICON[kind.icon] ?? HandCoins;
  const outstanding = outstandingPaisa(debt);
  const repaid = repaidPaisa(debt);
  const overpaid = overpaidByPaisa(debt);
  const fraction = repaidFraction(debt);
  const tone = dueTone(debt);
  const isOpen = debt.status === "open";
  const cleared = isFullyRepaid(debt);

  /*
    The card's identity band. A gradient that is strongest at the top and gone
    within the header, closed by a hairline in the same colour — the same
    treatment the category and account cards carry, so a debt card reads as part
    of the set rather than a plain box among finished ones.

    Tinted by DIRECTION, because that is the one fact that changes what every
    figure on the card means: money coming back to you, or money you owe.
  */
  const tint = debt.direction === "owed_to_us" ? "var(--color-gain)" : "var(--color-loss)";

  return (
    <div className="group bg-surface border-border rounded-panel focus-within:border-brass/40 overflow-hidden border shadow-xs transition-colors">
      <div
        className="p-4 pb-3"
        style={{
          background: `linear-gradient(to bottom, color-mix(in oklab, ${tint} 9%, transparent), transparent)`,
          borderBottom: `1px solid color-mix(in oklab, ${tint} 22%, transparent)`,
        }}
      >
      <div className="flex items-start gap-3">
        <span className="bg-brass/10 text-brass-strong flex size-8 shrink-0 items-center justify-center rounded-full">
          <KindIcon size={15} strokeWidth={1.8} />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-foreground truncate text-[13.5px] font-semibold">
            {debt.counterparty_name}
          </h3>
          <p className="text-muted flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
            <span>{kind.label}</span>
            {/*
              When the money actually changed hands.

              `opened_on`, not `created_at`. A loan entered today for money lent
              in June used to read "lent 2026-08-21", because the only date the
              row carried was the day it was typed.
            */}
            <span className="text-faint">
              {debt.direction === "owed_to_us" ? "lent" : "borrowed"}{" "}
              <span className="ltr">{debt.opened_on}</span>
            </span>
            {debt.status !== "open" && (
              <span className="border-border bg-surface-subtle rounded-full border px-1.5 py-0.5 text-[10px] leading-none font-medium">
                {debt.status === "settled" ? "Settled" : "Written off"}
              </span>
            )}
          </p>
        </div>

        {!readOnly && (
          <RowActions
            /*
              The sync icon appears ONLY while this debt has no entry in any
              account, so its presence is the whole message — every card without
              it is already accounted for. It sits before the pencil because it
              adds, where the other two change and destroy.
            */
            onSync={openingRow ? undefined : onLink}
            syncLabel="Add this to your accounts"
            onEdit={onEdit}
            onDelete={onDelete}
            editLabel="Edit debt"
            deleteLabel="Delete debt"
            reveal="hover"
          />
        )}
      </div>

      {/* Where this money actually sits in the ledger, as a link you can follow
          and check — rather than a fact that only ever surfaced in the delete
          dialog, which meant learning it by trying to remove something. */}
      {openingRow && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <LedgerRefChip
            transactionId={openingRow.id}
            date={openingRow.date}
            type={openingRow.type as "income" | "expense" | "transfer"}
          />
        </div>
      )}
      </div>

      <div className="p-4 pt-3">
      {/* ---- The figure --------------------------------------------------- */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted text-[10px] font-semibold uppercase tracking-widest">
            {isOpen ? "Outstanding" : "Was"}
          </p>
          <p className="tnum text-foreground text-[19px] font-semibold leading-tight">
            {formatPKR(isOpen ? outstanding : Number(debt.principal_paisa))}
          </p>
          {repaid > 0 && isOpen && (
            <p className="tnum text-faint text-[11px]">
              of {formatPKR(Number(debt.principal_paisa))}
            </p>
          )}
        </div>

        {debt.due_date && tone !== "none" && (
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${TONE_CHIP[tone] ?? TONE_CHIP.later}`}
          >
            <CalendarClock size={10} />
            {dueLabel(debt.due_date)}
          </span>
        )}
      </div>

      {/* ---- Progress ------------------------------------------------------ */}
      {repaid > 0 && (
        <div className="mt-2.5">
          <div className="bg-surface-3 h-1.5 w-full overflow-hidden rounded-full">
            <div
              className={`h-full rounded-full ${cleared ? "bg-gain" : "bg-brass"}`}
              style={{ width: `${Math.round(fraction * 100)}%` }}
            />
          </div>
          <p className="text-faint mt-1 text-[10.5px]">
            <span className="tnum">{formatPKR(repaid)}</span> repaid
            {overpaid > 0 && (
              <span className="text-brass-strong">
                {" · "}
                <span className="tnum">{formatPKR(overpaid)}</span> more than owed
              </span>
            )}
          </p>
        </div>
      )}

      {debt.note && (
        <p className="text-faint mt-2 text-[11px] leading-snug">{debt.note}</p>
      )}

      {/* ---- History ---------------------------------------------------------
        A BUTTON, not the list itself. Rendering every payment inline worked for
        two and fell apart at ten — a khata settled in small amounts turned each
        card into a scroll and pushed the outstanding figure, which is the whole
        point of the card, off the bottom.
      */}
      <button
        type="button"
        onClick={onOpenHistory}
        className="border-border hover:border-brass/40 hover:bg-surface-subtle text-foreground-2 rounded-control mt-3 flex w-full items-center justify-between gap-2 border px-2.5 py-2 text-[11.5px] transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <History size={13} className="text-muted" />
          {debt.payments.length === 0
            ? "No payments yet"
            : `${debt.payments.length} ${debt.payments.length === 1 ? "payment" : "payments"}`}
        </span>
        <span className="text-brass-strong font-medium">View history</span>
      </button>

      {/* ---- Actions --------------------------------------------------------
        The primary action sits at the BOTTOM of the card, under the payments it
        adds to, rather than above them.

        There is no "Write off" button. It looked like a normal action but set a
        status, which made an open debt vanish from the list while its bank entry
        stayed — indistinguishable from a delete that half worked. Giving up on a
        debt is rare and destructive enough to belong behind the delete dialog,
        where the linked ledger rows are named and can be removed with it.
      */}
      {!readOnly && (
        <div className="border-border mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          {isOpen && (
            <Button variant="secondary" size="sm" onClick={onPay}>
              <Plus size={13} />
              Record payment
            </Button>
          )}
          {isOpen && cleared && (
            <Button variant="ghost" size="sm" onClick={onSettle}>
              <Check size={13} />
              Mark settled
            </Button>
          )}
          {isOpen && !cleared && (
            <button
              type="button"
              onClick={onWriteOff}
              className="text-faint hover:text-loss ms-auto text-[11px] underline underline-offset-2 transition-colors"
            >
              Write off
            </button>
          )}
          {!isOpen && (
            <Button variant="ghost" size="sm" onClick={onReopen}>
              <Undo2 size={13} />
              Reopen
            </Button>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
