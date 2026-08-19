"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import {
  AlertTriangle,
  CalendarRange,
  ChevronDown,
  Plus,
  TrendingUp,
} from "lucide-react";
import { EventBudgetModal } from "@/components/event-budget-modal";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { RowActions } from "@/components/ui/row-actions";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/components/ui/toast";
import { CategoryIcon, categoryLabel, toneColor } from "@/components/category-icon";
import { createClient } from "@/lib/supabase/client";
import {
  EVENT_PRESETS,
  eventProgress,
  eventTiming,
  isAheadOfPace,
  type CountableMovement,
  type EventBudget,
} from "@/lib/event-budgets";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { Category } from "@/lib/categories";

type Loaded = EventBudget & { categoryIds: string[] };

/**
 * Event budgets — the Pakistani half of the Budgets module.
 *
 * A monthly cap answers "how much on Food in August?". That is the wrong shape
 * for the spending a household here actually plans for: Ramadan is not a
 * calendar month and moves eleven days a year, Qurbani is one animal bought in
 * one week, and a shaadi runs for three months across four categories at once.
 *
 * READS ONLY. Every figure on this panel is computed from `transactions` rows
 * that already exist; nothing here writes to the ledger, and switching the
 * whole module off changes no balance anywhere.
 */
export function EventBudgetPanel({
  householdId,
  categories,
  readOnly = false,
}: {
  householdId: string;
  categories: Category[];
  readOnly?: boolean;
}) {
  const supabase = createClient();
  const { showToast } = useToast();
  const locale = useLocale();

  const [events, setEvents] = React.useState<Loaded[]>([]);
  const [movements, setMovements] = React.useState<CountableMovement[]>([]);
  const [overrides, setOverrides] = React.useState<Map<string, Map<string, boolean>>>(
    () => new Map(),
  );
  const [loading, setLoading] = React.useState(true);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Loaded | null>(null);
  const [deleting, setDeleting] = React.useState<Loaded | null>(null);

  const reload = () => setRefreshKey((k) => k + 1);

  React.useEffect(() => {
    if (!householdId) return;
    let active = true;

    async function load() {
      const [evRes, linkRes, ovRes] = await Promise.all([
        supabase
          .from("event_budgets")
          .select("*")
          .eq("household_id", householdId)
          .order("start_date", { ascending: false }),
        supabase.from("event_budget_categories").select("*"),
        supabase.from("event_budget_overrides").select("*"),
      ]);

      if (!active) return;

      if (evRes.error) {
        showToast({
          type: "error",
          title: "Could not load event budgets",
          description: evRes.error.message,
        });
        setLoading(false);
        return;
      }

      const rows = evRes.data ?? [];
      const byEvent = new Map<string, string[]>();
      for (const l of linkRes.data ?? []) {
        byEvent.set(l.event_budget_id, [
          ...(byEvent.get(l.event_budget_id) ?? []),
          l.category_id,
        ]);
      }
      setEvents(rows.map((e) => ({ ...e, categoryIds: byEvent.get(e.id) ?? [] })));

      const ov = new Map<string, Map<string, boolean>>();
      for (const o of ovRes.data ?? []) {
        const inner = ov.get(o.event_budget_id) ?? new Map<string, boolean>();
        inner.set(o.transaction_id, o.include);
        ov.set(o.event_budget_id, inner);
      }
      setOverrides(ov);

      /*
       * Fetch the movements ONCE, across the whole span every event covers,
       * rather than per event. Six overlapping Ramadan/Eid/Qurbani windows would
       * otherwise be six near-identical queries for the same rows.
       */
      if (rows.length > 0) {
        const from = rows.reduce((min, e) => (e.start_date < min ? e.start_date : min), rows[0].start_date);
        const to = rows.reduce((max, e) => (e.end_date > max ? e.end_date : max), rows[0].end_date);

        const { data: tx } = await supabase
          .from("transactions")
          .select("id, date, amount_paisa, category_id, note, account_id, type, is_opening")
          .eq("household_id", householdId)
          .gte("date", from)
          .lte("date", to);
        if (!active) return;
        setMovements((tx ?? []) as CountableMovement[]);
      } else {
        setMovements([]);
      }

      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [householdId, supabase, refreshKey, showToast]);

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase
      .from("event_budgets")
      .delete()
      .eq("id", deleting.id);

    if (error) {
      showToast({ type: "error", title: "Could not delete", description: error.message });
      return;
    }
    showToast({
      type: "success",
      title: `“${deleting.name}” removed`,
      description: "Your entries and balances are unchanged — this only tracked them.",
    });
    setDeleting(null);
    reload();
  };

  return (
    <>
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-[15px] font-semibold tracking-[-0.01em]">
              Event budgets
            </h2>
            <p className="text-muted mt-0.5 text-[12px]">
              Ramadan, Eid, Qurbani, a shaadi — occasions a month never lines up with.
            </p>
          </div>

          <button
            type="button"
            disabled={readOnly}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="border-border bg-surface hover:bg-surface-subtle shadow-xs flex h-9 shrink-0 items-center gap-1.5 rounded-control border px-3.5 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={15} className="text-brass-strong" />
            <span className="hidden min-[380px]:inline">New event</span>
          </button>
        </div>

        {loading ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="shimmer h-36 rounded-panel" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            title="No occasions set up"
            description="Ramadan groceries, Eid clothes, the Qurbani animal, a shaadi. Set a figure before it starts and the app tells you where you stand while it runs."
            action={
              <button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                disabled={readOnly}
                className="bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900 rounded-control px-4 py-2 text-xs font-semibold disabled:opacity-40"
              >
                <CalendarRange size={14} className="mr-1.5 inline" />
                Set one up
              </button>
            }
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                movements={movements}
                overrides={overrides.get(event.id) ?? new Map()}
                categories={categories}
                locale={locale}
                readOnly={readOnly}
                onEdit={() => {
                  setEditing(event);
                  setFormOpen(true);
                }}
                onDelete={() => setDeleting(event)}
              />
            ))}
          </div>
        )}
      </section>

      <EventBudgetModal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        householdId={householdId}
        categories={categories}
        event={editing}
        onSuccess={reload}
      />

      <ConfirmDeleteModal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Remove this event budget?"
        recordLabel={deleting?.name ?? ""}
        recordMeta={
          deleting
            ? `${formatPKR(Number(deleting.amount_paisa))} · ${deleting.start_date} to ${deleting.end_date}`
            : undefined
        }
        confirmLabel="Remove"
        defaultCascade={false}
        cascadeLabel=""
        linkedRefs={[
          {
            kind: "Your entries",
            label: "Untouched — this only watched them, it never held any money",
          },
        ]}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */

