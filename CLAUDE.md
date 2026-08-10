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
