import { todayISO } from "@/lib/ledger";

import type { EventBudgetKind, Tables } from "@/lib/supabase/types";

export type EventBudget = Tables<"event_budgets">;
export type EventBudgetOverride = Tables<"event_budget_overrides">;

/** Just enough of a movement to decide whether it counts and to render it. */
export interface CountableMovement {
  id: string;
  date: string;
  amount_paisa: number;
  category_id: string | null;
  note: string | null;
  account_id: string;
  type: string;
  is_opening: boolean;
}

/* -------------------------------------------------------------------------- *
 * Presets
 * -------------------------------------------------------------------------- */

/**
 * The occasions a Pakistani household actually plans around.
 *
 * Each carries the categories it usually lands in, so the create form can be
 * ONE field — a name and an amount — and still produce something that measures
 * the right thing. Every preset is editable afterwards; none of this is
 * enforced anywhere.
 *
 * `days` is a typical length, used only to pre-fill the end date. Ramadan moves
 * about eleven days earlier each year, so the DATES are never guessed — the user
 * picks the start and this only suggests how long it runs.
 */
export const EVENT_PRESETS: Record<
  EventBudgetKind,
  { label: string; labelUr: string; icon: string; days: number; categories: string[]; hint: string }
> = {
  ramadan: {
    label: "Ramadan",
    labelUr: "رمضان",
    icon: "Moon",
    days: 30,
    categories: ["food", "giving", "bills"],
    hint: "Sehri and iftar push the grocery bill up, and Zakat and fitrana land in the same month.",
  },
  eid_fitr: {
    label: "Eid-ul-Fitr",
    labelUr: "عید الفطر",
    icon: "PartyPopper",
    days: 10,
    categories: ["shopping", "giving", "food"],
    hint: "Clothes, shoes, eidi and the sweets — mostly spent in the last ten days of Ramadan.",
  },
  eid_adha: {
    label: "Eid-ul-Adha",
    labelUr: "عید الاضحیٰ",
    icon: "Gift",
    days: 10,
    categories: ["shopping", "giving", "food"],
    hint: "Separate from Qurbani itself, which is usually the bigger figure.",
  },
  qurbani: {
    label: "Qurbani",
    labelUr: "قربانی",
    icon: "Wheat",
    days: 14,
    categories: ["giving", "food"],
    hint: "The animal, the mandi trip, the butcher and the distribution.",
  },
  shaadi: {
    label: "Shaadi",
    labelUr: "شادی",
    icon: "HandHeart",
    days: 90,
    categories: ["events", "shopping", "food", "giving"],
    hint: "Runs for months, not days. Set the window wide and narrow it later.",
  },
  school: {
    label: "School admission",
    labelUr: "داخلہ",
    icon: "GraduationCap",
    days: 45,
    categories: ["education", "shopping"],
    hint: "Admission fee, books, uniform and shoes all land in the same few weeks.",
  },
  custom: {
    label: "Something else",
    labelUr: "کچھ اور",
    icon: "CalendarRange",
    days: 30,
    categories: [],
    hint: "Any occasion with a start, an end and a figure you do not want to pass.",
  },
};

export const EVENT_KIND_ORDER: EventBudgetKind[] = [
  "ramadan",
  "eid_fitr",
  "eid_adha",
  "qurbani",
  "shaadi",
  "school",
  "custom",
];

/* -------------------------------------------------------------------------- *
 * What counts
 * -------------------------------------------------------------------------- */

/**
 * DOES THIS MOVEMENT COUNT TOWARDS THIS EVENT — the single answer, used by the
 * progress bar, the detail list and the "add or remove" toggle alike.
 *
 * Order matters. An explicit override wins over every rule, because it exists
 * precisely for the cases the rules get wrong: Eid clothes bought a week early
 * are Eid spending, and the petrol you happened to buy during Ramadan is not.
 *
 * Excluded before anything else is even considered:
 *   TRANSFERS — two legs that cancel. Counting an ATM withdrawal as Ramadan
 *   spending would charge you for moving your own money between your own
 *   pockets, and then charge you again when you spent it.
 *   OPENING BALANCES — the position an account started at, never a purchase.
 *   INCOME — an event budget is a spending cap. Salary arriving mid-Ramadan is
 *   not progress towards the Rs 80,000.
 */
