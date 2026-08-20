# Mobile app — where it actually stands

**Written 2026-08-19, after the first installable build.** Read this with
`MOBILE-PLAN.md` (the sequence) and `MOBILE-BUILD.md` (how to build and install).
This file is the honest inventory: what works, what does not, and what will bite.

A signed APK exists and runs on a real device. That is the whole claim. It is
M0 plus a design pass — **not** a finished product.

---

## 1. Open the session at the right place

Open at `Bachat Book/`, **not** inside `app/`. The 27 KB `CLAUDE.md` with the
Traps list only auto-loads at the repo root; `app/CLAUDE.md` is an 11-byte stub
pointing at `AGENTS.md`. Getting this wrong is how a previous mobile plan came
to be written against a table that had been deleted.

Branch: **`mobile-app-rebuild`**. Note that the web session has also been
committing here — see §7.

---

## 2. What changed, and why it mattered

The app was **broken against the live database** before this session.
`src/hooks/use-entries.ts` read and wrote `quick_entries` in five places. That
table was dropped when entries and transactions became one ledger, so every
entry write failed. That is now repaired:

- Entries are a filtered view of `transactions`: `type in (income, expense)` and
  `is_opening = false`.
- `amount_paisa` is SIGNED and is read by its sign, never by `type`.
- Every movement names an account; the form derives its default as
  `accountId || cashAccountId`, with `ensureCashAccount()` as the submit-time
  backstop.
- Transfers and opening balances are excluded from every flow figure.
- Categories follow the two-tier catalogue: ordered by `sort_order` then name,
  `is_active` and `household_hidden_categories` filtered out of pickers,
  `name_ur` with a fallback to `name`.

Two things were also structurally wrong and are fixed:

- **305 hardcoded `colors.light.*` references.** Dark mode existed as a toggle
  that reached nothing. Everything now goes through `usePalette()`. The count is
  zero; keep it there.
- **The tab set predated `lib/modules.ts`.** `src/lib/modules.ts` is now a
  verbatim port of the web registry, with native routes appended below a banner
  at the bottom of the file. Refresh it by copying the web file over the top;
  only that bottom block needs re-adding.

---

## 3. Inventory

19 screens, 35 source files, ~7,600 lines.

**Solid — build on these rather than around them:**

| File | What it holds |
|---|---|
| `src/lib/ledger.ts` | The money invariants, ported from web. Sign conversion, account availability, flow totals. |
| `src/lib/outbox.ts` | 391 lines. SQLite queue, client UUID idempotency, inflight recovery, drain mutex, 5-attempt cap. |
| `src/lib/format.ts` | Paisa → rupees, South Asian grouping, tola, Hijri, FBR fiscal year. |
| `src/components/ui/Money.tsx` | The `.tnum` equivalent. Load-bearing for Urdu — see §6. |
| `src/components/ui/Surfaces.tsx` | `Card`, `ToneCard`, `NavyPanel`, `Chip`, `Segmented`, `StatTile`. |
| `src/theme/tokens.ts` | Palette plus the 1–6 tone scale, light and dark. |

**Screens that are real:** Overview, Entries, Accounts, Transactions, More,
Add-entry, entry detail, account statement, Committees, committee detail,
Settings, and all four auth screens.

**Screens that are honest placeholders:** Calendar. It says so on screen rather
than rendering an empty grid that looks finished.

**Not built at all:** Tasks, Budgets, Reports, Zakat, Investments, Contacts,
Tax, Receipts, workspace switching, invitations, plan/billing. The More grid
shows these greyed with "on the web" — deliberately visible rather than hidden,
so the user learns the feature exists.

---

## 4. What is NOT verified

Be careful about claiming any of this works. It compiles and it renders; that is
different from being correct.

- **No test suite exists.** Zero tests. `pnpm typecheck` is the only gate.
- **The offline acceptance test has not been run.** The plan's bar is: aeroplane
  mode, log 3 expenses, force-quit, reopen, reconnect → exactly 3 rows arrive
  and a double-drain creates no duplicates. **Nobody has done this.** The code is
  written to satisfy it; that is not the same as passing it.
- **RLS has not been re-verified from the phone.** It was verified through REST
  on web. The app uses the same publishable key and the same policies, so it
  should hold, but "should" is doing work in that sentence.
- **Urdu has not been checked on a device.** The `<T>` wrapper and the numeric
  isolation are in place, but nobody has switched `profiles.locale` to `ur` and
  looked at a screen.
