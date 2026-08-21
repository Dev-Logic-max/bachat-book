"use client";

import * as React from "react";
import {
  Banknote,
  Bitcoin,
  Boxes,
  ChartPie,
  Coins,
  Factory,
  Gem,
  Globe,
  Landmark,
  Link2,
  Map as MapIcon,
  Vault,
  Plus,
  Search,
  Ticket,
  TrendingUp,
  Undo2,
  Wallet,
} from "lucide-react";

import type { AccountWithInstitution } from "@/components/account-options";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { InvestmentModal } from "@/components/investment-modal";
import {
  CloseInvestmentModal,
  PayoutModal,
  ValuationModal,
} from "@/components/investment-modals";
import { LedgerRefChip } from "@/components/ledger-ref-chip";
import { LinkToAccountModal } from "@/components/link-to-account-modal";
import { MerchantMark } from "@/components/merchant-mark";
import { PageActions } from "@/components/page-actions";
import { Reveal } from "@/components/reveal";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { RichSelect } from "@/components/ui/select";
import { RowActions } from "@/components/ui/row-actions";
import { useToast } from "@/components/ui/toast";
import { formatPKR, formatPKRCompact, formatPercent } from "@/lib/format";
import { institutionLogo } from "@/lib/ledger";
import {
  INVESTMENT_KINDS,
  INVESTMENT_SORTS,
  annualisedReturnFraction,
  daysToExit,
  investmentKind,
  investmentReturn,
  investmentReturnFraction,
  isOpen as isHoldingOpen,
  matchesQuery,
  payoutsByPeriod,
  portfolioTotals,
  projectedAnnualIncomePaisa,
  sortInvestments,
  type InvestmentSort,
  type PayoutPeriod,
} from "@/lib/investments";
import {
  deleteInvestment,
  deletePayout,
  loadIntegrations,
  reopenInvestment,
  syncHoldingToLedger,
  updatePayout,
} from "@/lib/investment-actions";
import { ledgerRefFor } from "@/lib/module-ledger";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";

type Holding = Tables<"investments">;
type Payout = Tables<"investment_payouts">;

/**
 * The ledger rows this page's records point at.
 *
 * A holding stores `funding_transaction_id` and `exit_transaction_id`; a payout
 * stores `transaction_id`. None of them carries the row's own DATE, which the
 * deep link into Entries or Transactions needs to name the month — both screens
 * open on the current month, so an id alone lands on a page that cannot contain
 * the row.
 */
type LedgerRow = { id: string; date: string; type: string; account_id: string };

/** Lucide name → component. Keeps `lib/investments.ts` free of JSX. */
const KIND_ICON: Record<string, React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>> = {
  Landmark,
  Ticket,
  TrendingUp,
  ChartPie,
  Gem,
  Map: MapIcon,
  Factory,
  Vault,
  Globe,
  Bitcoin,
  Boxes,
};

/**
 * The allocation strip's palette, on navy.
 *
 * Brass first because it is the product's accent and the largest holding should
 * wear it. The rest are tints of white rather than new hues — a five-colour
 * chart on a navy band fights the page, and the legend carries the meaning.
 */
const ALLOCATION_COLORS = [
  "bg-brass",
  "bg-brass/60",
  "bg-white/55",
  "bg-white/40",
  "bg-white/30",
];

const PERIODS: { key: PayoutPeriod; label: string }[] = [
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
  { key: "quarter", label: "Quarterly" },
  { key: "year", label: "Yearly" },
];