export function countsTowardsEvent(
  movement: CountableMovement,
  event: EventBudget,
  categoryIds: ReadonlySet<string>,
  overrides: ReadonlyMap<string, boolean>,
): boolean {
  if (movement.type === "transfer" || movement.is_opening) return false;
  if (movement.amount_paisa >= 0) return false;

  const override = overrides.get(movement.id);
  if (override !== undefined) return override;

  if (movement.date < event.start_date || movement.date > event.end_date) {
    return false;
  }
  // No categories chosen means "everything in the window", which is the honest
  // reading of a one-field form rather than a filter that matches nothing.
  if (categoryIds.size === 0) return true;
  return movement.category_id !== null && categoryIds.has(movement.category_id);
}

export interface EventProgress {
  spentPaisa: number;
  remainingPaisa: number;
  /** 0–1, uncapped at the top so an overspend can be shown as one. */
  ratio: number;
  overspent: boolean;
  countedIds: string[];
}

export function eventProgress(
  movements: CountableMovement[],
  event: EventBudget,
  categoryIds: ReadonlySet<string>,
  overrides: ReadonlyMap<string, boolean>,
): EventProgress {
  const counted = movements.filter((m) =>
    countsTowardsEvent(m, event, categoryIds, overrides),
  );
  // Magnitudes: expenses are stored negative, and a progress bar that counts
  // down from zero is not a progress bar.
  const spentPaisa = counted.reduce((s, m) => s + Math.abs(Number(m.amount_paisa)), 0);
  const budget = Number(event.amount_paisa);

  return {
    spentPaisa,
    remainingPaisa: budget - spentPaisa,
    ratio: budget > 0 ? spentPaisa / budget : 0,
    overspent: spentPaisa > budget,
    countedIds: counted.map((m) => m.id),
  };
}

/* -------------------------------------------------------------------------- *
 * Timing
 * -------------------------------------------------------------------------- */

export type EventPhase = "upcoming" | "running" | "finished";

export function eventPhase(event: EventBudget, from: string = todayISO()): EventPhase {
  if (from < event.start_date) return "upcoming";
  if (from > event.end_date) return "finished";
  return "running";
}

/** Whole days between two ISO dates. Local, so no timezone drift on the edges. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round(
    (new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) /
      86_400_000,
  );
}

/**
 * How the event reads in one line: "Starts in 12 days", "Day 8 of 30".
 *
 * The running case names the day rather than the date because that is the
 * number the pace warning is computed from, and showing one while reasoning
 * about the other is how a progress bar starts looking like it is lying.
 */
export function eventTiming(event: EventBudget, from: string = todayISO()) {
  const phase = eventPhase(event, from);
  const total = daysBetween(event.start_date, event.end_date) + 1;

  if (phase === "upcoming") {
    const away = daysBetween(from, event.start_date);
    return {
      phase,
      total,
      elapsed: 0,
      label: away === 1 ? "Starts tomorrow" : `Starts in ${away} days`,
    };
  }
  if (phase === "finished") {
    const ago = daysBetween(event.end_date, from);
    return {
      phase,
      total,
      elapsed: total,
      label: ago === 1 ? "Ended yesterday" : `Ended ${ago} days ago`,
    };
  }

  const elapsed = daysBetween(event.start_date, from) + 1;
  return { phase, total, elapsed, label: `Day ${elapsed} of ${total}` };
}

/**
 * Is spending running ahead of the calendar?
 *
 * Compares the share of the budget used against the share of the event elapsed.
 * Deliberately silent in the first fifth: almost every event front-loads —
 * Ramadan groceries are bought on day one, the shaadi deposit goes early — and
 * a warning that fires on day two of thirty is a warning people learn to
 * dismiss. It also never fires on a finished event, where the figure is simply
 * the result.
 */
export function isAheadOfPace(
  progress: EventProgress,
  timing: ReturnType<typeof eventTiming>,
): boolean {
  if (timing.phase !== "running") return false;
  const elapsedShare = timing.elapsed / timing.total;
  if (elapsedShare < 0.2) return false;
  return progress.ratio > elapsedShare + 0.15;
}