- **Dark mode has not been checked on a device.** All 305 references were routed
  through the theme, and the dark tone palette was written fresh rather than
  ported — it has never been seen rendered.
- **The M0 acceptance number.** The live database says the seeded workspace
  should show **Rs 1,16,500 in / Rs 27,250 out**. Confirm the phone matches
  before trusting anything else on the screen.

---

## 5. Known gaps in what was built

- **The app icon is Expo's blue placeholder.** `assets/icon.png` and
  `adaptive-icon.png` are untouched template files.
- **Category art does not exist.** All 26 rows point at `/categories/*.png`;
  only a README is there. `CategoryGlyph` falls back to a Lucide glyph on a
  tone-tinted plate, which works — but `resolveArt()` needs
  `EXPO_PUBLIC_WEB_URL` set before art will ever load, and that variable is not
  in `.env`.
- **Entries cannot be edited from the phone.** `useUpdateEntry` exists and is
  wired to the outbox; no screen calls it.
- **Transfers cannot be created.** `useDeleteTransfer` exists;
  there is no create path, so the Add sheet is income/expense only.
- **`src/hooks/use-entries.ts` still exports deprecated aliases**
  (`useQuickEntries`, `useCreateQuickEntry`, `useDeleteQuickEntry`) from the
  repair. Nothing uses them. Delete them once you are sure.
- **`src/theme/shadows.ts` is orphaned** — superseded by `elevation()` in
  `use-styles.ts`, still on disk.
- **The Overview has no chart.** Deliberate: do not reserve chart height for an
  empty series, which on web left ~600px of blank navy on mobile.

---

## 6. Traps that apply here

Everything in the root `CLAUDE.md` applies. These are the ones that specifically
bite on native:

- **Never call `I18nManager.forceRTL`.** The layout never mirrors. Urdu changes
  direction inside text nodes only, via `<T>`.
- **`Money`/`Numeric` force `writingDirection: 'ltr'`.** Without it Urdu's bidi
  algorithm renders `-Rs 899` as `Rs 899-`. Never wrap prose in them.
- **Locale lives on `profiles.locale`.** `preferences.locale` does not exist and
  querying it errors rather than falling back.
- **A PostgREST embed must NAME its foreign key.** `transactions` reaches
  `accounts` through `account_id` AND `transfer_account_id`. Use
  `accounts!transactions_account_id_fkey(...)`. An unqualified embed answers
  `PGRST201` and returns NO rows — and **always surface `error` separately from
  "no rows"**, or a real failure wears the empty state's clothes.
- **No synchronous `setState` in `useEffect`.** Derive it, or do the work in an
  async callback. This is why the Add form computes `accountId ?? cashAccountId`
  instead of setting state when accounts load.
- **Writes need `is_household_editor()`, not `is_household_member()`** — the
  latter is true for viewers.
- **Introduce no new tables.** If a screen needs a column, it is a web-side
  migration first.
- **`android/` is generated.** Anything that must survive `prebuild` belongs in
  `app/plugins/`. Three plugins live there already: release signing, build
  tuning, and the dev-variant application id.

---

## 7. The repo situation

The web session has been committing onto `mobile-app-rebuild`, because both
sessions share one working directory. Two web commits
(`a3974b6`, `501ebaa` — RLS fixes on Wealth tables) are on this branch.

Nothing is lost, but the branch is no longer mobile-only. Before assuming a
clean mobile diff, check `git log` for who wrote what.

`main` has not been pushed, so production Vercel has not been redeployed.

---

## 8. Suggested next steps

In the order they earn their keep:

1. **Run the offline acceptance test on a device.** It is the one claim the
   product rests on and it is unverified.
2. **Fix whatever the first real user session surfaced.** The app has now been
   used on a phone; that list beats any guess made from here.
3. **Tasks** (M6). Bills that move money are the daily habit the product exists
   to capture, and `tasks` already carries `is_paid`, `direction`,
   `amount_paisa`, `account_id` and the recurrence machinery.
4. **Edit and delete from the phone.** `useUpdateEntry` is written and unused;
   a ledger you can only append to is a notebook.
5. **Transfers.** Two legs, created server-side, never optimistic.
6. **The app icon**, before the APK goes to anyone outside the family.

Do **not** start Receipts (M8) until there is a vision-model key in an env var
and a storage bucket with `household_id` RLS. Both are listed in
`MOBILE-PLAN.md` §11 and neither exists.