export default function InvestmentsPage() {
  const session = useSession();
  const supabase = createClient();
  const { showToast } = useToast();

  const householdId = session.household?.id || "";
  const readOnly = session.workspace ? !session.workspace.is_active : false;

  const [holdings, setHoldings] = React.useState<Holding[]>([]);
  const [payouts, setPayouts] = React.useState<Payout[]>([]);
  const [valuations, setValuations] = React.useState<Tables<"investment_valuations">[]>([]);
  const [accounts, setAccounts] = React.useState<AccountWithInstitution[]>([]);
  const [institutions, setInstitutions] = React.useState<Tables<"institutions">[]>([]);
  const [syncEnabled, setSyncEnabled] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  // Filters
  const [query, setQuery] = React.useState("");
  const [kindFilter, setKindFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("open");
  const [sort, setSort] = React.useState<InvestmentSort>("value_desc");
  const [period, setPeriod] = React.useState<PayoutPeriod>("month");

  // Modals
  const [editing, setEditing] = React.useState<Holding | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [valuing, setValuing] = React.useState<Holding | null>(null);
  const [payingOut, setPayingOut] = React.useState<Holding | null>(null);
  const [closing, setClosing] = React.useState<Holding | null>(null);
  /** Which record is being given the ledger entry it never got. */
  const [linking, setLinking] = React.useState<
    { holding: Holding; payout: Payout | null } | null
  >(null);
  const [deleting, setDeleting] = React.useState<Holding | null>(null);
  const [ledgerRows, setLedgerRows] = React.useState<Record<string, LedgerRow>>({});
  /** EDITING one profit payment, as opposed to adding another to the holding. */
  const [editingPayout, setEditingPayout] = React.useState<{
    payout: Payout;
    holding: Holding;
  } | null>(null);
  const [deletingPayout, setDeletingPayout] = React.useState<{
    payout: Payout;
    holding: Holding;
  } | null>(null);
  /** "Record profit" from the section header, when there is more than one holding. */
  const [pickingHolding, setPickingHolding] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    if (!householdId) return;

    async function load() {
      /*
       * Every response is checked for `error` SEPARATELY from "no rows".
       * A failing query returning an empty array is what made the Transactions
       * page render "No transactions found" for every household while the real
       * problem was an ambiguous embed.
       */
      const [holdingRes, payoutRes, valuationRes, accountRes, institutionRes] = await Promise.all([
        supabase.from("investments").select("*").eq("household_id", householdId),
        supabase
          .from("investment_payouts")
          .select("*")
          .eq("household_id", householdId)
          .order("date", { ascending: false }),
        supabase
          .from("investment_valuations")
          .select("*")
          .eq("household_id", householdId)
          .order("as_of", { ascending: false }),
        /*
         * EVERY account, archived and deleted ones included.
         *
         * Filtering them out broke two things. It violates the standing rule
         * that unavailable accounts are SHOWN greyed with a reason chip and
         * never hidden — a vanished account reads as data loss. And it silently
         * re-pointed money: a holding funded from an account later archived
         * came back with nothing selected, so editing its NAME forced you to
         * pick a different account, moving a historical debit somewhere it
         * never happened. `accountSelectOptions` disables them.
         */
        supabase
          .from("accounts")
          .select("*, institutions(*)")
          .eq("household_id", householdId)
          .order("created_at"),
        supabase.from("institutions").select("*"),
      ]);

      if (!active) return;

      const firstError =
        holdingRes.error ||
        payoutRes.error ||
        valuationRes.error ||
        accountRes.error ||
        institutionRes.error;
      if (firstError) {
        setLoadError(firstError.message);
        setLoading(false);
        return;
      }

      setHoldings(holdingRes.data ?? []);
      setPayouts(payoutRes.data ?? []);
      setValuations(valuationRes.data ?? []);
      setAccounts((accountRes.data ?? []) as unknown as AccountWithInstitution[]);
      setInstitutions(institutionRes.data ?? []);
      setLoadError(null);

      try {
        const integrations = await loadIntegrations(supabase, householdId);
        if (active) setSyncEnabled(integrations.sync_investments);
      } catch {
        // A missing integrations row is the default state, not a failure. Any
        // other problem here must not stop the holdings from rendering.
        if (active) setSyncEnabled(false);
      }

      setLoading(false);

      /*
       * The ledger rows behind these records, fetched second because their ids
       * only exist once the holdings and payouts are back. Household-scoped as
       * well as id-scoped: RLS already does that, and saying it here means a
       * mismatched id can never read across a tenant boundary.
       */
      const ids = [
        ...(holdingRes.data ?? []).flatMap((h) => [
          h.funding_transaction_id,
          h.exit_transaction_id,
        ]),
        ...(payoutRes.data ?? []).map((p) => p.transaction_id),
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

  const payoutsByHolding = React.useMemo(() => {
    const map: Record<string, Payout[]> = {};
    for (const payout of payouts) {
      (map[payout.investment_id] ??= []).push(payout);
    }
    return map;
  }, [payouts]);

  const valuationsByHolding = React.useMemo(() => {
    const map: Record<string, Tables<"investment_valuations">[]> = {};
    for (const valuation of valuations) {
      (map[valuation.investment_id] ??= []).push(valuation);
    }
    return map;
  }, [valuations]);

  const institutionById = React.useMemo(
    () => new Map(institutions.map((i) => [i.id, i])),
    [institutions],
  );

  const totals = React.useMemo(
    () => portfolioTotals(holdings, payoutsByHolding),
    [holdings, payoutsByHolding],
  );

  /** Value change plus every rupee of profit ever received. */
  const lifetimeReturnPaisa = totals.capitalPaisa + totals.incomePaisa + totals.realisedPaisa;

  /*
   * The mix, by kind, over open holdings only.
   *
   * Anything under 4% is folded into "Other" rather than drawn as a 2px sliver
   * with a legend entry — six invisible slices and a two-line legend is worse
   * than one honest bucket.
   */
  const allocation = React.useMemo(() => {
    if (totals.valuePaisa <= 0) return [];

    const byKind = new Map<string, number>();
    for (const holding of holdings) {
      if (!isHoldingOpen(holding)) continue;
      byKind.set(
        holding.kind,
        (byKind.get(holding.kind) ?? 0) + Number(holding.current_value_paisa),
      );
    }

    const ranked = [...byKind.entries()]
      .map(([key, valuePaisa]) => ({ key, valuePaisa, share: valuePaisa / totals.valuePaisa }))
      .sort((a, b) => b.valuePaisa - a.valuePaisa);

    const big = ranked.filter((s) => s.share >= 0.04);
    const smallPaisa = ranked
      .filter((s) => s.share < 0.04)
      .reduce((sum, s) => sum + s.valuePaisa, 0);

    const slices = big.map((slice, i) => ({
      ...slice,
      label: investmentKind(slice.key).label,
      className: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length],
    }));

    if (smallPaisa > 0) {
      slices.push({
        key: "__other",
        valuePaisa: smallPaisa,
        share: smallPaisa / totals.valuePaisa,
        label: "Other",
        className: "bg-white/25",
      });
    }

    return slices;
  }, [holdings, totals.valuePaisa]);

  const visible = React.useMemo(() => {
    const filtered = holdings.filter((h) => {
      if (kindFilter !== "all" && h.kind !== kindFilter) return false;
      if (statusFilter === "open" && !isHoldingOpen(h)) return false;
      if (statusFilter === "closed" && isHoldingOpen(h)) return false;
      if (statusFilter !== "all" && statusFilter !== "open" && statusFilter !== "closed") {
        if (h.status !== statusFilter) return false;
      }
      return matchesQuery(h, query, institutionById.get(h.institution_id ?? "")?.name);
    });
    return sortInvestments(filtered, payoutsByHolding, sort);
  }, [holdings, kindFilter, statusFilter, query, sort, payoutsByHolding, institutionById]);

  /* Profit rolled up, over the holdings currently in view — so filtering to
     "gold" answers "what has gold paid me", not "what has everything paid me". */
  const visibleIds = React.useMemo(() => new Set(visible.map((h) => h.id)), [visible]);
  /** Only an OPEN holding can take a new payout — a sold one has no more to pay. */
  const openHoldings = React.useMemo(
    () => holdings.filter((h) => isHoldingOpen(h)),
    [holdings],
  );

  const payoutBuckets = React.useMemo(
    () => payoutsByPeriod(payouts.filter((p) => visibleIds.has(p.investment_id)), period),
    [payouts, visibleIds, period],
  );

  const activeFilterCount =
    (kindFilter !== "all" ? 1 : 0) + (statusFilter !== "open" ? 1 : 0) + (sort !== "value_desc" ? 1 : 0);

  const handleReopen = async (holding: Holding) => {
    try {
      await reopenInvestment(supabase, holding);
      showToast({
        type: "success",
        title: "Back in your active holdings",
        description: holding.exit_transaction_id
          ? "The money that came back has been taken out of that account again."
          : "The exit has been undone.",
      });
      refresh();
    } catch (err) {
      showToast({
        type: "error",
        title: "Could not reopen it",
        description: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  };

  const handleDelete = async (cascade: boolean) => {
    if (!deleting) return;
    try {
      await deleteInvestment(supabase, deleting, cascade);
      showToast({ type: "success", title: "Holding removed", description: `"${deleting.name}" is gone.` });
      setDeleting(null);
      refresh();
    } catch (err) {
      showToast({
        type: "error",
        title: "Could not remove it",
        description: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  };

  /**
   * Give a record the ledger entry it never got.
   *
   * Both branches go through the SAME functions the ordinary forms use, so a
   * record that grew an entry afterwards is indistinguishable from one that had
   * it from the start. There is one way for a holding to hold a funding leg, not
   * two, and that is what stops the two paths drifting apart.
   */
  const handleLinkToAccount = async (accountId: string) => {
    if (!linking) return;
    const { holding, payout } = linking;

    if (payout) {
      await updatePayout(supabase, holding, payout, {
        date: payout.date,
        amountPaisa: Number(payout.amount_paisa),
        accountId,
        reinvest: false,
        note: payout.note,
      });
    } else {
      await syncHoldingToLedger(supabase, holding, accountId);
    }

    showToast({
      type: "success",
      title: "Added to your accounts",
      description: `${accounts.find((a) => a.id === accountId)?.name ?? "That account"} now carries this entry.`,
    });
    setLinking(null);
    refresh();
  };

  /**
   * Remove one profit payment from the roll-up.
   *
   * `deletePayout` does the two-sided unwind: it deletes the income entry the
   * payout wrote, and — for a REINVESTED one — walks the holding's value back
   * down, since recording it had grown that value.
   */
  const handleDeletePayout = async () => {
    if (!deletingPayout) return;
    const { payout, holding } = deletingPayout;
    try {
      await deletePayout(supabase, holding, payout);
      showToast({
        type: "success",
        title: "Payment removed",
        description:
          payout.destination === "reinvested"
            ? "The holding's value was walked back down by the same amount."
            : payout.transaction_id
              ? "The income entry it wrote went with it."
              : "It never touched an account, so no balance changed.",
      });
      setDeletingPayout(null);
      refresh();
    } catch (err) {
      showToast({
        type: "error",
        title: "Could not remove it",
        description: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  };

  /*
   * What deleting this holding would also take with it.
   *
   * Only rows that exist: a standalone holding lists nothing, and the delete
   * modal correctly falls back to a plain confirm rather than showing an empty
   * "linked records" heading.
   */
  const deletingLinks = React.useMemo(() => {
    if (!deleting) return [];
    const links: { kind: string; label: string; href?: string }[] = [];
    if (deleting.funding_transaction_id) {
      const row = ledgerRows[deleting.funding_transaction_id];
      links.push({
        kind: "Account entry",
        label: `Invested in ${deleting.name} · ${formatPKR(Number(deleting.principal_paisa))}`,
        // Named AND reachable. Listing what is about to be destroyed without a
        // way to look at it asks for trust rather than judgement.
        href: ledgerRefFor(
          deleting.funding_transaction_id,
          row?.date ?? deleting.purchase_date,
          "transfer",
        ).href,
      });
    }
    if (deleting.exit_transaction_id) {
      const row = ledgerRows[deleting.exit_transaction_id];
      links.push({
        kind: "Account entry",
        label: `Withdrew from ${deleting.name} · ${formatPKR(Number(deleting.exit_value_paisa ?? 0))}`,
        href: ledgerRefFor(
          deleting.exit_transaction_id,
          row?.date ?? deleting.exit_date ?? deleting.purchase_date,
          "transfer",
        ).href,
      });
    }
    for (const payout of (payoutsByHolding[deleting.id] ?? []).filter((p) => p.transaction_id)) {
      const row = ledgerRows[payout.transaction_id as string];
      links.push({
        kind: "Income entry",
        label: `Profit from ${deleting.name} · ${formatPKR(Number(payout.amount_paisa))}`,
        href: ledgerRefFor(
          payout.transaction_id as string,
          row?.date ?? payout.date,
          "income",
        ).href,
      });
    }
    return links;
  }, [deleting, payoutsByHolding, ledgerRows]);

  const deletingAccount = deleting?.account_id
    ? accounts.find((a) => a.id === deleting.account_id)
    : undefined;

  /* ---------------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display truncate text-[19px] font-semibold tracking-[-0.02em] sm:text-[22px]">
            Investments
          </h1>
          <p className="text-muted mt-0.5 text-[12.5px]">
            Certificates, shares, gold, plots and business stakes — what you own,
            what it has earned, and when it comes back.
          </p>
        </div>

        <PageActions
          title="Investments"
          actions={[
            {
              label: "Add holding",
              shortLabel: "Holding",
              hint: "Anything you own that is not sitting in a bank account",
              icon: Plus,
              tone: "primary",
              disabled: readOnly,
              onClick: () => {
                setEditing(null);
                setAddOpen(true);
              },
            },
          ]}
        />
      </div>

      {loadError && (
        <div className="border-loss/25 bg-loss/8 text-loss rounded-panel border px-4 py-3 text-[12.5px]">
          Could not load your investments: {loadError}
        </div>
      )}

      {/* ---- Portfolio hero ------------------------------------------------ */}
      <Reveal>
        <div className="bg-navy-900 text-on-navy rounded-panel relative overflow-hidden p-6 shadow-md">
          <div
            aria-hidden
            className="bg-brass/12 pointer-events-none absolute -right-16 -top-20 size-56 rounded-full blur-3xl"
          />

          <div className="relative z-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <span className="text-brass text-[10px] font-bold uppercase tracking-[0.16em]">
                  What your holdings are worth
                </span>
                <p className="font-display tnum mt-1 text-3xl font-bold">
                  {formatPKR(totals.valuePaisa)}
                </p>
              </div>

              {/*
                Total return as its own headline, because the big figure above
                cannot answer "has this been worth it". It combines both halves
                — the value going up AND the cash already paid out — which is
                the only way a Behbood certificate and a PSX holding can be
                compared at all.
              */}
              {totals.investedPaisa > 0 && (
                <div className="shrink-0 text-right">
                  <span className="text-on-navy-muted text-[10px] font-semibold uppercase tracking-widest">
                    Total return
                  </span>
                  <p
                    className={`font-display tnum mt-1 text-xl font-bold ${
                      lifetimeReturnPaisa >= 0 ? "text-gain" : "text-loss"
                    }`}
                  >
                    {lifetimeReturnPaisa >= 0 ? "+" : "−"}
                    {formatPKR(Math.abs(lifetimeReturnPaisa))}
                  </p>
                  <p className="text-on-navy-muted tnum text-[10.5px]">
                    {(
                      (lifetimeReturnPaisa / totals.investedPaisa) * 100
                    ).toFixed(1)}
                    % on what you put in
                  </p>
                </div>
              )}
            </div>

            {/* Where the money actually sits, without needing a chart library. */}
            {allocation.length > 0 && (
              <div className="mt-5">
                <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full">
                  {allocation.map((slice) => (
                    <span
                      key={slice.key}
                      className={slice.className}
                      style={{ width: `${slice.share * 100}%` }}
                      title={`${slice.label} — ${formatPKR(slice.valuePaisa)}`}
                    />
                  ))}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
                  {allocation.map((slice) => (
                    <span
                      key={slice.key}
                      className="text-on-navy-muted inline-flex items-center gap-1.5 text-[10.5px]"
                    >
                      <span className={`size-1.5 rounded-full ${slice.className}`} />
                      {slice.label}
                      <span className="text-on-navy tnum font-medium">
                        {Math.round(slice.share * 100)}%
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="border-navy-800 mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-4 sm:grid-cols-4">
              <HeroStat label="You put in" value={formatPKR(totals.investedPaisa)} />
              <HeroStat
                label="Value change"
                value={formatPKR(totals.capitalPaisa)}
                tone={totals.capitalPaisa >= 0 ? "gain" : "loss"}
              />
              <HeroStat
                label="Profit received"
                value={formatPKR(totals.incomePaisa)}
                tone={totals.incomePaisa > 0 ? "gain" : undefined}
              />
              <HeroStat
                label="Holdings"
                value={`${totals.openCount} open`}
                sub={totals.closedCount > 0 ? `${totals.closedCount} closed` : undefined}
              />
            </div>

            {/*
              The honest line about what the dashboard does and does not include.
              With the bridge shut, the app never took this money out of any
              account — so adding it into dashboard net worth would count the same
              rupees twice. Saying so here is cheaper than the support question.
            */}
            <p className="text-on-navy-muted mt-4 text-[11px] leading-relaxed">
              {syncEnabled ? (
                <>
                  <Link2 size={11} className="mb-px me-1 inline" />
                  Account syncing is <span className="text-on-navy font-medium">on</span> — new
                  holdings come out of the account you name, and the money shows up
                  on your dashboard as savings moving rather than spending.
                </>
              ) : (
                <>
                  Kept separate from your daily money. Your dashboard net worth
                  counts your accounts only, so nothing here is double-counted.
                  Turn on syncing in Settings → Preferences to link them.
                </>
              )}
            </p>
          </div>
        </div>
      </Reveal>

      {/* ---- Search and filters -------------------------------------------- */}
      {holdings.length > 0 && (
        <div className="space-y-3">
          <Input
            placeholder="Search by name, type, note — try “gold” or “Behbood”"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            prefixIcon={<Search size={15} />}
            aria-label="Search holdings"
          />

          <FilterBar
            activeCount={activeFilterCount}
            onClear={() => {
              setKindFilter("all");
              setStatusFilter("open");
              setSort("value_desc");
            }}
          >
            <RichSelect
              label="Type"
              value={kindFilter}
              onChange={setKindFilter}
              searchable
              options={[
                { value: "all", label: "Every type" },
                ...INVESTMENT_KINDS.map((k) => ({
                  value: k.key,
                  label: k.label,
                  secondaryLabel: k.labelUr,
                })),
              ]}
            />
            <RichSelect
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "open", label: "Still held", description: "Active and matured" },
                { value: "closed", label: "Closed", description: "Sold or withdrawn" },
                { value: "matured", label: "Matured only", description: "Term is up, money not back yet" },
                { value: "all", label: "Everything" },
              ]}
            />
            <RichSelect
              label="Sort by"
              value={sort}
              onChange={(v) => setSort(v as InvestmentSort)}
              options={INVESTMENT_SORTS.map((s) => ({ value: s.key, label: s.label }))}
            />
          </FilterBar>
        </div>
      )}

      {/* ---- Holdings ------------------------------------------------------ */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-surface border-border rounded-panel shimmer h-44 border" />
          ))}
        </div>
      ) : holdings.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          imageSrc="/art/empty-investments.webp"
          description="Add the Behbood certificates, the tola of gold, the plot file, the shares — anything you own that is not in a bank account. Nothing here touches your balances unless you ask it to."
          action={
            <Button variant="primary" onClick={() => setAddOpen(true)} disabled={readOnly}>
              Add your first holding
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <div className="bg-surface border-border rounded-panel text-muted border p-8 text-center text-xs">
          Nothing matches that. Try clearing the filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((holding, i) => (
            <Reveal key={holding.id} index={i}>
              <HoldingCard
                holding={holding}
                payouts={payoutsByHolding[holding.id] ?? []}
                institution={institutionById.get(holding.institution_id ?? "") ?? null}
                readOnly={readOnly}
                syncEnabled={syncEnabled}
                fundingRow={
                  holding.funding_transaction_id
                    ? (ledgerRows[holding.funding_transaction_id] ?? null)
                    : null
                }
                exitRow={
                  holding.exit_transaction_id
                    ? (ledgerRows[holding.exit_transaction_id] ?? null)
                    : null
                }
                onEdit={() => setEditing(holding)}
                onDelete={() => setDeleting(holding)}
                onRevalue={() => setValuing(holding)}
                onPayout={() => setPayingOut(holding)}
                onClose={() => setClosing(holding)}
                onLink={() => setLinking({ holding, payout: null })}
                onReopen={() => void handleReopen(holding)}
              />
            </Reveal>
          ))}
        </div>
      )}

      {/* ---- Profit over time ---------------------------------------------- */}
      {payoutBuckets.length > 0 && (
        <div className="border-border border-t pt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-[15px] font-semibold tracking-[-0.01em]">
                Profit received
              </h2>
              <p className="text-muted text-[11.5px]">
                Cash that actually arrived, over{" "}
                {visible.length === holdings.length ? "all holdings" : "the holdings shown above"}.
                Reinvested profit is listed apart, because you could not spend it.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/*
                The second way in. The per-card "Record profit" button is the
                first, but this section is where someone looking at their profit
                history actually is when they think "add another one" — and a
                list with no way to add to it reads as read-only.
              */}
              {!readOnly && openHoldings.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    openHoldings.length === 1
                      ? setPayingOut(openHoldings[0])
                      : setPickingHolding(true)
                  }
                >
                  <Plus size={13} />
                  Record profit
                </Button>
              )}

            <div className="border-border bg-surface-subtle rounded-control flex items-center gap-1 border p-1 text-[11px]">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriod(p.key)}
                  className={`rounded-control px-2.5 py-1 font-medium transition-colors ${
                    period === p.key
                      ? "bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            </div>
          </div>

          {/*
            The individual payments, grouped under a period heading — NOT an
            expandable aggregate. A row you must open before you can correct it
            hides the one action the list exists for; a profit typed as 115000
            instead of 11500 should be one hover away, not two clicks.

            The period heading still carries the roll-up total, so the grain
            buttons above keep their meaning.
          */}
          <div className="bg-surface border-border rounded-panel overflow-hidden border shadow-xs">
            {payoutBuckets.slice(0, 12).map((bucket) => (
              <div key={bucket.key} className="border-border border-b last:border-b-0">
                <div className="bg-surface-subtle flex items-center justify-between gap-4 px-4 py-2">
                  <p className="text-muted text-[11px] font-semibold uppercase tracking-widest">
                    {bucket.label}
                  </p>
                  <span
                    className={`tnum shrink-0 text-[12px] font-semibold ${
                      bucket.receivedPaisa > 0 ? "text-gain" : "text-muted"
                    }`}
                  >
                    {bucket.receivedPaisa > 0 ? formatPKR(bucket.receivedPaisa) : "—"}
                    {bucket.reinvestedPaisa > 0 && (
                      <span className="text-muted font-normal">
                        {" + "}
                        {formatPKRCompact(bucket.reinvestedPaisa)} reinvested
                      </span>
                    )}
                  </span>
                </div>

                <ul className="divide-border divide-y">
                  {bucket.payouts.map((payout) => {
                    const holding = holdings.find((h) => h.id === payout.investment_id);
                    const row = payout.transaction_id
                      ? ledgerRows[payout.transaction_id]
                      : undefined;
                    return (
                      <li
                        key={payout.id}
                        className="group hover:bg-surface-subtle/60 focus-within:bg-surface-subtle/60 flex items-center justify-between gap-3 px-4 py-2.5 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-foreground truncate text-[12.5px] font-medium">
                            {holding?.name ?? "Deleted holding"}
                          </p>
                          <p className="text-faint text-[10.5px]">
                            <span className="ltr">{payout.date}</span>
                            {" · "}
                            {payout.destination === "reinvested" ? "reinvested" : "received"}
                            {payout.note && ` · ${payout.note}`}
                          </p>
                          {row && (
                            <LedgerRefChip
                              transactionId={row.id}
                              date={row.date}
                              type={row.type as "income" | "expense" | "transfer"}
                              className="mt-1"
                            />
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={`tnum text-[12.5px] font-semibold ${
                              payout.destination === "received" ? "text-gain" : "text-muted"
                            }`}
                          >
                            {formatPKR(Number(payout.amount_paisa))}
                          </span>
                          {!readOnly && holding && (
                            <RowActions
                              /*
                                Only a RECEIVED payment can be given an account.
                                Reinvested profit never reached one — the money is
                                inside the holding's value — so offering to file
                                it in a bank would invent a movement.
                              */
                              onSync={
                                syncEnabled && !row && payout.destination === "received"
                                  ? () => setLinking({ holding, payout })
                                  : undefined
                              }
                              syncLabel="Add this payment to your accounts"
                              /*
                                THIS ROW, not a blank form for its holding.

                                The pencil used to open "Record profit" against
                                the parent holding with every field empty. It
                                looked like an edit and behaved like "add
                                another", so a profit typed as 115000 instead of
                                11500 had no correction path at all — and the
                                figure feeds the lifetime return on the card and
                                every total in this roll-up.
                              */
                              onEdit={() => setEditingPayout({ payout, holding })}
                              onDelete={() => setDeletingPayout({ payout, holding })}
                              editLabel="Edit this payment"
                              deleteLabel="Remove this payment"
                              reveal="hover"
                            />
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          {payoutBuckets.length > 12 && (
            <p className="text-faint mt-2 text-[11px]">
              Showing the most recent 12 of {payoutBuckets.length} periods.
            </p>
          )}
        </div>
      )}

      {/* ---- Modals -------------------------------------------------------- */}
      <InvestmentModal
        isOpen={addOpen || editing !== null}
        onClose={() => {
          setAddOpen(false);
          setEditing(null);
        }}
        onSaved={refresh}
        householdId={householdId}
        holding={editing}
        accounts={accounts}
        institutions={institutions}
        syncEnabled={syncEnabled}
      />

      <ValuationModal
        isOpen={valuing !== null}
        onClose={() => setValuing(null)}
        onSaved={refresh}
        holding={valuing}
        history={valuing ? (valuationsByHolding[valuing.id] ?? []) : []}
      />

      {/* Which holding paid? Only asked when there is more than one open. */}
      <Modal
        isOpen={pickingHolding}
        onClose={() => setPickingHolding(false)}
        title="Which holding paid?"
        subtitle="Profit is recorded against the holding that produced it."
        icon={<Banknote size={18} />}
        footer={
          <Button type="button" variant="ghost" onClick={() => setPickingHolding(false)}>
            Cancel
          </Button>
        }
      >
        <ul className="border-border divide-border divide-y rounded-control border">
          {openHoldings.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => {
                  setPickingHolding(false);
                  setPayingOut(h);
                }}
                className="hover:bg-surface-subtle flex w-full items-center justify-between gap-3 px-3 py-2.5 text-start transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-foreground truncate text-[12.5px] font-medium">{h.name}</p>
                  <p className="text-muted text-[11px]">{investmentKind(h.kind).label}</p>
                </div>
                <span className="tnum text-foreground-2 shrink-0 text-[12px] font-semibold">
                  {formatPKR(Number(h.current_value_paisa))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>

      <PayoutModal
        isOpen={payingOut !== null || editingPayout !== null}
        onClose={() => {
          setPayingOut(null);
          setEditingPayout(null);
        }}
        onSaved={refresh}
        holding={payingOut ?? editingPayout?.holding ?? null}
        accounts={accounts}
        syncEnabled={syncEnabled}
        payouts={payingOut ? (payoutsByHolding[payingOut.id] ?? []) : []}
        payout={editingPayout?.payout ?? null}
        payoutLedgerRow={
          editingPayout?.payout.transaction_id
            ? (ledgerRows[editingPayout.payout.transaction_id] ?? null)
            : null
        }
      />

      <CloseInvestmentModal
        isOpen={closing !== null}
        onClose={() => setClosing(null)}
        onSaved={refresh}
        holding={closing}
        accounts={accounts}
        syncEnabled={syncEnabled}
      />

      {/*
        The gap this closes: a holding, or a profit payment, recorded while the
        bridge was shut and now needing the account entry it never got. There was
        a "Link" button for holdings and nothing at all for payments.
      */}
      <LinkToAccountModal
        isOpen={linking !== null}
        onClose={() => setLinking(null)}
        onConfirm={handleLinkToAccount}
        title="Add this to your accounts"
        subtitle={linking?.holding.name}
        recordLabel={
          linking
            ? linking.payout
              ? `Profit from ${linking.holding.name}`
              : `Invested in ${linking.holding.name}`
            : ""
        }
        amountPaisa={
          linking
            ? Number(linking.payout?.amount_paisa ?? linking.holding.principal_paisa)
            : 0
        }
        date={linking ? (linking.payout?.date ?? linking.holding.purchase_date) : ""}
        /* Buying is money leaving; profit arriving is money coming in — and a
           locked account may be paid into but never out of, so the direction
           decides whether the lock bites at all. */
        direction={linking?.payout ? "income" : "expense"}
        accounts={accounts}
      />

      <ConfirmDeleteModal
        isOpen={deletingPayout !== null}
        onClose={() => setDeletingPayout(null)}
        onConfirm={handleDeletePayout}
        title="Remove this profit payment?"
        recordLabel={
          deletingPayout
            ? `${formatPKR(Number(deletingPayout.payout.amount_paisa))} · ${deletingPayout.holding.name}`
            : ""
        }
        recordMeta={
          deletingPayout
            ? `${deletingPayout.payout.date} · ${deletingPayout.payout.destination === "reinvested" ? "reinvested" : "received"}`
            : undefined
        }
        linkedRefs={
          deletingPayout?.payout.transaction_id
            ? [
                {
                  kind: "Income entry",
                  label: `Profit from ${deletingPayout.holding.name} · ${formatPKR(Number(deletingPayout.payout.amount_paisa))}`,
                  href: ledgerRefFor(
                    deletingPayout.payout.transaction_id,
                    ledgerRows[deletingPayout.payout.transaction_id]?.date ??
                      deletingPayout.payout.date,
                    "income",
                  ).href,
                },
              ]
            : []
        }
        cascadeHint={
          deletingPayout?.payout.destination === "reinvested"
            ? "Recording this grew what the holding is worth, so removing it walks that value back down by the same amount. Leave it and the growth would stay behind with nothing backing it."
            : deletingPayout?.payout.transaction_id
              ? "The income entry this wrote is removed with it, so the account balance goes back to where it was."
              : "This never reached an account, so no balance changes."
        }
        confirmLabel="Remove payment"
      />

      <ConfirmDeleteModal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Remove this holding?"
        recordLabel={deleting?.name ?? ""}
        recordMeta={
          deleting
            ? `${investmentKind(deleting.kind).label} · ${formatPKR(Number(deleting.principal_paisa))} put in`
            : undefined
        }
        linkedRefs={deletingLinks}
        /*
         * Defaults to UNCHECKED, unlike a transfer leg. The rupees genuinely did
         * leave the bank; deleting a record here should not quietly put them
         * back unless that is what the user means.
         */
        defaultCascade={false}
        cascadeLabel="Also remove the account entries this holding created"
        cascadeHint="The account entries stay. The money really did move, so your balances are unchanged — those rows just stop pointing at a holding."
        balanceImpact={
          deleting?.funding_transaction_id && deletingAccount
            ? {
                accountName: deletingAccount.name,
                fromPaisa: Number(deletingAccount.balance_paisa),
                toPaisa: Number(deletingAccount.balance_paisa) + Number(deleting.principal_paisa),
              }
            : undefined
        }
        confirmLabel="Remove holding"
      />
    </div>
  );
}

/* ========================================================================== *
 * Pieces
 * ========================================================================== */

function HeroStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "gain" | "loss";
}) {
  return (
    <div className="min-w-0">
      <p className="text-on-navy-muted text-[10px] font-semibold uppercase tracking-widest">
        {label}
      </p>
      <p
        className={`tnum font-display mt-1 truncate text-[15px] font-semibold ${
          tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-on-navy"
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-on-navy-muted text-[10.5px]">{sub}</p>}
    </div>
  );
}

function HoldingCard({
  holding,
  payouts,
  institution,
  readOnly,
  syncEnabled,
  fundingRow,
  exitRow,
  onEdit,
  onDelete,
  onRevalue,
  onPayout,
  onClose,
  onLink,
  onReopen,
}: {
  holding: Holding;
  payouts: Payout[];
  institution: Tables<"institutions"> | null;
  readOnly: boolean;
  syncEnabled: boolean;
  /** The ledger row that paid for this holding, or null if nothing did. */
  fundingRow: LedgerRow | null;
  /** The ledger row the money came back through, when it has been cashed in. */
  exitRow: LedgerRow | null;
  onEdit: () => void;
  onDelete: () => void;
  onRevalue: () => void;
  onPayout: () => void;
  onClose: () => void;
  onLink: () => void;
  onReopen: () => void;
}) {
  const def = investmentKind(holding.kind);
  const Icon = KIND_ICON[def.icon] ?? Boxes;
  const open = isHoldingOpen(holding);

  const { capitalPaisa, incomePaisa, totalPaisa } = investmentReturn(holding, payouts);
  const fraction = investmentReturnFraction(holding, payouts);
  const annualised = annualisedReturnFraction(holding, payouts);
  const untilExit = daysToExit(holding);
  const projected = projectedAnnualIncomePaisa(holding);

  return (
    /*
      `group` UNNAMED, and it is load-bearing.

      RowActions reveals itself with `lg:group-hover:opacity-100`, which is the
      unnamed variant. A named group (`group/card`) does not match it, so the
      edit and delete buttons were invisible at every desktop width — present in
      the DOM, reachable by tab, and impossible to find with a mouse. Below `lg`
      they showed, which is why it only reproduced on a big screen.
    */
    <div className="group bg-surface border-border rounded-panel focus-within:border-brass/40 relative flex h-full flex-col border p-5 shadow-xs transition-colors">
      {/* Head */}
      <div className="flex items-start gap-3">
        {institution ? (
          <MerchantMark
            name={institution.short_name || institution.name}
            brand={institution.brand_color}
            logo={institutionLogo(institution.logo_path) ?? undefined}
            awaitingLogo={!institution.logo_path}
            size={34}
          />
        ) : (
          <span className="bg-brass/10 text-brass-strong flex size-8.5 shrink-0 items-center justify-center rounded-card">
            <Icon size={17} strokeWidth={1.75} />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-foreground truncate text-[13.5px] font-semibold">
            {holding.name}
          </h3>
          <p className="text-muted truncate text-[11px]">
            {def.label}
            {holding.units !== null && (
              <>
                {" · "}
                <span className="tnum">{Number(holding.units)}</span> {holding.unit_label}
              </>
            )}
            {!open && ` · ${holding.status === "sold" ? "Sold" : "Closed"}`}
          </p>
        </div>

        {/*
          Hover-revealed, matching every other card in the product.

          The card carries "Record profit", "Update value" and "Cash in" as
          visible buttons at the bottom — that row is what advertises what a
          holding can do. Edit, delete and sync are the row-level verbs and they
          belong where they are on debts, tasks and categories. `reveal="hover"`
          still shows them permanently below `lg` and on `:focus-within`, so
          touch and keyboard lose nothing.
        */}
        {!readOnly && (
          <RowActions
            /*
              The sync icon exists ONLY while this holding has no entry in any
              account, so its presence is the message: every card without it is
              already accounted for. Silent when the household keeps the bridge
              shut, because then "not in your accounts" is the intended state and
              flagging it would nag about a decision already taken.
            */
            onSync={syncEnabled && !fundingRow ? onLink : undefined}
            syncLabel="Add this holding to your accounts"
            onEdit={onEdit}
            onDelete={onDelete}
            editLabel="Edit holding"
            deleteLabel="Remove holding"
            reveal="hover"
          />
        )}
      </div>

      {/* Money */}
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted text-[10px] font-semibold uppercase tracking-widest">
            {open ? "Worth now" : "Came back"}
          </p>
          <p className="font-display tnum text-foreground mt-0.5 truncate text-lg font-bold">
            {formatPKR(open ? Number(holding.current_value_paisa) : Number(holding.exit_value_paisa ?? 0))}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p
            className={`tnum text-[12.5px] font-semibold ${
              totalPaisa > 0 ? "text-gain" : totalPaisa < 0 ? "text-loss" : "text-muted"
            }`}
          >
            {totalPaisa >= 0 ? "+" : "−"}
            {formatPKRCompact(Math.abs(totalPaisa))}
          </p>
          <p className="text-muted tnum text-[10.5px]">
            {fraction !== null ? formatPercent(fraction) : "—"}
            {annualised !== null && (
              <span className="text-faint"> · {formatPercent(annualised)}/yr</span>
            )}
          </p>
        </div>
      </div>

      {/* The two halves of the return, kept apart. A Behbood certificate is flat
          on capital and everything on income; shares are the reverse. Summing
          them into one figure hides which kind of thing you are holding. */}
      <dl className="border-border text-muted mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-[10.5px]">
        <div>
          <dt className="font-medium">Put in</dt>
          <dd className="tnum text-foreground-2 font-semibold">
            {formatPKRCompact(Number(holding.principal_paisa))}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Value change</dt>
          <dd className={`tnum font-semibold ${capitalPaisa >= 0 ? "text-foreground-2" : "text-loss"}`}>
            {capitalPaisa === 0 ? "—" : formatPKRCompact(capitalPaisa)}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Profit paid</dt>
          <dd className={`tnum font-semibold ${incomePaisa > 0 ? "text-gain" : "text-foreground-2"}`}>
            {incomePaisa === 0 ? "—" : formatPKRCompact(incomePaisa)}
          </dd>
        </div>
      </dl>

      {/* Status strip */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {untilExit !== null && open && (
          <Chip tone={untilExit < 0 ? "loss" : untilExit <= 30 ? "brass" : "plain"}>
            {untilExit < 0
              ? `Due back ${Math.abs(untilExit)}d ago`
              : untilExit === 0
                ? "Due back today"
                : `Back in ${untilExit}d`}
          </Chip>
        )}
        {projected !== null && (
          <Chip tone="plain">Expects {formatPKRCompact(projected)}/yr</Chip>
        )}
        {/*
          Where this money actually sits in the ledger, as links you can follow
          and check. This used to be a dead chip reading "Linked to an account",
          which named the fact and then made you go and find the row yourself.
        */}
        {fundingRow && (
          <LedgerRefChip
            transactionId={fundingRow.id}
            date={fundingRow.date}
            type={fundingRow.type as "income" | "expense" | "transfer"}
            label="Paid from"
          />
        )}
        {exitRow && (
          <LedgerRefChip
            transactionId={exitRow.id}
            date={exitRow.date}
            type={exitRow.type as "income" | "expense" | "transfer"}
            label="Came back to"
          />
        )}
        {!fundingRow && syncEnabled && open && (
          <Chip tone="plain">
            <Wallet size={9} className="me-0.5 inline" />
            Not in your accounts
          </Chip>
        )}
      </div>

      {/* Actions */}
      {!readOnly && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {open ? (
            <>
              <CardAction icon={Banknote} label="Record profit" onClick={onPayout} primary />
              <CardAction icon={Coins} label="Update value" onClick={onRevalue} />
              <CardAction icon={TrendingUp} label="Cash in" onClick={onClose} />
              {/* "Link" used to sit here as a fourth chip. It is the sync icon in
                  the card header now — the row of buttons is for what a holding
                  DOES, and filing it in an account is a one-off correction, not
                  something you come back to every quarter. */}
            </>
          ) : (
            // Closing a holding used to be one-way, so a mis-tap on "Cash in"
            // was unrecoverable — and it may have written a real credit to an
            // account, which reopening takes back out.
            <CardAction icon={Undo2} label="Reopen" onClick={onReopen} />
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone: "plain" | "brass" | "loss" }) {
  const toneClass =
    tone === "loss"
      ? "border-loss/25 bg-loss/8 text-loss"
      : tone === "brass"
        ? "border-brass/25 bg-brass/10 text-brass-strong"
        : "border-border bg-surface-subtle text-muted";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] leading-none font-medium ${toneClass}`}
    >
      {children}
    </span>
  );
}

function CardAction({
  icon: Icon,
  label,
  onClick,
  primary = false,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  onClick: () => void;
  /**
   * Recording profit is the action a holding exists FOR — it is the one you
   * come back to every quarter, while "update value" and "cash in" are
   * occasional. All four rendered identically, so the routine action was
   * indistinguishable from the rare ones and read as a row of grey chips.
   */
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        primary
          ? "border-brass/40 bg-brass/12 text-brass-strong hover:bg-brass/20 inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1.5 text-[11px] font-semibold transition-colors"
          : "border-border bg-surface-subtle text-foreground-2 hover:border-brass/40 hover:text-foreground inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1.5 text-[11px] font-medium transition-colors"
      }
    >
      <Icon size={12} strokeWidth={1.9} />
      {label}
    </button>
  );
}
