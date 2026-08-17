# Bachat Book

Premium personal-finance app for **Pakistan**, with a calendar and task manager built
into the same spine. Standalone product — Vellora and Curantis are unrelated; do not
import from them or copy their schema.

```
Bachat Book/
  web/          Next.js 16 app — the product
  app/          Expo app — Phase 5, not created yet
  db/           README.md — live schema notes and the RLS proof
  docs/         ROADMAP.md · ASSET-PROMPTS.md · SESSION-START.md
  references/   design reference images
```

**Database is live and seeded** — Supabase project `brunpltiektawjtcivwa`
(`ap-south-1`). M1 schema applied, Abdul Rehman is `super_admin`. Clients at
`web/src/lib/supabase/`. Regenerate `types.ts` after every migration.

**Read `docs/ROADMAP.md` before starting any module.** It holds the module list, the
phase order, the plan tiers and the seed spec.

---

## Commits

**One subject line, then 2–3 lines of plain explanation.** Not a bare subject,
not an essay. Say what changed and why in everyday words, and stop.

Use ordinary language — "fix", not "rectify"; "remove", not "retire". Leave out
the file list, the test results, and anything the diff already shows.

```
Fix account balance not updating after edit

Changing an entry's account did nothing because the update never wrote
account_id, so the money stayed in the old account. It now follows the entry.
```

```
Use one table for entries and transactions

Entries and transactions stored the same movement twice and drifted apart.
They are now two views of one table, so there is nothing left to keep in sync.
```

Do not commit a doc-only change on its own — leave it in the working tree and
let it ride along with the next real commit.

**Never add a `Co-Authored-By:` trailer, or any other attribution line, to any
commit or PR.**

---

## Running

```powershell
cd "Bachat Book\web"; pnpm dev      # port 3100
```
`pnpm` only — npm is broken on this machine. Screenshots run from `design-brain`:
```powershell
cd "..\..\design-brain"; $env:LAB_URL="http://localhost:3100"
pnpm shot /en/lab/<screen> --name <screen> --viewport both
```
Run `shot` from **PowerShell, not Git Bash** — Bash rewrites the leading `/` into a
Windows path and the request 404s. Add `--dark` for dark mode, `--fold` for a
viewport-only capture (**use it for anything `position: fixed`** — in a full-page shot
the bottom-nav island renders partway down the page and looks broken when it is not).

---

## Product rules

- **Pakistan-specific means the model, not the copy.** Committee/BC, Zakat on the silver nisab, FBR July–June tax year and filer status, National Savings certificates, prize bonds, gold in **tola**, plot files, Ramadan/Eid/Qurbani budget shocks. A translated US budgeting app fails here.
- **Money is `bigint` paisa.** Never float, never `numeric` for money. Rupees exist only at formatting time.
- **Platform roles** (`super_admin`, `admin`, `user`) live in `user_roles`. **Household roles** (`owner`, `member`, `viewer`) live in `household_members`. Collapsing them is the classic RLS bug.
- **RLS enabled with explicit policies** on every tenant table. Prove isolation with the stranger-vs-owner query in `db/README.md` before a module closes — a policy that exists is not a policy that works.
- **RLS helpers must be `SECURITY DEFINER`** or a policy on `household_members` that queries `household_members` recurses forever. They must stay executable by `authenticated`; policy expressions are evaluated as the querying role.
- **Supabase exposes every public function as a REST RPC.** Revoke `execute` on trigger functions or `/rest/v1/rpc/handle_new_user` is callable by anyone.
- **After any migration run `notify pgrst, 'reload schema';`** or every REST endpoint returns a bodyless 404 while the schema, grants and policies are all fine. Give it a few seconds to propagate.
- **Verify RLS through the REST API, not just in SQL.** The in-database test passes as `postgres` with `set role`; the API is what the app actually uses. Sign in for real, then compare signed-in vs anon row counts.
- Tax and Zakat surfaces carry a visible "verify with your own advisor" line. The app computes; it does not advise.

---

## Design

Full spec in `../../design-brain/SPEC.md`. Tokens live in `web/src/app/globals.css`.

