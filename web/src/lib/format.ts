/**
 * Money and units, Pakistani conventions.
 *
 * Amounts are stored as integer PAISA everywhere — never floats. 1 rupee = 100
 * paisa. Formatting is the only place rupees exist.
 *
 * Grouping is South Asian: 1,25,000 not 125,000. `Intl.NumberFormat("en-PK")`
 * does NOT do this — it applies Western grouping — so the grouping is done here.
 */

export const PAISA = 100;
export const GRAMS_PER_TOLA = 11.6638;

/** 1,25,000 — last three digits, then pairs. */
function groupSouthAsian(digits: string): string {
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3);
  const tail = digits.slice(-3);
  return `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${tail}`;
}

export type MoneyParts = {
  sign: "" | "-";
  symbol: string;
  whole: string;
  fraction: string | null;
  suffix: string | null;
};

/**
 * Split so the caller can de-emphasise the symbol, decimals and unit — SPEC §3
 * puts units at ~40% of the figure's size and in muted colour.
 */
export function moneyParts(
  paisa: number,
  { compact = false, decimals = false }: { compact?: boolean; decimals?: boolean } = {},
): MoneyParts {
  const sign = paisa < 0 ? "-" : "";
  const abs = Math.abs(paisa);
  const rupees = abs / PAISA;

  if (compact) {
    if (rupees >= 1e7) {
      return { sign, symbol: "Rs", whole: trim(rupees / 1e7), fraction: null, suffix: "crore" };
    }
    if (rupees >= 1e5) {
      return { sign, symbol: "Rs", whole: trim(rupees / 1e5), fraction: null, suffix: "lakh" };
    }
  }

  const whole = Math.floor(rupees);
  const frac = Math.round((rupees - whole) * 100);
  return {
    sign,
    symbol: "Rs",
    whole: groupSouthAsian(String(whole)),
    fraction: decimals ? String(frac).padStart(2, "0") : null,
    suffix: null,
  };
}

function trim(n: number): string {
  // 1.50 -> "1.5", 1.00 -> "1", 12.47 -> "12.5" (two significant-ish digits)
  const rounded = n >= 10 ? n.toFixed(1) : n.toFixed(2);
  return rounded.replace(/\.?0+$/, "");
}

/** "Rs 1,25,000" */
export function formatPKR(paisa: number, opts?: { decimals?: boolean }): string {
  const p = moneyParts(paisa, { decimals: opts?.decimals });
  return `${p.sign}${p.symbol} ${p.whole}${p.fraction ? `.${p.fraction}` : ""}`;
}

/** "Rs 12.5 lakh" — for KPI positions where the full figure is noise. */
export function formatPKRCompact(paisa: number): string {
  const p = moneyParts(paisa, { compact: true });
  return `${p.sign}${p.symbol} ${p.whole}${p.suffix ? ` ${p.suffix}` : ""}`;
}

/** Signed delta with an explicit + so gains read as gains. */
export function formatDelta(paisa: number, opts?: { compact?: boolean }): string {
  const body = opts?.compact ? formatPKRCompact(paisa) : formatPKR(paisa);
  return paisa > 0 ? `+${body}` : body;
}

export function formatPercent(fraction: number, digits = 1): string {
  const pct = fraction * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(digits)}%`;
}

/** Gold is quoted and held in tola in Pakistan, not grams or ounces. */
export function gramsToTola(grams: number): number {
  return grams / GRAMS_PER_TOLA;
}

export function formatTola(grams: number, digits = 2): string {
  return `${gramsToTola(grams).toFixed(digits)} tola`;
}

/**
 * Hijri date, derived at read time — never stored. Ramadan, both Eids and the
 * Zakat hawl anniversary all key off this.
 */
export function formatHijri(date: Date, locale = "en"): string {
  return new Intl.DateTimeFormat(`${locale}-u-ca-islamic-umalqura`, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function hijriMonth(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
    month: "numeric",
  }).formatToParts(date);
  return Number(parts.find((p) => p.type === "month")?.value ?? 0);
}

/** FBR tax year runs 1 July – 30 June. "2025-26" for a date in Nov 2025. */
export function fiscalYearLabel(date: Date): string {
  const y = date.getFullYear();
  const start = date.getMonth() >= 6 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** Formats first_name + last_name with fallbacks. */
export function formatName(firstName?: string | null, lastName?: string | null, fallback = "User"): string {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name || fallback;
}

