import { Banknote, Coins, Landmark, Lock, Smartphone } from "lucide-react";

import { MerchantMark } from "@/components/merchant-mark";
import type { SelectOption } from "@/components/ui/select";
import {
  ACCOUNT_TYPE_LABEL,
  accountBlockedReason,
  institutionLogo,
} from "@/lib/ledger";
import { formatPKR } from "@/lib/format";
import type { AccountType, Tables } from "@/lib/supabase/types";

export type AccountWithInstitution = Tables<"accounts"> & {
  institutions?: Tables<"institutions"> | null;
};

/**
 * One account row, everywhere an account is picked.
 *
 * The brand mark, the balance and the unavailable-reason chip were being rebuilt
 * by hand in four modals, each slightly differently — one showed
 * "Meezan Asaan (checking)", another just the name. This is the single shape.
 *
 * The BALANCE is the reason this exists. Choosing which account to spend from
 * without seeing what is in it is guesswork, and the transfer form was the worst
 * case: two plain dropdowns and no indication that the source had Rs 200 in it.
 */
export function accountSelectOptions(
  accounts: AccountWithInstitution[],
  {
    direction,
    showBalance = true,
    disableBlocked = true,
  }: {
    /** Which way the money moves. A lock only bites on the way out. */
    direction?: "income" | "expense";
    showBalance?: boolean;
    disableBlocked?: boolean;
  } = {},
): SelectOption[] {
  return accounts.map((a) => {
    const blocked = direction ? accountBlockedReason(a, direction) : null;
    const inst = a.institutions ?? null;

    return {
      value: a.id,
      label: a.name,
      description: [inst?.short_name ?? inst?.name, ACCOUNT_TYPE_LABEL[a.type] ?? a.type]
        .filter(Boolean)
        .join(" · "),
      icon: (
        <MerchantMark
          name={inst?.short_name ?? a.name}
          brand={inst?.brand_color ?? "#16233a"}
          logo={institutionLogo(inst?.logo_path) ?? undefined}
          awaitingLogo={Boolean(inst && !inst.logo_path)}
          size={26}
        />
      ),
      disabled: disableBlocked && Boolean(blocked),
      // The chip replaces the balance rather than crowding beside it: when a row
      // cannot be used, WHY matters more than how much is in it.
      meta: blocked ? (
        <span className="border-border bg-surface-subtle text-muted inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] leading-none font-medium">
          <Lock size={9} />
          {blocked}
        </span>
      ) : showBalance ? (
        <span className="tnum text-foreground-2 text-[11px] font-medium">
          {formatPKR(Number(a.balance_paisa))}
        </span>
      ) : undefined,
    };
  });
}

/**
 * Option builders shared by the add- and edit-account modals, so the two never
 * drift into showing different institutions or different type wording.
 */

const TYPE_ICON_CLASS = "size-[22px] shrink-0";

/**
 * An account is somewhere you HOLD money. That rules out two things the picker
 * used to offer:
 *
 * - `credit` — a card is money owed, not held, and the Accounts page adds every
 *   balance into one "Total Household Liquidity" figure. A card balance in that
 *   sum inflates net worth. Cards come back when they are modelled as liabilities.
 * - `investment` — National Savings, PSX and mutual funds belong to the Wealth
 *   module, not the cash-accounts wall.
 *
 * Wallet BRANDS deliberately do not appear here either. `accounts_type_check`
 * constrains `type`, so "JazzCash" cannot be a type; it is an institution, and
 * the institution picker gives each wallet its own logo row.
 *
 * Labels stay SHORT — this select sits in a half-width grid column, where
 * "Savings / Asaan account" clipped to "Savings / Asaan acco…". The description
 * line carries the detail.
 */
const ACCOUNT_TYPE_BY_VALUE: Record<string, SelectOption> = {
  checking: {
    value: "checking",
    label: "Current",
    description: "Everyday chequing account",
    icon: <Landmark className={TYPE_ICON_CLASS} strokeWidth={1.6} />,
  },
  savings: {
    value: "savings",
    label: "Savings",
    description: "Profit-bearing or Asaan Digital",
    icon: <Coins className={TYPE_ICON_CLASS} strokeWidth={1.6} />,
  },
  wallet: {
    value: "wallet",
    label: "Mobile wallet",
    description: "JazzCash, Easypaisa, SadaPay, NayaPay",
    icon: <Smartphone className={TYPE_ICON_CLASS} strokeWidth={1.6} />,
  },
  cash: {
    value: "cash",
    label: "Cash",
    description: "Physical notes — no institution",
    icon: <Banknote className={TYPE_ICON_CLASS} strokeWidth={1.6} />,
  },
};