| Intent | Class |
|---|---|
| Page background (warm cream, never white) | `bg-canvas` |
| Cards | `bg-surface` · nested `bg-surface-subtle` · deepest `bg-surface-3` |
| Dark mass | `bg-navy-900` · elevated `bg-navy-800` |
| Text on navy | `text-on-navy` / `text-on-navy-muted` |
| Accent | `bg-brass` · tint `bg-brass-soft` · readable-on-cream `text-brass-strong` |
| Text tiers | `text-foreground` → `text-foreground-2` → `text-muted` → `text-faint` |
| Deltas | `text-gain` / `text-loss` — never as surfaces |
| Radii | `rounded-control` 10 · `rounded-card` 14 · `rounded-panel` 18 · `rounded-modal` 22 |

Density: page padding 24 (16 mobile), grid gap 16, card padding 20, scale
4·8·12·16·20·24·32. Breakpoint that matters is **`lg`** — below it the 248px rail
becomes the floating bottom-nav island and 3-column grids collapse to one.

Animation is **CSS**, not a library: `Reveal` (fade + 8px rise, 220ms, 40ms stagger)
and `.shimmer` skeletons. `motion` is installed for later gesture and layout work
(card-wall spread, donut morph, calendar drag) but is not used for entrances.

Loading states are **layout-shaped skeletons**, never spinners. See
`components/skeleton.tsx` and `app/[locale]/lab/overview/loading.tsx`.

---

## Traps — each of these cost a round

