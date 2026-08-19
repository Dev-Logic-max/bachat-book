/**
 * Contacts — the people spine.
 *
 * This module used to be a worse copy of the phone's own contacts app: nothing
 * in the schema pointed at it, so a committee's organiser lived in a free-text
 * note, an entry could not say who was paid, and birthdays never reached the
 * calendar. It earns its place by being referenced, not by being visited.
 *
 * `transactions.contact_id` is the link, and it is deliberately behaviour-free.
 * Naming a person on an entry never changes an amount, a category or a balance.
 */

import type { Tables } from "@/lib/supabase/types";

export type Contact = Tables<"contacts">;

/** Just enough of a movement to summarise a person. */
export interface ContactMovement {
  id: string;
  date: string;
  amount_paisa: number;
  contact_id: string | null;
  type: string;
  is_opening: boolean;
  note: string | null;
}

/* -------------------------------------------------------------------------- *
 * Relationships
 * -------------------------------------------------------------------------- */

export type RelationshipDef = {
  key: string;
  label: string;
  labelUr: string;
  /** Lucide icon name; components map it, so this file stays JSX-free. */
  icon: string;
  hint: string;
};

export const RELATIONSHIPS: RelationshipDef[] = [
  { key: "family", label: "Family", labelUr: "خاندان", icon: "Users", hint: "Parents, siblings, in-laws" },
  { key: "friend", label: "Friend", labelUr: "دوست", icon: "Smile", hint: "Someone you lend to and borrow from" },
  { key: "colleague", label: "Work", labelUr: "کام", icon: "Briefcase", hint: "Colleagues and business contacts" },
  { key: "committee_member", label: "Committee", labelUr: "کمیٹی", icon: "Coins", hint: "Someone in a BC with you" },
  { key: "service", label: "Service provider", labelUr: "کاریگر", icon: "Wrench", hint: "Plumber, electrician, maid, driver" },
  { key: "tenant", label: "Tenant", labelUr: "کرایہ دار", icon: "KeyRound", hint: "Rents a shop, flat or plot from you" },
  { key: "customer", label: "Customer", labelUr: "گاہک", icon: "ShoppingBag", hint: "Buys from you, often on udhaar" },
  { key: "supplier", label: "Supplier", labelUr: "سپلائر", icon: "Truck", hint: "You buy stock from them" },
  { key: "other", label: "Other", labelUr: "دیگر", icon: "User", hint: "Anyone else" },
];

export function relationship(key: string | null | undefined): RelationshipDef {
  return RELATIONSHIPS.find((r) => r.key === key) ?? RELATIONSHIPS[RELATIONSHIPS.length - 1];
}

/* -------------------------------------------------------------------------- *
 * Birthdays
 * -------------------------------------------------------------------------- */

/**
 * The birthday's date in a given year, as YYYY-MM-DD.
 *
 * 29 February is the case that breaks the naive version. `new Date(2027, 1, 29)`
 * silently rolls forward to 1 March, so a leap-year birthday would quietly move
 * itself. Non-leap years land it on the 28th instead, which is the convention
 * Pakistani ID and bank systems use.
 */
export function birthdayInYear(birthday: string, year: number): string | null {
  const [, monthText, dayText] = birthday.split("-");
  const month = Number(monthText);
  const day = Number(dayText);
  if (!month || !day) return null;

  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const safeDay = Math.min(day, lastDayOfMonth);

  return `${year}-${`${month}`.padStart(2, "0")}-${`${safeDay}`.padStart(2, "0")}`;
}

/** Whole days until the next one, 0 when it is today. */
export function daysUntilBirthday(birthday: string, today = new Date()): number | null {
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
    const iso = birthdayInYear(birthday, year);
    if (!iso) return null;
    const when = new Date(`${iso}T00:00:00`);
    if (when >= midnight) {
      return Math.round((when.getTime() - midnight.getTime()) / 86_400_000);
    }
  }
  return null;
}

/** Age they are turning on their next birthday. Null if the year looks wrong. */
export function turningAge(birthday: string, today = new Date()): number | null {
  const birthYear = Number(birthday.slice(0, 4));
  if (!birthYear || birthYear < 1900) return null;

  const thisYears = birthdayInYear(birthday, today.getFullYear());
  if (!thisYears) return null;

  const alreadyPassed =
    new Date(`${thisYears}T00:00:00`) <
    new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return today.getFullYear() - birthYear + (alreadyPassed ? 1 : 0);
}

/** Every birthday falling inside a window, for the calendar grid. */
export function birthdaysBetween(
  contacts: Contact[],
  from: string,
  to: string,
): Array<{ contact: Contact; date: string }> {
  const rows: Array<{ contact: Contact; date: string }> = [];
  const fromYear = Number(from.slice(0, 4));
  const toYear = Number(to.slice(0, 4));

  for (const contact of contacts) {
    if (!contact.birthday) continue;
    // A window can straddle new year, so both years are checked.
    for (let year = fromYear; year <= toYear; year += 1) {
      const iso = birthdayInYear(contact.birthday, year);
      if (iso && iso >= from && iso <= to) rows.push({ contact, date: iso });
    }
  }

  return rows.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/* -------------------------------------------------------------------------- *
 * What has passed between you
 * -------------------------------------------------------------------------- */

export type ContactSummary = {
  /** Money that went OUT to them, as a positive figure. */
  paidPaisa: number;
  /** Money that came IN from them, as a positive figure. */
  receivedPaisa: number;
  /**
   * received − paid. Positive means they have given you more than you gave
   * them. This is NOT a debt: it is the net of recorded movements, and lending
   * is not modelled yet. The UI must not label it "owes".
   */
  netPaisa: number;
  count: number;
  lastDate: string | null;
};

/**
 * Transfers and opening balances are excluded, exactly as everywhere else.
 * A transfer is two legs that cancel, and an opening balance is not a payment
 * to anybody.
 */
export function summariseContact(
  contactId: string,
  movements: ContactMovement[],
): ContactSummary {
  let paidPaisa = 0;
  let receivedPaisa = 0;
  let count = 0;
  let lastDate: string | null = null;

  for (const m of movements) {
    if (m.contact_id !== contactId) continue;
    if (m.type === "transfer" || m.is_opening) continue;

    // Read the SIGN, never `type` — the sign is what the balance trigger used.
    if (Number(m.amount_paisa) < 0) paidPaisa += Math.abs(Number(m.amount_paisa));
    else receivedPaisa += Number(m.amount_paisa);

    count += 1;
    if (!lastDate || m.date > lastDate) lastDate = m.date;
  }

  return { paidPaisa, receivedPaisa, netPaisa: receivedPaisa - paidPaisa, count, lastDate };
}

/** Free-text match over everything shown on a contact card. */
export function matchesContact(contact: Contact, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const haystack = [
    contact.name,
    contact.phone,
    contact.email,
    contact.notes,
    relationship(contact.relationship).label,
    relationship(contact.relationship).labelUr,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return q.split(/\s+/).every((word) => haystack.includes(word));
}