/**
 * Which account types each kind of institution can actually hold.
 *
 * The picker used to offer all six types no matter what, so "Meezan Bank" +
 * "Cash" was selectable and meaningless. Cash is money with no institution
 * behind it; a mobile wallet is only ever a wallet; only a bank offers a real
 * choice, between a current and a savings/Asaan account.
 */
const TYPES_BY_KIND: Record<"none" | Tables<"institutions">["kind"], AccountType[]> = {
  none: ["cash"],
  bank: ["checking", "savings"],
  wallet: ["wallet"],
  // Not reachable from the picker (it lists banks and wallets only), but kept so
  // a legacy account still resolves to something rather than an empty list.
  gov: ["savings"],
  utility: ["cash"],
};

function kindOf(inst: Tables<"institutions"> | undefined) {
  return inst?.kind ?? "none";
}

/** The types selectable for the institution currently chosen. */
export function accountTypeOptions(
  inst: Tables<"institutions"> | undefined,
): SelectOption[] {
  return TYPES_BY_KIND[kindOf(inst)].map((t) => ACCOUNT_TYPE_BY_VALUE[t]);
}

/**
 * The type an institution implies. Every kind now has exactly one sensible
 * default, so picking an institution always leaves a valid type selected — the
 * old flow could leave "Current account" selected after choosing JazzCash.
 */
export function defaultTypeForInstitution(
  inst: Tables<"institutions"> | undefined,
): AccountType {
  return TYPES_BY_KIND[kindOf(inst)][0];
}

/** No institution + cash is the default an account form should open on. */
export const DEFAULT_INSTITUTION_ID = "none";
export const DEFAULT_ACCOUNT_TYPE: AccountType = "cash";

const KIND_GROUP: Record<Tables<"institutions">["kind"], string> = {
  bank: "Banks",
  wallet: "Mobile wallets",
  gov: "Savings & investment",
  utility: "Other providers",
};

const KIND_ORDER: Array<Tables<"institutions">["kind"]> = [
  "bank",
  "wallet",
  "gov",
  "utility",
];

/**
 * Only institutions you can hold an account WITH — banks and mobile wallets.
 *
 * The list used to be every row in `institutions`, which meant LESCO, K-Electric,
 * PTCL, Jazz, SNGPL and FBR appeared as places to open an account. Those are
 * merchants you pay bills to; they belong on a transaction, not on an account.
 * National Savings and PSX are left out too — those holdings live in Wealth.
 */
const ACCOUNT_INSTITUTION_KINDS: Array<Tables<"institutions">["kind"]> = [
  "bank",
  "wallet",
];

export function institutionOptions(
  institutions: Tables<"institutions">[],
  /** institution_id → number of accounts already held there. */
  existingCounts?: Map<string | null, number>,
): SelectOption[] {
  const sorted = institutions
    .filter((i) => ACCOUNT_INSTITUTION_KINDS.includes(i.kind))
    .sort((a, b) => {
      const byKind = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
      return byKind !== 0 ? byKind : a.name.localeCompare(b.name);
    });

  return [
    {
      value: DEFAULT_INSTITUTION_ID,
      label: "Cash in hand",
      description: "Physical notes — no bank or wallet behind it",
      group: "General",
      icon: <MerchantMark name="Cash" brand="#16233a" size={22} />,
      meta: countBadge(existingCounts?.get(null)),
    },
    ...sorted.map((inst) => ({
      value: inst.id,
      label: inst.name,
      description: inst.short_name,
      group: KIND_GROUP[inst.kind],
      /*
       * MerchantMark rather than `avatarUrl` so an institution with no logo file
       * — UBL, plus the ones whose logo turned out to be another company's mark —
       * still renders something the same size. A bare `avatarUrl` would render
       * nothing and leave that row's label hanging 22px left of every other.
       *
       * `awaitingLogo` makes the gap legible instead of silently pretty: those
       * rows show a dashed "no image" tile in the brand colour, so it is obvious
       * which institutions are still waiting on an authentic asset.
       */
      icon: (
        <MerchantMark
          name={inst.short_name || inst.name}
          brand={inst.brand_color}
          logo={institutionLogo(inst.logo_path) ?? undefined}
          awaitingLogo={!inst.logo_path}
          size={22}
        />
      ),
      // Informational only. Holding two accounts at one bank is normal — a
      // current and a savings account — so this never disables the row.
      meta: countBadge(existingCounts?.get(inst.id)),
    })),
  ];
}

function countBadge(count: number | undefined) {
  if (!count) return undefined;
  return (
    <span className="border-border bg-surface-subtle text-muted rounded-full border px-1.5 py-0.5 text-[10px] leading-none font-medium">
      <span className="tnum">{count}</span> held
    </span>
  );
}
