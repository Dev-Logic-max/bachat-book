# Web UI polish & ledger architecture — work brief

> ## STATUS — implemented 2026-08-10
>
> **§0–§11 are built.** `pnpm typecheck` clean, `pnpm lint` **0 errors** / 64
> warnings (all pre-existing `<img>`), `pnpm build` 40 routes. Verified in the
> browser signed in, at desktop and mobile, light and dark.
>
> Migrations applied to `brunpltiektawjtcivwa`:
> `0011_entry_transaction_link.sql` (bridge, guards, bidirectional sync) and
> `0012_avatars_bucket.sql` (storage + uid-scoped policies). The §0.5 proof passes
> all nine checks; anon reads zero rows through REST and the three new functions
> 404 as RPCs.
>
> **Still open — needs the owner:**
> 1. Every account in the `Abdul Rehman` workspace is *named* "Abdul Rehman"
>    (four of them). The add-account form no longer invites this, but the existing
>    rows need renaming by hand — only the owner knows which bank each one is.
> 2. §12 — whether `/ai-assistant` and `/api/webhooks/whatsapp` stay.
> 3. `IMPLEMENTATION-PLAN.md` §2.2/§2.3/§2.5 remain: leaked-password protection,
>    email confirmation, and rotating the seed credentials before any deploy.
>
> Four bugs the screenshot loop caught that no amount of typechecking would have
> — `Rs 0` hero, a contradictory `0.0%` badge, an empty-state message hidden behind
> the KPI cards, and income summed with expense — are recorded in `CLAUDE.md`
> §Traps. The sections below are kept as the record of what was changed and why.


**Rewritten 2026-08-10** after an architecture review with the owner. Supersedes
the 2026-08-09 draft, which listed symptoms in isolation; several of those
symptoms share one cause and fixing them separately would have cemented a split
ledger. Line numbers are from the 2026-08-10 tree — re-grep if they have drifted.

Read `CLAUDE.md` §Design and §Traps before touching a component.

## How to work this brief

**§0 is a gate.** It is the data model every later section sits on. Do not start
§2, §3, §4 or §5 before §0 is applied, typechecked and proved. §1 (shell
chrome) and §8 (auth) are independent and may run in parallel.

**Definition of done per section:** `pnpm typecheck && pnpm lint && pnpm build`
clean, plus screenshots in light, dark, Urdu and mobile for every screen touched.
**Definition of done for §0:** the sync proof in §0.5 passes through the REST
API, not only in SQL.

**Capture note.** `CLAUDE.md` documents `/en/lab/<name>`, but this tree has no
`[locale]` segment — the real routes are `/lab/overview` and `/dashboard`. Use
`pnpm shot /dashboard --name dashboard --viewport both` and add `--fold` for
anything `position: fixed` (the bottom-nav island).

---

## §0 — Ledger architecture (the gate)

### 0.1 What is true today

`quick_entries` and `transactions` are two unrelated tables. The dashboard and
the Add Entry modal are the **only** two files in the codebase that touch
`quick_entries`. `/transactions`, `/accounts` and `/accounts/[id]` read
`transactions` exclusively. Nothing joins them.

