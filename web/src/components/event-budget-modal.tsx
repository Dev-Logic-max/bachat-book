"use client";

import * as React from "react";
import { CalendarRange, Check, Info } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast";
import { CategoryIcon, categoryLabel, toneColor } from "@/components/category-icon";
import { createClient } from "@/lib/supabase/client";
import { byCatalogueOrder, type Category } from "@/lib/categories";
import { EVENT_KIND_ORDER, EVENT_PRESETS } from "@/lib/event-budgets";
import { todayISO } from "@/lib/ledger";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useLocale } from "next-intl";

import type { EventBudget } from "@/lib/event-budgets";
import type { EventBudgetKind } from "@/lib/supabase/types";

/** `start` + n days, as an ISO date. Local arithmetic, no timezone drift. */
function addDays(start: string, days: number): string {
  const [y, m, d] = start.split("-").map(Number);
  const at = new Date(y, m - 1, d + days);
  return `${at.getFullYear()}-${`${at.getMonth() + 1}`.padStart(2, "0")}-${`${at.getDate()}`.padStart(2, "0")}`;
}

/**
 * Set money aside for an occasion.
 *
 * TWO FIELDS ARE ENOUGH. Pick Ramadan, type 80,000, done — the preset fills the
 * length and the categories that occasion usually lands in. Everything below
 * that is adjustable and nothing below it is required, which is what keeps this
 * usable for someone who wants a number to aim at and still complete for someone
 * who wants to measure exactly.
 *
 * The dates are never guessed. Ramadan moves about eleven days earlier each
 * year, so a preset that "knew" when it started would be wrong within a year and
 * confidently wrong after that. The preset suggests a LENGTH; the user says when.
 */