function EventCard({
  event,
  movements,
  overrides,
  categories,
  locale,
  readOnly,
  onEdit,
  onDelete,
}: {
  event: Loaded;
  movements: CountableMovement[];
  overrides: ReadonlyMap<string, boolean>;
  categories: Category[];
  locale: string;
  readOnly: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = React.useState(false);

  const categoryIds = React.useMemo(
    () => new Set(event.categoryIds),
    [event.categoryIds],
  );
  const progress = eventProgress(movements, event, categoryIds, overrides);
  const timing = eventTiming(event);
  const ahead = isAheadOfPace(progress, timing);

  const preset = EVENT_PRESETS[event.kind];
  const counted = movements.filter((m) => progress.countedIds.includes(m.id));
  const byId = new Map(categories.map((c) => [c.id, c]));

  const tone = progress.overspent ? "loss" : ahead ? "brass" : "gain";

  return (
    <div className="group bg-surface border-border shadow-xs flex flex-col overflow-hidden rounded-panel border">
      <div className="flex items-start gap-3 p-4 pb-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-card"
          style={{
            background: `color-mix(in oklab, ${toneColor(3)} 14%, transparent)`,
            color: toneColor(3),
          }}
        >
          <CategoryIcon icon={preset.icon} size={17} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-[13.5px] font-semibold">
            {event.name}
          </p>
          <p className="text-faint mt-0.5 flex flex-wrap items-center gap-x-2 text-[10.5px]">
            <span
              className={cn(
                "font-medium",
                timing.phase === "running" && "text-brass-strong",
              )}
            >
              {timing.label}
            </span>
            <span className="ltr">
              {event.start_date} → {event.end_date}
            </span>
          </p>
        </div>

        <RowActions
          onEdit={readOnly ? undefined : onEdit}
          onDelete={readOnly ? undefined : onDelete}
          editLabel="Edit event"
          deleteLabel="Remove event"
          reveal="hover"
        />
      </div>

      {/* ---- The bar ---------------------------------------------------- */}
      <div className="px-4 pb-3">
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="tnum text-foreground text-[15px] font-semibold">
            {formatPKR(progress.spentPaisa)}
          </span>
          <span className="tnum text-muted text-[11.5px]">
            of {formatPKR(Number(event.amount_paisa))}
          </span>
        </div>

        <div className="bg-surface-3 h-2 w-full overflow-hidden rounded-full">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              tone === "loss" && "bg-loss",
              tone === "brass" && "bg-brass",
              tone === "gain" && "bg-gain",
            )}
            style={{ width: `${Math.min(100, Math.round(progress.ratio * 100))}%` }}
          />
        </div>

        <p
          className={cn(
            "mt-1.5 flex items-center gap-1.5 text-[11px]",
            progress.overspent ? "text-loss font-medium" : "text-muted",
          )}
        >
          {progress.overspent ? (
            <>
              <AlertTriangle size={11} className="shrink-0" />
              {formatPKR(-progress.remainingPaisa)} over
            </>
          ) : ahead ? (
            <>
              <TrendingUp size={11} className="text-brass-strong shrink-0" />
              <span className="text-brass-strong font-medium">
                Ahead of pace
              </span>
              <span className="text-faint">
                · {formatPKR(progress.remainingPaisa)} left
              </span>
            </>
          ) : (
            <>{formatPKR(progress.remainingPaisa)} left</>
          )}
        </p>
      </div>

      {/* ---- What is being counted -------------------------------------- */}
      <div className="border-border mt-auto border-t">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="hover:bg-surface-subtle flex w-full items-center gap-2 px-4 py-2 text-left transition-colors"
        >
          <span className="text-muted text-[11px] font-medium">
            {counted.length === 0
              ? "Nothing counted yet"
              : `${counted.length} ${counted.length === 1 ? "entry" : "entries"} counted`}
          </span>

          <span className="ms-auto flex items-center gap-1.5">
            {event.categoryIds.slice(0, 3).map((id) => {
              const c = byId.get(id);
              if (!c) return null;
              return (
                <span key={id} style={{ color: toneColor(c.tone) }} title={c.name}>
                  <CategoryIcon icon={c.icon} size={11} />
                </span>
              );
            })}
            {event.categoryIds.length === 0 && (
              <span className="text-faint text-[10px]">all categories</span>
            )}
            <ChevronDown
              size={13}
              className={cn("text-muted transition-transform", open && "rotate-180")}
            />
          </span>
        </button>

        {open && (
          <ul className="divide-border border-border max-h-56 divide-y overflow-y-auto border-t">
            {counted.length === 0 ? (
              <li className="text-faint px-4 py-3 text-[11px] italic">
                Nothing in these categories between those dates yet.
              </li>
            ) : (
              counted
                .slice()
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .map((m) => {
                  const c = m.category_id ? byId.get(m.category_id) : null;
                  return (
                    <li
                      key={m.id}
                      className="flex items-center gap-2.5 px-4 py-1.5 text-[11.5px]"
                    >
                      <span className="text-foreground-2 min-w-0 flex-1 truncate">
                        {m.note || (c ? categoryLabel(c, locale) : "Entry")}
                      </span>
                      <span className="text-faint ltr shrink-0 text-[10.5px]">
                        {m.date.slice(5)}
                      </span>
                      <span className="tnum text-foreground shrink-0 font-medium">
                        {formatPKR(Math.abs(Number(m.amount_paisa)))}
                      </span>
                    </li>
                  );
                })
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
