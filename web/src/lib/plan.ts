import type { Json, Views } from "@/lib/supabase/types";

/**
 * Everything the app knows about plans, in one place.
 *
 * The rule that matters: a plan belongs to a PERSON, and a workspace's
 * entitlements are its OWNER's. Never gate a feature on the plan of whoever
 * happens to be looking — a free member inside a Pro workspace would then see
 * different numbers from the owner on the same screen, with no way to tell why.
 * `workspace_access.plan_code` already resolves the owner; read that.
 */

export type PlanCode = "free" | "pro";

export type WorkspaceAccess = Views<"workspace_access">;

/** Mirrors the `limits` jsonb on `plans`, which a super admin can edit live. */
export type PlanLimits = {
  workspaces: number;
  household_members: number;
  accounts: number;
  budget_categories: number;
  committees: number;
  receipts_per_month: number;
  exports: string[];
  [key: string]: Json | undefined;
};

/** -1 means unlimited, which is how the seeded plan rows already encode it. */
export const UNLIMITED = -1;

export function isUnlimited(limit: number | null | undefined): boolean {
  return limit === UNLIMITED;
}

export function withinLimit(used: number, limit: number | null | undefined): boolean {
  if (limit === null || limit === undefined) return true;
  return isUnlimited(limit) || used < limit;
}

export function formatLimit(limit: number | null | undefined): string {
  if (limit === null || limit === undefined) return "—";
  return isUnlimited(limit) ? "Unlimited" : String(limit);
}

/**
 * The saving on the yearly plan is COMPUTED, never stored.
 *
 * A stored "20%" badge and an admin-edited price are two copies of one fact, and
 * the moment someone changes the monthly price and forgets the badge they
 * disagree — on the pricing page, in public.
 */
export function yearlySavingPercent(
  monthlyPaisa: number,
  yearlyPaisa: number,
): number {
  const twelveMonths = monthlyPaisa * 12;
  if (twelveMonths <= 0 || yearlyPaisa <= 0 || yearlyPaisa >= twelveMonths) return 0;
  return Math.round((1 - yearlyPaisa / twelveMonths) * 100);
}

/**
 * Days until the subscription lapses. Null when there is nothing to count down
 * to — a free plan never expires, so a "0 days left" chip on it would be a lie.
 */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / 86_400_000);
}

/**
 * The date this subscription actually runs out.
 *
 * A trial counts down to `trial_ends_at`, a paid period to `current_period_end`.
 * Reading the wrong one shows a trialling user their (null) renewal date and
 * tells them they have forever. Free sits on `active` with no end date, which
 * correctly yields null — nothing to count down to.
 */
export function periodEndsAt(sub: {
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
} | null): string | null {
  if (!sub) return null;
  return sub.status === "trialing" ? sub.trial_ends_at : sub.current_period_end;
}

/**
 * What to call the subscription on screen.
 *
 * The stored `status` alone is not enough: entitlement is evaluated against the
 * clock in the database, so a row can still read `trialing` while the trial has
 * already lapsed. Showing "Trialing" there would contradict the limits the user
 * is actually getting.
 */
export function subscriptionLabel(
  sub: {
    status: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
  } | null,
  planCode: string,
): string {
  if (!sub) return "Free";
  const days = daysUntil(periodEndsAt(sub));
  const lapsed = days !== null && days <= 0;

  if (sub.status === "trialing") return lapsed ? "Trial ended" : "Trial";
  if (sub.status === "active") return lapsed ? "Expired" : planCode === "pro" ? "Active" : "Free";
  if (sub.status === "past_due") return "Payment due";
  if (sub.status === "canceled") return "Cancelled";
  return sub.status;
}

export type ExpiryTone = "expired" | "urgent" | "soon" | "fine";

/** Drives the colour of the days-left chip; thresholds live here, not in JSX. */
export function expiryTone(days: number | null): ExpiryTone {
  if (days === null) return "fine";
  if (days <= 0) return "expired";
  if (days <= 3) return "urgent";
  if (days <= 14) return "soon";
  return "fine";
}

/**
 * Why a workspace is read-only, phrased for a person rather than a policy.
 *
 * Returns null when the workspace is writable. The workspace is NOT hidden and
 * its records are NOT deleted — reads stay open — so the copy has to say that,
 * or a locked workspace reads as lost data.
 */
export function workspaceReadOnlyReason(ws: WorkspaceAccess): string | null {
  if (ws.is_active) return null;
  return `Your plan covers ${ws.workspace_limit} workspace${
    ws.workspace_limit === 1 ? "" : "s"
  }. This one is view-only — everything in it is safe and still readable. Upgrade to edit it again.`;
}

export function canAddWorkspace(ws: WorkspaceAccess | null, ownedCount: number): boolean {
  if (!ws) return false;
  return withinLimit(ownedCount, ws.workspace_limit);
}

export function canAddMember(ws: WorkspaceAccess | null): boolean {
  if (!ws || !ws.is_active) return false;
  return withinLimit(ws.member_count, ws.member_limit);
}