export function EventBudgetModal({
  isOpen,
  onClose,
  householdId,
  categories,
  event = null,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  householdId: string;
  categories: Category[];
  /** Present = edit mode. */
  event?: (EventBudget & { categoryIds: string[] }) | null;
  onSuccess?: () => void;
}) {
  const supabase = createClient();
  const { showToast } = useToast();
  const locale = useLocale();
  const isEdit = Boolean(event);

  const [kind, setKind] = React.useState<EventBudgetKind>("ramadan");
  const [name, setName] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [startDate, setStartDate] = React.useState(todayISO());
  const [endDate, setEndDate] = React.useState(addDays(todayISO(), 29));
  const [picked, setPicked] = React.useState<ReadonlySet<string>>(() => new Set());
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Re-seed on open / when the edited row changes. The component stays mounted
  // between openings, and React Compiler rejects a setState inside useEffect.
  const seedKey = `${isOpen}:${event?.id ?? "new"}`;
  const [seeded, setSeeded] = React.useState(seedKey);
  if (seeded !== seedKey) {
    setSeeded(seedKey);
    setError(null);
    if (isOpen) {
      if (event) {
        setKind(event.kind);
        setName(event.name);
        setAmount(String(Number(event.amount_paisa) / 100));
        setStartDate(event.start_date);
        setEndDate(event.end_date);
        setPicked(new Set(event.categoryIds));
        setNote(event.note ?? "");
      } else {
        const preset = EVENT_PRESETS.ramadan;
        setKind("ramadan");
        setName(preset.label);
        setAmount("");
        setStartDate(todayISO());
        setEndDate(addDays(todayISO(), preset.days - 1));
        setPicked(new Set(preset.categories));
        setNote("");
      }
    }
  }

  /** Switching preset rewrites the name, length and categories — unless edited. */
  const applyPreset = (next: EventBudgetKind) => {
    const preset = EVENT_PRESETS[next];
    setKind(next);
    // Only replace a name the user has not made their own.
    const wasPresetName = EVENT_KIND_ORDER.some(
      (k) => EVENT_PRESETS[k].label === name.trim(),
    );
    if (!name.trim() || wasPresetName) {
      setName(next === "custom" ? "" : preset.label);
    }
    setEndDate(addDays(startDate, preset.days - 1));
    setPicked(new Set(preset.categories));
  };

  const parents = React.useMemo(
    () =>
      categories
        .filter((c) => !c.parent_id && c.kind === "expense" && c.is_active)
        .sort(byCatalogueOrder),
    [categories],
  );

  const togglePicked = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const paisa = Math.round((parseFloat(amount) || 0) * 100);

  const dayCount = (() => {
    const [sy, sm, sd] = startDate.split("-").map(Number);
    const [ey, em, ed] = endDate.split("-").map(Number);
    return (
      Math.round(
        (new Date(ey, em - 1, ed).getTime() - new Date(sy, sm - 1, sd).getTime()) /
          86_400_000,
      ) + 1
    );
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give it a name — “Ramadan 2027”, “Ayesha's shaadi”.");
      return;
    }
    if (paisa <= 0) {
      setError("Set the amount you want to stay inside.");
      return;
    }
    if (endDate < startDate) {
      setError("The end date is before the start date.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: trimmed,
        kind,
        amount_paisa: paisa,
        start_date: startDate,
        end_date: endDate,
        note: note.trim() || null,
      };

      let id = event?.id ?? "";

      if (isEdit && event) {
        const { error: err } = await supabase
          .from("event_budgets")
          .update(payload)
          .eq("id", event.id);
        if (err) throw err;
        // Replace the category set wholesale — a diff of two small sets is more
        // code than it saves, and the table is a plain join with no history.
        await supabase
          .from("event_budget_categories")
          .delete()
          .eq("event_budget_id", event.id);
      } else {
        const { data, error: err } = await supabase
          .from("event_budgets")
          .insert({ ...payload, household_id: householdId })
          .select("id")
          .single();
        if (err || !data) throw err ?? new Error("Could not create the event.");
        id = data.id;
      }

      if (picked.size > 0) {
        const { error: linkErr } = await supabase
          .from("event_budget_categories")
          .insert([...picked].map((category_id) => ({ event_budget_id: id, category_id })));
        if (linkErr) throw linkErr;
      }

      showToast({
        type: "success",
        title: isEdit ? "Event updated" : `${trimmed} is set up`,
        description: `${formatPKR(paisa)} across ${dayCount} day${dayCount === 1 ? "" : "s"}.`,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit event budget" : "Money set aside for an occasion"}
      subtitle={
        isEdit ? name : "Ramadan, Eid, Qurbani, a shaadi — anything with a date range"
      }
      icon={<CalendarRange size={16} />}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={saving}>
            {isEdit ? "Save changes" : "Set it up"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* ---- Occasion ------------------------------------------------- */}
        {!isEdit && (
          <fieldset>
            <legend className="text-foreground-2 mb-2 block text-xs font-medium">
              What is it for?
            </legend>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {EVENT_KIND_ORDER.map((k) => {
                const preset = EVENT_PRESETS[k];
                const active = k === kind;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => applyPreset(k)}
                    aria-pressed={active}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-control border px-2 py-2.5 text-[11px] font-medium transition-colors",
                      active
                        ? "border-brass/50 bg-brass-soft text-brass-strong"
                        : "border-border text-muted hover:text-foreground-2 hover:bg-surface-subtle",
                    )}
                  >
                    <CategoryIcon icon={preset.icon} size={15} />
                    <span className="truncate">{preset.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-faint mt-1.5 text-[11px] italic leading-snug">
              {EVENT_PRESETS[kind].hint}
            </p>
          </fieldset>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Name"
            placeholder="e.g. Ramadan 2027"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            required
          />
          <Input
            label="Amount to stay inside (PKR)"
            type="number"
            step="any"
            min="0"
            inputMode="decimal"
            placeholder="e.g. 80000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="tnum"
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DatePicker
            label="Starts"
            value={startDate}
            onChange={(v) => {
              setStartDate(v);
              // Keep the window the same length when the start moves, rather
              // than silently inverting the range.
              if (endDate < v) setEndDate(addDays(v, EVENT_PRESETS[kind].days - 1));
            }}
            required
          />
          <DatePicker
            label="Ends"
            value={endDate}
            onChange={setEndDate}
            min={startDate}
            required
          />
        </div>

        {/* ---- Categories ------------------------------------------------ */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-foreground-2 text-xs font-medium">
              Which spending counts?
            </span>
            <span className="text-faint text-[10.5px]">
              {picked.size === 0 ? "everything" : `${picked.size} selected`}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {parents.map((c) => {
              const on = picked.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => togglePicked(c.id)}
                  aria-pressed={on}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                    on ? "border-transparent" : "border-border text-muted hover:text-foreground-2",
                  )}
                  style={
                    on
                      ? {
                          background: `color-mix(in oklab, ${toneColor(c.tone)} 16%, transparent)`,
                          color: toneColor(c.tone),
                        }
                      : undefined
                  }
                >
                  <CategoryIcon icon={c.icon} size={11} />
                  <span dir="auto" className="copy">
                    {categoryLabel(c, locale)}
                  </span>
                  {on && <Check size={11} />}
                </button>
              );
            })}
          </div>

          <p className="text-faint flex items-start gap-1.5 text-[11px] italic leading-snug">
            <Info size={12} className="mt-0.5 shrink-0" />
            {picked.size === 0
              ? "Nothing selected means every expense between those dates counts. Narrow it down if petrol and school fees should not."
              : "Only these categories count, and only between the dates above. You can still add or drop a single entry afterwards."}
          </p>
        </div>

        <Input
          label="Note (optional)"
          placeholder="e.g. Includes fitrana for six people"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {/*
          The consequence, stated before the click. An event budget writes
          NOTHING to the ledger — it is a saved question asked of entries that
          already exist — and saying so is what stops it being mistaken for a
          transfer into a savings pot.
        */}
        <p className="border-border text-faint rounded-card border border-dashed px-3 py-2 text-[11px] italic leading-snug">
          Nothing is moved or deducted. This watches the entries you already log
          and tells you where you stand against {paisa > 0 ? formatPKR(paisa) : "the figure"} across{" "}
          {dayCount} day{dayCount === 1 ? "" : "s"}.
        </p>

        {error && (
          <p className="text-loss text-[11.5px] font-medium" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
