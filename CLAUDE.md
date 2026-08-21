# Bachat Book

Premium personal-finance app for **Pakistan**, with a calendar and task manager built
into the same spine. Standalone product — Vellora and Curantis are unrelated; do not
import from them or copy their schema.

```
Bachat Book/
  web/          Next.js 16 app — the product
  app/          Expo app — Phase 5, not created yet
  db/           README.md — live schema notes and the RLS proof
  docs/         ROADMAP.md · ARCHITECTURE.md · ASSET-PROMPTS.md · SESSION-START.md
  references/   design reference images
```

**Database is live and seeded** — Supabase project `brunpltiektawjtcivwa`
(`ap-south-1`). M1 schema applied, Abdul Rehman is `super_admin`. Clients at
`web/src/lib/supabase/`. Regenerate `types.ts` after every migration.

**Read `docs/ROADMAP.md` before starting any module.** It holds the module list, the
phase order, the plan tiers and the seed spec.

**Read `docs/ARCHITECTURE.md` before touching money.** It is the module ↔ ledger
contract: who may write a `transactions` row, the four cases every edit has to
cover, the funds and availability rules, and why net worth is not cash in hand.

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
- **`household_members` cannot embed `profiles`.** Its `user_id` has a foreign key to `auth.users`, not to `public.profiles`, so `select("id, role, profiles(*)")` returns `PGRST200` and a 400 with no rows. The ids line up — `profiles.id` IS the auth user id — which is exactly what makes the embed look like it should work. Fetch the members, then fetch the profiles with `.in("id", ids)`. Same family as the two-foreign-keys ambiguity on `transactions`: an embed needs a real FK to travel along, and neither the build nor the type-checker will tell you it is missing.
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
- **`types.ts` is HAND-WRITTEN, despite the header saying otherwise.** Running `supabase gen types` over it is a downgrade, not a refresh: the generator emits table shapes and nothing else, so the ~15 string-union aliases that mirror CHECK constraints (`TaskPriority`, `PaymentMethod`, `AccountType`, `HouseholdRole`…) vanish and take about forty import sites with them, `Views<>` disappears entirely, and every view column comes back nullable because Postgres cannot infer NOT NULL through a view. It produced 20 errors of pure noise. Add new columns and tables by hand; the file's own "regenerate after every migration" banner is wrong and is the trap.
- **`categories.parent_id` is `ON DELETE CASCADE`, and so are `budgets`, `rules` and `transaction_splits`.** Deleting a parent silently takes its children with it, and deleting any category takes every budget and rule pointing at it. `transactions` is the exception — `ON DELETE SET NULL`, so entries survive and merely lose their label. Re-parent BEFORE deleting, and guard the delete on "no children, no transactions, no budgets" rather than trusting the order of statements.
- **A category catalogue needs `sort_order`, and nothing may sort it by name.** The seed encodes how often a Pakistani household reaches for each one — Food first, Tax last. Alphabetical order opens every picker on "Bakery" and buries the category most sessions start with. Household-made rows all carry the default 1000 and settle after the seeded ones.
- **Urdu for categories lives in the DATABASE, not `messages/ur.json`.** A household invents its own subcategories at runtime, so a bundle compiled at build time can never contain "Chai Dhaba". `name_ur` is NULL for exactly those rows and `categoryLabel()` falls back to `name` — a missing bundle key would have rendered blank instead. Note the app has no `[locale]` route segment at all; the locale is the `bb-locale` cookie, read by `useLocale()`.
- **A household may only own the LOWER tier of the catalogue.** RLS already said who owns which rows; it said nothing about SHAPE, so nothing stopped a household inserting a top-level category, a third tier, or a subcategory whose `kind` disagreed with its parent — each of which silently breaks every report that groups by parent. `assert_category_shape` enforces all four rules, and platform defaults are HIDDEN per household (`household_hidden_categories`) rather than deleted, because the rows are shared and its own history still names them.
- **`sm:` is 640px — it is not "phones".** `PageActions` hid its button labels at `sm:` and therefore on every phone in existence, leaving two unlabelled arrows where the user most needs to know which one is income. Use an arbitrary variant (`min-[380px]:`) when the intent is "all but the narrowest handsets". Same class of error as collapsing every action into one ⋮: most pages here have exactly one action, so a phone got a menu containing a single item.
- **Never name a component's prop `children` unless it renders them.** `react/no-children-prop` is an ERROR, not a warning, and a card taking a `children: Category[]` list trips it. Rename the data prop; and when renaming it in bulk, stop at the component boundary — a blanket find-and-replace also renamed the neighbouring component's legitimate `children`.
- **A second language belongs on the SAME ROW, not a second line.** `SelectOption.description` sets a sub-line and doubles the row height; carrying one Urdu word in it turned a 94-item subcategory list into a scroll, and left a visible hole on the household's own rows, which have no `name_ur` at all. `secondaryLabel` is right-aligned on the same row and simply absent when missing. It still needs `dir="auto"` and `.copy` — the row never mirrors, but the script inside its own box has to be free to run right-to-left.
- **Typeahead is not search.** `RichSelect`'s keystroke matching only ever jumped to what a label STARTS with, which is useless on a two-tier catalogue: "Kiryana" is under Food, and nobody looking for it types F. `searchable` adds a pinned filter box that matches label, secondary label and description; it is deliberately turned OFF below ~8 options, where a box to filter six rows is furniture. When it is on, the typeahead branch must be skipped or the same keystrokes are consumed twice.
- **A calendar cell is ONE button.** Putting a per-item button or a "+N more" button inside the cell's own button is invalid markup and unreachable by keyboard. The cell answers one question — what is on this day — and everything specific happens in the dialog it opens. That dialog is also the only place a busy day is readable, because seven columns across 390px leaves ~40px of text: below `sm` the item labels are hidden entirely and each item draws as a 6px bar, since "G…" costs the same row height as the title and carries none of it.
- **The calendar READS tasks and never writes them.** Completing a paid task writes a real ledger entry, and a grid of 42 small boxes is the worst possible surface for that — a mis-tap on the wrong day would move a bank balance. Task rows on the calendar link out to Tasks; they carry no checkbox.
- **`sync_task_to_transaction` writes EVERY field, whichever column fired it.** Renaming a settled task therefore also pushes its amount, account and category onto the entry. That is safe only because the sync is symmetric — `sync_transaction_to_task` sends the same five back, `note` included — so the pair can never hold different values for one of them. Break the symmetry and an unrelated rename silently reverts someone's correction. `note` → `title` must `coalesce`: `transactions.note` is nullable and `tasks.title` is NOT NULL, so clearing an entry's note would otherwise fail the constraint and take the whole entry edit down with it.
- **A subtask price is a REFERENCE figure, never a ledger row.** `task_checklist_items.amount_paisa` is unsigned and carries no account and no category, because direction, account and category all live on the parent and there is exactly ONE entry per task. Ticking a subtask on a paid task asks for the price; completing the task opens on their sum, still editable. `subtaskTotalPaisa` returns **null** when nothing is priced — "these came to zero" and "nobody priced anything" must not seed the amount field the same way.
- **A completed task is a different form.** Its due date, priority, recurrence and "moves money" switch can no longer take effect, so showing them implies changing one would do something. The settled branch of `TaskFormModal` sends only the fields the entry can follow; re-sending the others from a form that never displayed them would reset them to the component's own defaults.
- **A nested Modal's form submitted its PARENT's form too.** `Modal` rendered inline, so opening New category over Manage categories over a paid task's edit form put three `<form>` elements physically inside one another — invalid HTML — and clicking "Create category" ran the task save as well, which closed the whole stack with nothing created and no error, because nothing had failed. TWO fixes are needed and neither is sufficient alone: `Modal` now renders through a **portal** to `<body>` so the DOM nesting is gone, and it **stops propagation** on submit, because React bubbles events through the REACT tree — a portalled child's submit still reaches an ancestor's `onSubmit`. Same shape as the Escape rule: only the topmost layer answers, and it has to say so.
- **A hover-revealed control must not change the layout.** Reserving space for it truncates every title to hold room for buttons that are invisible most of the time; expanding it on hover moves the control while the pointer is travelling toward it, and moves the neighbour it sits beside. Task cards pin the priority tag to the right edge and float the actions `absolute end-full` on an opaque background, so they cover the tail of the title for exactly as long as the pointer is there and nothing reflows. `pointer-events-none` at rest, or an invisible control keeps swallowing clicks meant for what is underneath.
- **A grip glyph that is not wired to anything is a picture of a handle.** `GripVertical` sat on every subtask row from the day the form was built and did nothing. Rows are `draggable` only while the handle is held — a permanently draggable row swallows text selection inside its own input — and the handle is a real `<button>` answering ArrowUp/ArrowDown, because HTML5 drag has no keyboard path at all. Touch has no HTML5 drag either, so below `lg` the same job needs explicit up/down buttons.
- **"Off" has TWO storage mechanisms, and confusing them fails SILENTLY.** A household switches its OWN subcategory off with `is_active` on the row; it switches a PLATFORM default off with a row in `household_hidden_categories`. That table has a trigger rejecting your own rows, so pointing one switch at it for everything made the toggle fail on exactly the rows you created — the optimistic flip landed, the write bounced, the icon snapped back. `isCategoryOff()` is the single reader; the writer branches on ownership. Management screens must also pass `keepOwnInactiveFor`, or a row you switched off vanishes from the only screen that can switch it back on and its name is still taken, so re-creating it fails too.
- **A newly created row sorts LAST, so any `slice()` hides it.** Household subcategories carry the default `sort_order` of 1000, behind every seeded one. The settings card showed six in catalogue order, so adding "Chai Dhaba" under Food — which already has eight — wrote the row, fired the toast, and showed nothing. It read exactly like a failed save, and the row was there the whole time. Split by OWNERSHIP, not position: your own rows always render, the platform defaults are what gets trimmed.
- **Platform categories had NO admin screen for weeks.** RLS let `is_platform_admin()` write them from day one, which reads as "it is handled" — but the only way to exercise it was raw SQL, so the one tier every report groups by was the one tier nobody could safely change. `/admin/categories` is that screen. It lists platform rows ONLY: a super admin can see every household's own subcategories through RLS, and what a family calls its own spending is not an operator's business. Same rule as the console never loading money.
- **A card's title must not open the EDIT form.** Reaching for a task's name means "I have done this", not "I want to change what it says" — and on a paid task the edit form is the one place a stray keystroke rewrites a ledger entry. The title completes; the pencil and the bin own the other two verbs. For the same reason reopening is a dialog, not the other half of a toggle: it DELETES the entry that was written and re-settles the account, so a mis-aimed tap on a finished card silently un-spent real money with a toast as the only notice.
- **A deep link into Entries needs the MONTH as well as the id.** The list opens on the current month, so `?entry=<id>` alone lands on a page that does not contain the row. The task card's receipt chip carries `?month=YYYY-MM&entry=<id>`, which is why the tasks page fetches the settled transactions rather than trusting the task's own `completed_at`. Transactions takes the same pair as `?month=&tx=`; `ledgerRef()` picks between them, and it must pick Transactions for a `transfer` — a one-legged transfer never appears in Entries, so pointing there is a link that cannot resolve.
- **An account could spend money it does not hold.** Lending Rs 2,00,000 from an account with Rs 500 in it was accepted in silence and left the balance at −Rs 1,99,500, poisoning every figure built on that account from then on. `assert_account_has_funds` refuses it, with the escape hatch on the ACCOUNT (`allow_negative_balance`) rather than on each movement — a current account with a running finance facility really can go negative, a cash box cannot. It fires on insert and update ONLY: blocking a delete would deadlock the fix, since a delete is how a wrong row gets corrected away. An UPDATE is measured by the DIFFERENCE, or raising a Rs 5,000 expense to Rs 6,000 would be tested as a fresh Rs 6,000 charge and refused on an account that can plainly afford it. Accounts already negative when the rule landed were grandfathered to `true`, or two live accounts would have become unable to take any expense at all — which reads as the app breaking, not as a rule arriving.
- **An add-only field is a field you can never correct.** A debt's amount and account, a repayment's account, a committee cell's account and a payout's everything were all set-at-creation, on the reasoning that changing them would leave the ledger row disagreeing. It would — if only one side were written. `updateInvestment` already wrote both; the answer was to make the rest do the same, not to freeze half the form. The cost of not doing so was invisible until you needed it: correcting a typo meant deleting the debt AND every repayment recorded against it, and a record logged before an account existed could never be attached to one.
- **The pencil must edit the row it sits on.** The edit button on a profit payment opened "Record profit" against the parent HOLDING with every field blank. It looked like an edit and behaved like "add another", so a profit typed as 115000 instead of 11500 had no correction path at all — and that figure feeds the lifetime return on the card and every total in the roll-up. Any list row's edit action seeds from that row or it is not an edit.
- **Net worth and cash in hand are different questions.** Net worth was "the sum of account balances", which made the hero figure and a KPI card two names for one quantity and left the household's gold, its plot and the money owed by a cousin out of a figure captioned "total net worth". `lib/net-worth.ts` is the one source: cash + open holdings at value + receivables − payables. Lending does not move it (the account fell, the receivable rose); borrowing does not either (the cash arrived and the liability with it) — counting borrowed cash without the debt inflates net worth by every rupee ever borrowed. Writing a debt off DOES lower it, correctly. And net worth can be LOWER than cash in hand: that is what owing more than you are owed looks like, and it is the ordinary state of anyone repaying a loan.
- **Linking an account and charging it are two different requests.** One button did both, under copy that read "Linking it now takes Rs 20,00,000 out of the account you choose". Splitting them gives `setHoldingDefaultAccount` (the picker this record opens on next time) and `syncHoldingToLedger` (write the entry). The second is a sync ICON in the card header, shown only while the record has no entry — its presence is the message, so every card without it is already accounted for — and it routes through the same update function the form uses, so a record that grew a leg afterwards is indistinguishable from one that had it from the start.
- **A required account made un-ownable holdings.** "Paid from" was mandatory whenever syncing was on, so the gold your mother has owned for thirty years could not be recorded: the form demanded an account for money that never came out of one, and the only way round it was to flip a household-wide setting off and back on. "No account" is a real answer in every one of these modules, and the sync icon exists for the day it stops being the right one.
- **`debts` had no date of its own.** `createDebt` took a date and stamped the opening transfer with it, but the debt row only had `created_at`, so a loan entered today for money lent in June read "lent 2026-08-21" on its own card — and the edit form had no date field, because no column carried the fact. `opened_on` does now.
- **Turning a sync switch OFF must not strand what it wrote.** The account picker was hidden whenever the household switch was off, which meant a real ledger row on an existing record could no longer be moved or detached. "Off" governs what happens NEXT; anything already linked keeps its controls.

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