That single fact produced five separately-reported bugs: "View All" cannot work,
no entry is editable anywhere, a logged salary never moves an account balance,
the dashboard ignores every account, and `Net Saved` is byte-identical to net
worth because [dashboard/page.tsx:96](../web/src/app/(app)/dashboard/page.tsx#L96)
feeds both fields from one variable.

### 0.2 The decided model

Both tables **stay**. Neither is retired. They are bridged by an optional link.

```
quick_entries                                  transactions
daily income/expense log            the bank & wallet ledger
amount · category · note · date     account · amount · category · date
        │                                          │
        └───────── linked_transaction_id ──────────┘
                     nullable · null by default

  unlinked  →  fully independent, behaves exactly as it does today
  linked    →  one real-world event stored in two places, kept in lockstep
```

Rules, all owner-decided:

1. **Independent by default.** A new entry is unlinked unless the user picks an
   account in the Add Entry modal.
2. **While linked, sync is total** — amount, date, category, note, title. Editing
   either row updates the other. Applies to edit *and* delete.
3. **Unlinking is the only way to break sync.** After unlinking, both rows live
   on independently.
4. **An account can opt out of linking entirely.** A per-account flag; when off,
   that account can never be the target of an entry link and operates as a pure
   bank ledger. It still counts toward totals — the flag blocks *linking*, not
   *ownership*.
5. **Money is counted once, via accounts.** See §2.1.

### 0.3 Migration — `0011_entry_transaction_link.sql`

Four changes. Write it as one migration, then
`notify pgrst, 'reload schema';` and wait a few seconds before testing, or every
REST endpoint returns a bodyless 404 while the schema is fine (`CLAUDE.md`).

```sql
-- 1. The bridge. ON DELETE SET NULL so a deleted transaction leaves a valid,
--    unlinked entry rather than a dangling id.
alter table public.quick_entries
  add column linked_transaction_id uuid
    references public.transactions(id) on delete set null;

create unique index quick_entries_linked_transaction_id_key
  on public.quick_entries (linked_transaction_id)
  where linked_transaction_id is not null;   -- one-to-one, not one-to-many

-- 2. Per-account opt-out (§0.2 rule 4).
alter table public.accounts
  add column allow_entry_link boolean not null default true;

-- 3. Categories: quick_entries.category is free text ('kiryana'), while
--    transactions.category_id is a text FK to categories.id. Sync cannot work
--    across those. Add the FK column and backfill what already matches.
alter table public.quick_entries
  add column category_id text references public.categories(id);

update public.quick_entries qe
   set category_id = c.id
  from public.categories c
 where c.id = qe.category
   and qe.category_id is null;

-- 4. The richer transaction fields the owner asked for on the ledger page.
--    `note` already covers "purpose" — do not add a second free-text field.
alter table public.transactions
  add column reference_no    text,
  add column payment_method  text,
  add column attachment_path text;
```

Keep `quick_entries.category` in place for now as a display fallback for rows the
backfill missed. Do **not** drop it in this migration.

After applying: regenerate `web/src/lib/supabase/types.ts`. Every later section
depends on the new columns being in the generated types.

RLS: new *columns* inherit their table's existing policies, so no new policy is
needed. Confirm anyway with the stranger-vs-owner query in `db/README.md` — a
policy that exists is not a policy that works.

### 0.4 The sync engine

**Mechanism: database triggers, not application code.** Money correctness cannot
depend on every future write path remembering to call a helper. Two triggers,
one per direction.

**The trap that will cost you a round:** two triggers that update each other
recurse forever. Guard both with the standard Postgres idiom so a trigger only
fires when the statement came from outside the database, never from the other
trigger:

```sql
create trigger sync_entry_to_transaction
  after update on public.quick_entries
  for each row
  when (pg_trigger_depth() = 1)
  execute function public.sync_linked_records();
```

Requirements on the function:

- `security definer`, and **revoke `execute` from `anon`/`authenticated`** — a
  public function is an open REST RPC at `/rest/v1/rpc/<name>` (`CLAUDE.md`).
- Sync only the shared fields: `amount_paisa`, date, `category_id`, note. Never
  touch `account_id`, `merchant_id` or `household_id` from the entry side.
- No-op immediately when `linked_transaction_id is null`.
- **Sign convention differs between the tables.** `quick_entries` carries an
  unsigned `amount_paisa` plus a `type` of `income`/`expense`; `transactions`
  carries a signed `amount_paisa`. Convert in both directions and add a comment
  saying so — this is the likeliest place to introduce a silent sign bug.
- The existing account-balance trigger on `transactions` **must still fire** when
  sync changes a transaction amount. Verify explicitly; `pg_trigger_depth()`
  guards the sync trigger, not the balance trigger, but confirm rather than
  assume.

**Enforce rule 4 in the database too**, not only in the picker: reject an insert
or update that links an entry to an account whose `allow_entry_link` is false. A
UI-only rule gets bypassed by the next feature that writes a link.

### 0.5 Proof required before §0 closes

Do all of this signed in through the app, not as `postgres`:

1. Create an entry linked to an account. Confirm one `transactions` row appears
   and the account balance moves by the right amount and sign.
2. Edit the entry's amount, date, category and note. Confirm all four changed on
   the transaction and the balance re-settled.
3. Edit the same four fields from the transaction side. Confirm they changed on
   the entry.
4. Unlink. Edit both sides. Confirm neither follows the other any more.
5. Delete the transaction directly in SQL. Confirm the entry survives with
   `linked_transaction_id = null`.
6. Set `allow_entry_link = false` on an account. Confirm it disappears from the
   Add Entry picker **and** that a direct REST insert linking to it is rejected.
7. Stranger-vs-owner: a second user's session must read zero of these rows.

---

## §1 — Shell chrome (independent of §0, start anytime)

### 1.1 Fixed rail, thin page scrollbar

[app-rail.tsx:123](../web/src/components/app-rail.tsx#L123) puts `overflow-y-auto`
on the `<nav>`, but the `<aside>` at
[:107](../web/src/components/app-rail.tsx#L107) is neither `h-screen` nor
`sticky`, so the whole rail scrolls with the page.

Required shape:

```
aside   h-screen sticky top-0 flex flex-col     <- never scrolls
 ├ header  brand + workspace switcher   shrink-0
 ├ nav     flex-1 overflow-y-auto              <- scrolls, scrollbar invisible
 ├ FBR status card                      shrink-0
 └ footer  user + sign out              shrink-0
```

The FBR card at [:130-147](../web/src/components/app-rail.tsx#L130-L147) stays in
the rail. It is the *correct* rendering of filer status — a state, not an
amount — which is precisely why the dashboard's money-shaped copy of it goes
(§2.2). Keep it pinned above the footer.

- Rail scrollbar **fully hidden**, still scrollable: `scrollbar-width: none` plus
  `&::-webkit-scrollbar { display: none }`.
- Add a **thin global page scrollbar** to `globals.css` — there is currently no
  scrollbar styling in that file at all. `scrollbar-width: thin;
  scrollbar-color: var(--border-strong) transparent;` plus the
  `::-webkit-scrollbar` equivalents at 8px. Define for both themes;
  `--border-strong` already flips.

### 1.2 Doubled page padding

[(app)/layout.tsx:26](../web/src/app/(app)/layout.tsx#L26) already owns
`p-4 sm:p-6 lg:p-8` and `max-w-[1600px] mx-auto`. The dashboard then wraps its
body in `px-4 pb-28 sm:px-6` at
[dashboard/page.tsx:151](../web/src/app/(app)/dashboard/page.tsx#L151).

It is worse than "looser": the page header at
[:110](../web/src/app/(app)/dashboard/page.tsx#L110) sits *outside* that wrapper,
so the heading and the content below it are on **different left edges**.

Make the layout the single owner of page padding. Strip `px-4 sm:px-6` from the
dashboard wrapper and audit every other page for the same duplication.

**Do not strip `pb-28`.** That is bottom-nav clearance, not padding debt — remove
it and the floating island covers content on mobile. Move it to `<main>` in the
layout as `pb-28 lg:pb-8`.

Target density is `CLAUDE.md`: page padding 24 (16 mobile), grid gap 16, card
padding 20.

### 1.3 Settings is visually detached

[settings/layout.tsx:27](../web/src/app/(app)/settings/layout.tsx#L27) adds
`mx-auto max-w-4xl px-4 py-8 sm:px-6` *inside* the already-padded `<main>`, so
every settings form floats in roughly double the whitespace of `/accounts`.

Drop the redundant padding, keep the `max-w-4xl` reading measure, and match
`Panel` density from
[panels.tsx](../web/src/components/panels.tsx) so a settings card looks like a
panel on `/accounts` rather than a different design system.

---

## §2 — Dashboard data truth (needs §0)

### 2.1 What the numbers mean

Owner-confirmed arithmetic. Worked example: entries of 10,000 unlinked + 5,000
linked; accounts holding 2,000 and 13,000 (the 13,000 contains the linked 5,000).

| Figure | Source | Example |
|---|---|---|
| **Hero — net worth** | `sum(accounts.balance_paisa)`. Accounts only. | **Rs 15,000** |
| Asset ticker | Each account, individually | `Rs 2,000 in UBL`, `Rs 13,000 in JazzCash` |
| Money in / out (month) | `transactions` for the month | — |
| Net saved (month) | in − out **for the month** | — |
| Quick log | `quick_entries` only | Rs 15,000 logged, of which Rs 10,000 unlinked |

The linked 5,000 is counted **once**, through JazzCash. The unlinked 10,000 shows
in the quick-log block and on `/entries`, and is deliberately **not** in the hero
figure — net worth means money that exists in a tracked account, and it must stay
reconcilable against a real bank statement.

Any further merging of the two tables beyond what is written here **requires
owner confirmation first**. Do not invent a combined total.

### 2.2 KPI row

Remove the FBR card. It currently renders a rupee amount for filer status at
[dashboard/page.tsx:212-216](../web/src/app/(app)/dashboard/page.tsx#L212-L216) —
`is_filer ? 10000 : 0` displayed as money, which is meaningless. Filer status
lives in the rail (§1.1).

`Net Saved` must stop reading `netBalancePaisa`, the same variable as the hero
(§0.1). It becomes month-scoped income minus month-scoped expense.

The fourth slot becomes a **contextual card** chosen by what the user actually
has: upcoming bill, Zakat due, committee turn, budget at risk. Build the slot
with a **pluggable rule list** — the owner wants to set the exact priority order
later, so the ruleset must be one array in one file, not branching inside JSX.

### 2.3 The asset ticker

Under the hero figure, cycle through accounts every ~3s:
`Rs 2,000 in 🏦 UBL` → `Rs 13,000 in 📱 JazzCash`.

- Institution logo from `public/logos`, falling back to the brand-coloured
  monogram that [merchant-mark.tsx](../web/src/components/merchant-mark.tsx)
  already renders. **No grey placeholder divs, no scaled-up Lucide icons.**
- CSS animation, not a library (`CLAUDE.md`): cross-fade + 4px rise.
- Pause on hover, and honour `prefers-reduced-motion` by showing a static
  stacked list instead. **Do not switch element type on a client-only hook** —
  that is the hydration trap in `CLAUDE.md` that blanked a whole subtree. Swap
  the animation class, keep the same element.
- With one account, render it static — no cycling of a single item.
- Amounts need `.tnum`; the account name must **not** be inside it.

### 2.4 The net-worth chart has no data

The 1M / 6M / 1Y / All buttons are not merely unwired. The series is four
fabricated points at
[dashboard/page.tsx:189-194](../web/src/app/(app)/dashboard/page.tsx#L189-L194):
today's balance × 0.4, 0.6, 0.8, 1.0, labelled Jan–Apr. It draws a rising line
even for a user who lost money every month.

Build a real series before touching the buttons. **No schema change needed:**
current account balances plus transaction history reconstruct history exactly.

```
netWorth(d) = sum(accounts.balance_paisa) − sum(transactions.amount_paisa where date > d)
```

Do it client-side from a single transactions fetch for v1. A `security definer`
RPC is the later optimisation — and if you add one, revoke `execute` from
`anon`/`authenticated` or it is a public endpoint.

Then wire `range` state to slice it. A range with no data shows an **empty
state**, never a flat line — a flat line reads as "you had exactly this much all
year".

---

## §3 — Edit and delete (needs §0)

There is currently no way to edit or delete **anything** — not an entry, not an
account, not a transaction. Biggest functional gap in the app. Build one shared
pattern, then apply it everywhere.

### 3.1 Icon treatment

Owner's words: coloured and good-looking, not large.

- 15–16px glyph, `strokeWidth={1.75}`, inside a **28px rounded-full** hit area.
- Edit: `text-foreground-2`, hover `text-brass-strong` on `bg-brass-soft`.
- Delete: `text-muted`, hover `text-loss` on `bg-loss-soft`.
- Never a large icon. Never a filled red button inside a list row.
- Remember `text-brass` fails contrast on cream — `text-brass-strong` when brass
  must read as text (`CLAUDE.md`).

### 3.2 Where they appear

- **Cards and list rows** — on hover **and on `:focus-within`**, so keyboard
  users can reach them. Absolutely-positioned top-right cluster. Hover-only is
  an accessibility bug, not a style choice.
- **Detail pages** — always visible, in the page header.
- Touch has no hover: below `lg`, actions are always visible on rows.

### 3.3 The delete confirmation

Owner-decided, and it applies to **every** delete, linked or not.

1. A modal always appears. Nothing deletes on a single click.
2. It **names the record** being deleted — title, amount, date.
3. If the record is linked to anything — a transaction, a task, a calendar
   event — the modal **lists every linked record by name**.
4. A checkbox *"also delete the linked records"*, **checked by default**.
5. Checked → the whole linked set is deleted.
6. Unchecked → the survivors are **unlinked first, then** the current record is
   deleted. Order matters: unlink, then delete.
7. State the balance consequence **in words**, because the default path moves
   real money: `UBL Current: Rs 89,000 → Rs 4,000`.
8. Deleting a transaction must run through the **balance trigger**. Never write a
   corrected balance by hand.

Apply the whole pattern to: quick entries, transactions, accounts, budgets,
tasks, contacts, committees, categories, receipts.

---

## §4 — New `/entries` module (needs §0)

The daily income and expense log gets its own module, alongside Accounts and
Transactions.

- Same modal as the dashboard's Add Entry — **one component, two mount points**,
  not a copy.
- **Every figure on this page comes from `quick_entries` only.** No account
  balances, no transaction rows. This is the one screen where entry data stands
  alone.
- Blocks: logged this month, income vs expense split, by-category breakdown,
  count of unlinked entries.
- Full list with the §3 edit/delete pattern, filterable by month, type and
  category.
- A **linked/unlinked indicator** on each row. A linked row states which account,
  with its logo, and links through to the transaction.
- Add to the rail's **Daily** group in
  [app-rail.tsx](../web/src/components/app-rail.tsx#L35-L44), after
  Transactions.

### 4.1 The Add Entry modal

Fixes and additions, all in
[quick-add-modal.tsx](../web/src/components/quick-add-modal.tsx):

- **Date field.** [:70](../web/src/components/quick-add-modal.tsx#L70) hardcodes
  `entry_date` to today with no input. Backdating is the single most common
  correction in a finance app. Default today, allow past, reject future beyond
  today unless the type is a scheduled item.
- **"Link to account"** picker, defaulting to **"Not linked — standalone entry"**.
  Lists accounts where `allow_entry_link` is true, with institution logos.
- **Auto-create a "Cash in Hand" account** on first use so cash spending always
  has a sensible target. Never force it — the default stays unlinked.
- **Categories from the database.** The modal hardcodes 7 options at
  [:20-28](../web/src/components/quick-add-modal.tsx#L20-L28) while the DB holds
  37. Load them, group parent → child, write `category_id` (§0.3).
- Replace the native `<select>` with `RichSelect` — see §7 first, it needs
  hardening before it can be trusted inside a modal.

---

## §5 — Transactions & account ledger (needs §0)

### 5.1 Module scope — decided

`/transactions` lists **`transactions` only**. Bank and wallet movements, nothing
else. Entries live on `/entries`. The dashboard is the single place the two
combine.

This is deliberate: the moment entry rows appear in this list, the page's total
stops matching the sum of account balances and nothing on the screen reconciles
to a bank statement.

A linked transaction **does** show a link indicator naming its entry, and the
account ledger at `/accounts/[id]` shows the same. Indicator, not a merged row.

### 5.2 Account ledger rows — partially fixed already

See §10 for what has already landed. Still outstanding:

- **Edit and delete** on every ledger row, per §3.
- **The new fields** from §0.3 on the transaction form: reference number, payment
  method, attachment. `note` already serves as "purpose" — do not add a second
  free-text field beside it.
- **Attachment upload** — reuse the `receipts` storage pattern if one exists;
  otherwise defer the upload and ship the other three fields. Say which you did.
- **An edit path for the account itself**: name, institution, type, last 4, and
  the `allow_entry_link` toggle from §0.2 rule 4.
- **Running balance column.** A bank ledger without one is not a ledger. Balance
  after each row, computed from the account's current balance walked backwards.

### 5.3 Account naming

The add-account form invites a person's name — the owner's test account came out
as "Abdul Rehman" with a "Checking" badge and a UBL subtitle. An account name is
the account (`UBL Current`), not the person. Fix the label, placeholder and helper
text in
[add-account-modal.tsx:137-143](../web/src/components/add-account-modal.tsx#L137-L143)
to steer this. The `institution + type` pair already carries the rest.

---

## §6 — Controls that look interactive and are not

Each of these is a trust problem: the user clicks, nothing happens, and they stop
believing the rest of the screen.

| Where | Symptom | Fix |
|---|---|---|
| [dashboard/page.tsx:132-135](../web/src/app/(app)/dashboard/page.tsx#L132-L135) | The search bar is a `<span>`. It was never an input. | Make it a real input. Minimum: filter by merchant, note and category, routing to `/transactions?q=`. If NL search is not being built now, **remove the word "ask" from the placeholder** — do not advertise it. |
| [panels.tsx:28](../web/src/components/panels.tsx#L28) | "View All" renders as a plain `<span>` — it is decorative on every Panel. | See §6.1. Link Recent Activity to `/transactions`. |
| Net-worth range buttons | No `range` state exists anywhere. | §2.4 — needs the real series first. |
| Theme toggle | Reported broken. | **The earlier diagnosis was wrong.** `Themes` is correctly mounted at [layout.tsx:56](../web/src/app/layout.tsx#L56) and `<ThemeToggle/>` renders at [dashboard/page.tsx:136](../web/src/app/(app)/dashboard/page.tsx#L136); the wiring is sound. The real defect is that it exists **only** on the dashboard. Move it into the app shell so every page has it. |

### 6.1 `Panel` needs an API change

`action?: string` cannot express a link. Eight call sites use it and **six pass a
plain label** (`"3 open"`, `"Last 6 months"`, `"Silver nisab"`), so this is not a
find-and-replace.

Widen to `action?: React.ReactNode` plus an optional `actionHref?: string`.
String + href → a `Link` styled as it is now. String alone → today's `<span>`.
Update all eight call sites; leave the six label-only ones as labels.

---

## §7 — Dropdowns

`RichSelect` already exists in
[ui/select.tsx:71](../web/src/components/ui/select.tsx#L71) with avatar, icon and
subtitle support, and the owner wants it everywhere: **category icon left, name
right**, using each category's `icon` and `tone` from the DB; accounts showing
the institution logo with a monogram fallback.

**Harden it before rolling it out.** As written it is not ready to be the
standard control:

- **No keyboard support at all** — no arrow keys, no Enter, no Escape, no
  typeahead, no `role="listbox"`/`aria-selected`. A 37-item category list is
  unusable without it.
- **The popover is `absolute`** ([:132](../web/src/components/ui/select.tsx#L132)).
  Inside the Add Entry modal's scroll container it will be clipped. Portal it, or
  prove it renders fully at mobile height with 37 options — the last option must
  be reachable.
- No `disabled` prop, and no empty state for zero options.
- Selected style is `font-bold`, which reflows the row on selection. Use colour
  and the check mark only.

Then replace every native `<select>`: the Add Entry modal and
[add-account-modal.tsx](../web/src/components/add-account-modal.tsx#L130-L151)
(institution, account type).

---

## §8 — Auth screens (independent of §0)

Credential defaults have already been removed (§10). Still outstanding:

- **No password visibility toggle** on
  [sign-in/page.tsx](../web/src/app/(auth)/sign-in/page.tsx#L66-L75) or
  [sign-up/page.tsx](../web/src/app/(auth)/sign-up/page.tsx#L83).
  [reset-password/page.tsx:80](../web/src/app/(auth)/reset-password/page.tsx#L80)
  already has the exact pattern. **Lift it into
  [ui/input.tsx](../web/src/components/ui/input.tsx) as a `type="password"`
  affordance** so all three share one implementation rather than three copies.
  The eye button is a `<button type="button">` with an `aria-label` — a bare
  `<div>` there submits nothing but is invisible to keyboard and screen readers.
- **No password strength hint on sign-up.** Supabase rejects breached passwords
  via leaked-password protection; surface that as readable copy, not a raw API
  string.

---

## §9 — Profile & workspaces

### 9.1 Avatar upload

`profiles.avatar_url` exists and is read nowhere — there is not one
`storage.from(...)` call in the tree.

Create a Supabase Storage bucket `avatars`: public read, authenticated write
scoped so the **path prefix must be `auth.uid()`**. Without that scoping any
signed-in user can overwrite any other user's avatar. Upload → crop square →
store the public URL. Fall back to the initials `Avatar` that already renders.

### 9.2 Workspace switcher

`/settings/workspaces` can already create and switch — `handleSwitchDefault`
updates `preferences.default_household_id`. What is missing is a switcher in the
shell.

Put it in the rail header: current workspace name + chevron, opening a popover
that lists workspaces with their `kind` icon (personal / family / business) and a
"Create workspace" action. The rail already shows the name, so it is the natural
home.

**The trap:** the session is resolved **server-side** in
[lib/session.ts](../web/src/lib/session.ts#L40-L60) from
`preferences.default_household_id`. Updating the row does nothing visible on its
own — call `router.refresh()` after the update or the user switches workspace and
sees the old one until a hard reload.

### 9.3 Default workspace naming

Already correct — the signup trigger names it `"<First name>'s Finances"`. No
code change. **Verify with one fresh signup** before ticking this.

---

## §10 — Already fixed (do not redo)

Landed 2026-08-10, `pnpm typecheck` clean:

| Fix | File |
|---|---|
| Sign-in shipped a working admin email **and password** as `defaultValue`s in the live form. Removed; proper `autoComplete` added. | [sign-in/page.tsx](../web/src/app/(auth)/sign-in/page.tsx#L56-L74) |
| The rail fell back to the literal string `"Abdul Rehman"` and `"user@bachatbook.com"` whenever a profile had not loaded, so a fresh account showed another person's name. Now falls back to the email local part, then `"Your account"`. | [app-rail.tsx](../web/src/components/app-rail.tsx#L61-L68) |
| `is_filer ?? true` told every user with no preferences row that they are on the ATL. Now `?? false` — non-filer until the ATL says otherwise. | [app-rail.tsx](../web/src/components/app-rail.tsx#L68) |
| **The "Monthly Salary" mystery.** `category_id: initialBalancePaisa > 0 ? "salary" : "general"` force-tagged every opening balance with the category whose name is *Monthly Salary*. Now `category_id: null`, noted `"Opening balance"`. | [add-account-modal.tsx](../web/src/components/add-account-modal.tsx#L97-L110) |
| Ledger badge showed a **category** where the kind belongs. Now `Credited` / `Debited` / `Transfer in` / `Transfer out`, colour-matched, with the category demoted to secondary text. | [accounts/[id]/page.tsx](../web/src/app/(app)/accounts/[id]/page.tsx#L209-L226) |
| Ledger arrow was **inverted** — income drew a down-arrow beside a green `+`. Income is now up-right, expense down-right, matching the dashboard. | [accounts/[id]/page.tsx](../web/src/app/(app)/accounts/[id]/page.tsx#L199-L205) |

**One-time data cleanup, owner to run** — existing rows still carry the bad tag:

```sql
update public.transactions
   set category_id = null,
       note        = 'Opening balance'
 where note = 'Initial Balance';
```

---

## §11 — Guide tab in Settings

New `/settings/guide`. User-facing product documentation: what each module does,
how every figure is calculated, and how to perform each operation — with UI
references, not walls of prose.

Must cover, at minimum:

- **Why net worth is accounts-only** and where unlinked entry money appears
  instead (§2.1). This is the single most confusing thing in the product; show
  the worked example with real numbers.
- Entries vs Transactions — what belongs in each, and why Transactions excludes
  entries (§5.1).
- Linking: what it does, what syncs, how to unlink, and what the
  `allow_entry_link` toggle changes.
- Delete behaviour, including the checked-by-default checkbox and what unchecking
  does (§3.3).
- Zakat, tax and FBR surfaces must carry the visible **"verify with your own
  advisor"** line (`CLAUDE.md`). The app computes; it does not advise.

This is **product documentation for users** — a feature. It is not design
documentation, which `CLAUDE.md` forbids. Do not write design rules into it.

---

## §12 — Scope to confirm with the owner

`/ai-assistant` ("AI Copilot") and `/api/webhooks/whatsapp` are in the tree and
in the rail but appear in **no roadmap module**, and the WhatsApp route has an
unused `body` variable — it is a stub.

Do not build on either. Confirm with the owner: if they stay, they need a roadmap
module and acceptance tests; if not, remove them from the rail so the nav stops
advertising a dead end.

---

## §13 — Lint debt

**67 warnings, 0 errors** as of 2026-08-10 (`pnpm lint`; the earlier draft said 66).
Almost all are `<img>` where `next/image` belongs, plus unused imports in
[ui/modal.tsx](../web/src/components/ui/modal.tsx). Clear them in the files you
are already touching rather than in one sweeping commit.

Note that the rail brand logo and `RichSelect`'s option avatars are both raw
`<img>` — they are in files this brief touches, so they are in scope.