- **The layout NEVER mirrors.** `<html dir="ltr">` in every locale. Urdu changes text direction only, via `<T>` (`components/t.tsx`) which sets `dir="auto"` and the `.copy` class. An earlier build flipped the whole document and produced a second, mirrored dashboard to maintain for no gain.
- **Never switch element TYPE on a client-only hook.** `Reveal` once used `useReducedMotion()` to pick between `div` and `motion.div` — a hydration mismatch that made React drop the entire subtree, rendering a header over empty canvas.
- **`.tnum` forces `direction: ltr; unicode-bidi: isolate`.** Load-bearing: without it Urdu renders `-Rs 899` as `Rs 899-` and `+28.3%` as `28.3%+`. Never wrap prose in `.tnum` — the words get forced LTR too. Use `.ltr` for non-tabular Latin runs (dates, FX quotes).
- **Dark mode inverts the band relationship.** In light, navy is the dark mass on cream. In dark it must be *lighter* than the canvas — `#060c17` on a `#080f1c` canvas vanished.
- **React Compiler bans synchronous `setState` in `useEffect`.** Use a state initializer, a rAF callback, or `useSyncExternalStore` (see `components/theme.tsx`).
- **`text-brass` fails contrast on cream.** Primary buttons are `bg-navy-900`. Use `text-brass-strong` when brass must be readable as text.
- **Gradients are `bg-linear-to-*`**, not `bg-gradient-to-*` (Tailwind v4).
- **Moving this folder breaks pnpm symlinks** — they are absolute paths into the store. Delete `node_modules` and reinstall.
- **Fixture income must be sized against outgoings.** An early dataset showed spending above income five months in six while net worth climbed — two contradictory stories on one screen.
- **A trigger's `WHEN` clause sees `pg_trigger_depth() = 0`, not 1.** The clause is evaluated *before* the function is entered; the depth only reads 1 inside the body. The two entry↔transaction sync triggers were guarded at `= 1`, so they never fired for anything and nothing errored — the sync silently did nothing until the §0.5 proof caught it. Guard mutual recursion at `= 0`.
- **`CountUp` renders `value` directly unless an animation is in flight.** It used to seed state from `value` once and only update from inside the rAF loop, so a figure that arrived *after* mount — every client-fetched number here — stayed at its first value. With `prefers-reduced-motion: reduce` the loop never runs, so the dashboard hero showed `Rs 0` beside a fully populated KPI row.
- **`react-hooks/refs` is an ERROR, not a warning, and it fires transitively.** Any handler passed as a prop that reaches `ref.current` — even several calls deep, even only to write — fails the build. `RichSelect`'s `onClick={() => commit(opt)}` broke because `commit` → `close` → `triggerRef.current.focus()`. Keep intent in state and do the ref work in an effect.
- **Never sum unsigned entry amounts across income and expense.** `quick_entries.amount_paisa` is unsigned with direction in `type`; adding a Rs 35,000 salary to Rs 2,000 of groceries produced "Rs 37,000 logged", which measures nothing. Net the two directions first. `transactions.amount_paisa` is the opposite — already signed, added straight into the balance by `sync_account_balance_trigger`.
- **Don't reserve chart height when there is no chart.** The hero's `pb-56` skirt exists for the area chart; with an empty series it left ~600px of blank navy on mobile, and anything absolutely positioned in that region hides behind the KPI row that deliberately overlaps the band.
- **Modal action buttons go in the `footer` prop, never in `children`.** `Modal` wraps the body AND the footer in one `<form>` when you pass `onSubmit`, which is what keeps a `type="submit"` button in `footer` owned by the fields in `children` — no `form="…"` id needed. Put the buttons in `children` instead and you get the old inset action row that does not line up with the full-bleed header; put them in `footer` *without* passing `onSubmit` and the button is orphaned, so nothing submits and native required-field validation silently stops running.
- **Escape inside a popover closes the whole Modal unless you stop it.** `Modal` listens for Escape on `window`. Any nested overlay must call `e.stopPropagation()` **and** `e.nativeEvent.stopImmediatePropagation()` — React attaches at the root container, so without both the key keeps travelling and a part-filled Add Account form is thrown away because someone wanted out of a dropdown.
- **A `RichSelect` popover may be wider than its trigger.** It used to be pinned to `rect.width`, so a control in a half-width grid column truncated the very labels it existed to explain ("Savings / Asaan acco…"). It now clamps to `max(trigger, 264px)` and nudges back inside the viewport. Keep option labels short anyway — the `description` line carries the detail.
- **ONE LEDGER. `transactions` is the only store of money movement.** Entries and Transactions are two FILTERED VIEWS of it — Entries is `type in (income,expense) and not is_opening`, Transactions is `type = 'transfer' or account.type in (checking,savings,wallet)`. `quick_entries` and its three sync triggers are gone. They held the same movement twice with an OPTIONAL link, and every gap between the copies was a bug: changing an entry's account was a silent no-op (branches existed for adding and removing a link, none for moving one), and unlinking left the transaction behind so the account stayed debited with nothing explaining it. Never reintroduce a second table "for quick entries".
- **Every movement names an account; the form defaults to cash.** There is no standalone entry. Resolve the default by DERIVING it (`accountId || cashAccountId`) — an effect that calls `setAccountId` once accounts load is a synchronous setState in `useEffect`, which React Compiler rejects. `ensureCashAccount()` is the submit-time backstop when no cash account exists yet.
- **Transfers and opening balances are not flow.** A transfer is two legs that cancel, so summing both put the same rupees into inflow AND outflow — an ATM withdrawal read as "Rs 20,000 in, Rs 20,000 out". Opening balances were written `type='income'`, so the balance an account STARTED with counted as money earned. Exclude both from every "money in/out" figure; `is_opening` marks the latter.
- **Deleting one leg of a transfer creates money.** The receiving account keeps its credit while the sender never gave it up. Use `deleteTransfer()` for `type='transfer'`, which removes the pair; `deleteMovement()` is for everything else.
- **`transactions_amount_sign_check` ties the sign to `type`.** Income ≥ 0, expense ≤ 0, transfers exempt. Read the SIGN when rendering, not `type` — they cannot disagree now, and the sign is what the balance trigger actually used.
- **Modal is a real `role="dialog"`.** Without it every control on the page BEHIND the modal answers the same role query, so `getByRole("combobox")` in a test — and a screen reader — reaches the filters underneath instead of the form. Scope to `getByRole("dialog")`.
- **Accounts start at Rs 0 — there is no opening-balance field.** It wrote a hidden `is_opening` transaction, so the account held money Entries never accounted for, which is the whole gap the single ledger exists to close. Money arrives by logging an income entry against the account. `is_opening` survives only for legacy rows.
- **Three account states, three meanings.** `is_archived` = deactivated, reversible, hidden from pickers and excluded from the held total, records intact. `deleted_at` = permanent tombstone — never a real DELETE, because removing the rows would silently rewrite last month's totals; past transactions stay and render a "Deleted account" tag. `is_locked` = savings you may pay into but never spend from; never valid for `cash` (`accounts_cash_never_locked`), which is the fallback every entry lands on.
- **Enforce account availability in the DATABASE, not the dropdown.** `assert_account_accepts_movement` rejects any movement into a deleted or deactivated account and any negative movement on a locked one. A disabled `<option>` stops a click, not a statement import, a REST call, or an edit that drags an existing expense onto the account.
- **Unavailable accounts are SHOWN in pickers, greyed with a reason chip — never hidden.** An account that vanishes from the expense list reads as data loss and sends you hunting for it. `accountBlockedReason()` returns the label; the direction matters, because a lock only bites on the way out.
- **The institution is identity, not a field.** It sits in a read-only band at the top of Edit Account with the logo and the date added. Repointing an account at a different bank while its transactions stay put would silently relabel every one of them.
- **An account is somewhere you HOLD money.** The Add Account picker lists banks and mobile wallets only; LESCO, PTCL, K-Electric, Jazz, FBR are merchants you pay, not places you hold a balance. `credit` and `investment` were dropped as account types — a card is a liability and the page sums every balance into one liquidity figure, and NSS/PSX belong to Wealth. Account type follows the institution: none→cash, bank→current/savings, wallet→wallet.
- **A PostgREST embed must NAME its foreign key when two exist.** `transactions` reaches `accounts` through `account_id` AND `transfer_account_id`, so `select("*, accounts(*)")` is ambiguous: PostgREST answers `300 / PGRST201` and returns NO rows. The Transactions page rendered "No Transactions Found" for every household because of it — the query never checked `error`, so a real failure wore the empty state's clothes. Use `accounts!transactions_account_id_fkey(*)`, embed the second key under an alias (`transfer_account:accounts!transactions_transfer_account_id_fkey(*)`), and **always surface `error` separately from "no rows"**.
- **Recurrence lead time must be capped at one period.** A repeating task generates its next turn N days before it is due — 3/4/5 by priority, so the task always exists before its own first reminder. Applied literally that breaks short periods: a DAILY task with a 3-day lead spawns tomorrow's copy and the day after's while today's is still open. `task_lead_days()` clamps the lead to `period − 1`, which guarantees at most one live occurrence per series; daily lands on 0. A daily task is also forced to low priority by `tasks_daily_is_low_priority`.
- **Generation is calendar-driven, completion is not.** Next month's bill arrives whether or not this month's was paid, so completing a task must never pull the next one forward, and an unpaid one stays on the board flagged overdue rather than being replaced.
- **Modal is a STACK.** Modals nest (Manage categories over a half-filled Add Expense). Without the module-level `MODAL_STACK`, Escape reached every open dialog at once and threw away the form behind, and the inner dialog's cleanup ran `overflow: unset` while the outer was still open, so the page scrolled behind a modal. Only the topmost dialog answers Escape; scroll is restored only when the stack empties.
- **A shared grid template must not carry `display`.** `ENTRY_COLS` / `TX_COLS` hold column tracks ONLY. A template with `grid` baked in, used by a header that needs `hidden lg:grid`, resolves on Tailwind's stylesheet order rather than on intent — the header either never hides or never shows. Each consumer states its own display.
- **The admin console never loads money.** It showed "Managed Volume (PKR)" summed across every household — a platform role reading every family's real balances. RLS permits it; that is not a reason to render it. Counts, plans and statuses only.
- **`institutions.kind` is behaviour, `sector` is presentation.** `kind` decides what can hold an account (`bank`/`wallet`) and drives `TYPES_BY_KIND` and `ACCOUNT_INSTITUTION_KINDS`. Splitting `kind` to get a tidier catalogue means every one of those maps grows a branch, and one missed branch silently drops an institution out of Add Account. Group the catalogue by `sector` instead.
- **`household_kind` is behaviour, `preset` is content.** Seven workspace types (personal, family, shop, agriculture, freelance, factory, rental) map onto the same three kinds. `preset` seeds `household_modules` and is never used for access control; adding those four to the enum would grow a branch in every map keyed on `kind`, which is the institutions lesson again. `lib/modules.ts` is the single registry the rail, the bottom nav and the create-workspace picker all read — the bottom nav once listed "Activity" and "Wealth", which existed nowhere else, precisely because each surface kept its own array.
- **Secrets never go in `platform_settings`.** That table is admin-editable config (provider, from-address, on/off) and is readable by any `super_admin` session. The API key lives in an env var, and the console reports only whether one is present. Same rule for the webhook secrets. A stolen admin session must not also hand over the ability to send mail as the product.
- **A scheduled endpoint must fail closed.** `daily-digest` refuses every request when `CRON_SECRET` is unset, rather than running open until someone configures it. And `schedule_daily_digest()` is a function you call with the secret rather than a hardcoded cron row — scheduling before the secret exists creates a job that 401s silently every morning, which is worse than no job.
- **`is_household_member()` does NOT mean "may edit".** It returns true for `viewer` too, so for months every tenant write policy let a read-only guest insert, update and delete. It was never exploitable only because nothing could create a viewer yet — the invite flow would have made it live. Writes use `is_household_editor()` (owner or member); reads keep `is_household_member()`. Any new tenant table needs BOTH, and the four-policy split, not one `FOR ALL`.
- **A route group layout that checks `if (!session)` is not an authorisation check.** `/admin` had no role guard at all: any signed-in user rendered the platform console, and only RLS kept the rows out. Guards belong in a server `layout.tsx` that asks the database (`rpc("is_platform_admin")`), never in a client component and never from a value cached in the session — and they should `notFound()`, since a route that answers "forbidden" confirms it exists.
- **An unauthenticated endpoint must authenticate its caller some other way.** The WhatsApp webhook had its verify token hardcoded in the source as a literal string, and accepted any POST body with no signature check. Meta signs every delivery: verify `x-hub-signature-256` against the raw body with `crypto.timingSafeEqual`, never a `===` on the digest, and never re-serialise the parsed JSON first — key order changes and the HMAC stops matching. If the secret env var is missing, return 503; falling back to a default means the endpoint waves everything through.
- **A plan belongs to a PERSON; a workspace inherits its OWNER's.** `subscriptions` is keyed by `user_id`, one row each — it used to hang off `households`, so a user with three workspaces had three subscriptions and could be billed three times for one product. Gate features with `household_plan_code()` / `session.workspace`, never with the viewer's own plan: a free member inside a Pro workspace is entitled to Pro *there*, and reading their plan instead shows them different numbers from the owner on the same screen.
- **Which workspaces are live is DERIVED, never stored.** Rank an owner's workspaces oldest-first; the first N are writable, where N is the plan's `workspaces` limit. The sign-up workspace is always the oldest, so it is structurally always writable — no `is_protected` flag to keep in sync, and a downgrade can never strand someone outside their own default workspace. A lapsed subscription falls through to the free limits inside `user_plan_limits`, so there is no expiry job to run. Read-only is a **write** restriction only: reads stay open, because hiding someone's own ledger reads as data loss. That is why the 12 tenant tables carry four policies each — `FOR ALL` cannot express "select is looser than the rest".
- **`grant execute … to authenticated` does NOT remove PUBLIC's default grant.** Postgres grants `EXECUTE` to `PUBLIC` on every new function, so a `SECURITY DEFINER` helper is callable signed-out the moment it is created — `/rest/v1/rpc/household_plan_code` would answer which plan any family is on. You must `revoke execute … from public, anon` explicitly; granting to `authenticated` only *adds* a grant. Supabase's security advisor catches this, so run it after every migration that adds a function.
- **A logo file being present does not mean it is the right logo.** Eleven `institutions.logo_path` entries pointed at another company's mark entirely (Easypaisa was a teal heart, SSGC a house outline). They are now `null` and render `MerchantMark`'s `awaitingLogo` placeholder — brand colour, dashed ring, "no image" glyph — so the gap is visible rather than quietly wrong. Look at a mark before wiring it up; do not trust the filename.

---

## How design work is done

Build one block → screenshot → compare against a reference → fix → repeat 3–5 rounds →
approval → next. **The comparison step is the whole point**; without it the first render
ships, and the first render is always flat.

**Do not write design documentation.** Lessons go into the Traps list above, not into a
new file. That approach was tried for weeks in this workspace and produced nothing.

Assets: 3D art is generated by the user in Gemini from `docs/ASSET-PROMPTS.md` — an
isometric miniature-diorama style. Do not emit `<div className="bg-gray-200" />` or a
scaled-up Lucide icon as a stand-in; if an asset is missing, ask for it.
