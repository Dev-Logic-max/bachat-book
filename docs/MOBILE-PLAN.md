# Bachat Book — mobile app plan

**Rewritten 2026-08-17.** Supersedes the 2026-08-10 plan, which was written
against a schema that no longer exists.

The Expo app in `app/` is scaffolded and does not currently work against the live
database. This plan is what it takes to get it to a launchable product.

---

## 0. Why the previous plan is void

The 10 August plan was built on **`quick_entries` plus three sync triggers**.
That table and those triggers were deleted. Entries and Transactions are two
filtered views of ONE `transactions` table now.

Everything below in the old plan is therefore wrong and must not be followed:

| Old plan said | Truth now |
|---|---|
| `quick_entries` is the fast daily log | The table does not exist |
| "Link to account" is optional, default unlinked | **Every** movement names an account; the form defaults to cash |
| `quick_entries.amount_paisa` unsigned + `type` column | `transactions.amount_paisa` is SIGNED, and `transactions_amount_sign_check` ties the sign to `type` |
| Sync triggers convert between the two | Nothing to convert — there is one row |
| Offline outbox writes `quick_entries` rows | Outbox writes `transactions` rows |

It also predates six things that landed after it: user-level plans and
read-only workspaces, invitations and household roles, workspace presets and the
module registry, server-side task generation, the account state model
(archived / deleted / locked), and the category catalogue rebuilt on 17 August.

**`app/src/hooks/use-entries.ts` is live proof.** It reads and writes
`quick_entries` in five places. Against the current database every one of those
calls fails. Fixing that hook is the first task, not a cleanup item.

---

## 1. Current state of `app/`

Scaffolded and coherent, but untested against the current schema.

**Exists and is probably reusable:**
`src/theme/tokens.ts` · `src/theme/styles.ts` · `src/components/ui/{Button,Card,Input}` ·
`src/components/T.tsx` (the Urdu wrapper) · `src/lib/{supabase,format,outbox,query-client,biometrics,deep-links}` ·
`src/providers/{auth,query,theme}` · `src/i18n/` · auth screens.

**Exists and is wrong:**
`src/hooks/use-entries.ts` (writes a dropped table) ·
`src/hooks/use-categories.ts` (needs `sort_order`, `name_ur`, `art_path`, and the hidden-category filter) ·
`app/(tabs)/_layout.tsx` (tab set predates the module registry).

**Missing entirely:** tasks, budgets, reports, zakat, committees detail, invitations,
workspace switching, plan/billing, receipts.

**Dependencies are already installed** and are the right ones — expo-router,
TanStack Query + AsyncStorage persister, expo-sqlite, Skia, Reanimated,
victory-native, expo-camera, expo-local-authentication, i18n-js, zod,
react-hook-form. No stack decisions are outstanding.

---

## 2. Decisions locked

1. **Expo Router, file-based.** Already in place. Do not migrate to React Navigation directly.
2. **TanStack Query is the only server-state layer.** No Redux, no Zustand for server data.
3. **Offline-first for WRITES, cache-first for READS.** See §5 — this is the hard part and the reason the app exists.
4. **Supabase JS with `expo-secure-store` for the session.** Never AsyncStorage for tokens.
5. **No schema fork.** The app introduces no tables. If a screen needs a column, it is a web-side migration first.
6. **The layout never mirrors.** `I18nManager.forceRTL` stays OFF, permanently. Urdu changes text direction inside text nodes via `<T>`, exactly as on web.
7. **Biometric lock is opt-in**, and it gates the app shell, not the Supabase session.
8. **The mobile app is designed separately from the web mobile view.** Shared tokens and shared rules; not shared components and not a webview.

---

## 3. The data model the app must obey

These are not preferences. Getting any of them wrong produces numbers that are
wrong rather than screens that are broken, which is worse.

- **Money is `bigint` paisa.** Never float, never `numeric`. Rupees exist only at format time.
- **ONE LEDGER.** `transactions` is the only store of money movement.
  - Entries view = `type in ('income','expense') and not is_opening`
  - Transactions view = `type = 'transfer' or account.type in ('checking','savings','wallet')`
- **`amount_paisa` is SIGNED.** Income ≥ 0, expense ≤ 0, transfers exempt. **Read the sign when rendering, never `type`** — they cannot disagree, and the sign is what the balance trigger used.
- **Every movement names an account.** Resolve the default by DERIVING it (`accountId || cashAccountId`); `ensureCashAccount()` is the submit-time backstop.
- **Transfers and opening balances are not flow.** Exclude both from every "money in / out" figure, or an ATM withdrawal reads as income and expenditure at once.
- **Deleting one leg of a transfer creates money.** Use the transfer-pair delete for `type='transfer'`.
- **Three account states.** `is_archived` (reversible, hidden from pickers), `deleted_at` (tombstone, never a real DELETE), `is_locked` (pay in, never out; never valid for `cash`).
- **Unavailable accounts are SHOWN in pickers, greyed with a reason** — never hidden. An account that vanishes reads as data loss.
- **Platform roles ≠ household roles.** `user_roles` vs `household_members`. Collapsing them is the classic RLS bug.
- **`is_household_member()` does not mean "may edit"** — it is true for `viewer`. Writes need `is_household_editor()`.
- **A plan belongs to a PERSON; a workspace inherits its OWNER's.** Gate features with the workspace's effective plan, never the viewer's own.
- **Read-only is a WRITE restriction only.** Reads stay open. Hiding someone's own ledger reads as data loss.

### Categories — rebuilt 17 August

Two tiers, different owners:

- **26 main categories** (16 expense, 6 income, 4 transfer), `parent_id is null`,
  `household_id is null`. Admin-only. Carry `art_path` (a rendered PNG) and `name_ur`.
- **~126 default subcategories**, plus whatever the household adds. A household
  may add, rename and delete **its own**, and **hide** platform defaults via
  `household_hidden_categories`.

The app must therefore:

- Order by `sort_order` then `name`. **Never alphabetically** — the seed encodes frequency (Food first, Tax last).
- Filter `is_active = false` and, in every PICKER, anything in `household_hidden_categories`.
- Fall back to `name` when `name_ur` is null (a household's own subcategory has no translation).
- Render `art_path` for main categories with the Lucide glyph as fallback — a missing file must degrade, not hole.

`assert_category_shape` enforces two tiers, matching `kind`, and household-owns-
subcategories-only. The app cannot violate it; it should not try.

---

## 4. Navigation map

```
(auth)/           sign-in · sign-up · forgot-password · reset-password
(tabs)/
  index           Overview      net worth, month flow, recent, needs-you
  entries         Entries       the money log
  [ + ]           Add           action, not a route — sheet → expense/income/transfer/task
  accounts        Accounts      balances, per-account detail
  more            More          every remaining module, from lib/modules.ts
entry/[id]        view + edit
account/[id]      detail + statement
task/[id]         detail + complete-with-payment
committee/[id]    BC pool detail
receipt/capture   camera → extract → confirm  (the native-only module)
settings/*        profile · workspaces · plan · categories · preferences
join/[token]      invitation acceptance via deep link
```

**Five tabs, centre is an action.** Same conclusion the web bottom nav reached on
17 August, for the same reason: a scroller that loops and re-centres fights
itself, and logging money should not require navigating to a page to press a
button on it.

The **More** screen reads `lib/modules.ts` (port it verbatim) resolved against the
workspace's `preset`. Do not hardcode a second list — the web bottom bar once
listed "Activity" and "Wealth", modules that existed nowhere else, precisely
because each surface kept its own array.

---

## 5. Offline — the part that justifies a native app

A Pakistani user on patchy 4G in a bazaar must be able to log an expense and
have it be there later. This is the single hardest requirement and the main
reason the product is not just the web app in a browser tab.

### 5.1 Reads

TanStack Query with the AsyncStorage persister. `staleTime` 30s, `gcTime` 24h.
The app opens onto the last known data instantly and revalidates behind it.

### 5.2 Writes — the outbox

`expo-sqlite` table `outbox(id, table, op, payload, household_id, client_id, created_at, attempts, last_error)`.

- Every write goes to the outbox FIRST, then optimistically to the query cache.
- A drain loop flushes on reconnect (`@react-native-community/netinfo`) and on app foreground.
- **Idempotency is not optional.** Each queued row carries a `client_id` (uuid v4 from `expo-crypto`) that becomes the `transactions.id`. A retried insert then collides on the primary key instead of creating a duplicate expense, which is the failure mode users notice and never forgive.
- **Attempts are capped.** After 5 failures the row moves to a `failed` state and surfaces in `UnsyncedBanner` with the real error. A silent infinite retry is how a queue fills with a row the server will never accept.
- **A failed write must be recoverable, not discarded.** Offer "retry" and "discard", never auto-discard.

### 5.3 What must NOT be optimistic

Anything whose server-side result the user will act on:

- **Transfers** — two legs, and the pair is created server-side.
- **Task completion that moves money** — it writes a real ledger row.
- **Anything gated by plan limits** — a read-only workspace refuses the write, and showing it as saved then removing it is worse than a spinner.

These show a pending state and wait for the server.

---

## 6. Design system

Port the tokens, not the components. `web/src/app/globals.css` is the source of
truth; `app/src/theme/tokens.ts` already mirrors it and must stay in step.

| Intent | Token |
|---|---|
| Page background | `canvas` — warm cream, never white |
| Cards | `surface` · nested `surface-subtle` · deepest `surface-3` |
| Dark mass | `navy-900` · elevated `navy-800` |
| Accent | `brass` · tint `brass-soft` · readable-on-cream `brass-strong` |
| Deltas | `gain` / `loss` — never as surfaces |
| Radii | control 10 · card 14 · panel 18 · modal 22 |

Density: screen padding 16, card padding 20, scale 4·8·12·16·20·24·32.

**Dark mode inverts the band relationship.** In light, navy is the dark mass on
cream. In dark it must be *lighter* than the canvas — `#060c17` on a `#080f1c`
canvas vanished on web and will vanish here.

**`text-brass` fails contrast on cream.** Primary buttons are `navy-900`.

Animation: Reanimated, 220ms, standard easing. Loading states are
**layout-shaped skeletons**, never spinners.

### Assets

Category art is a set of transparent PNGs under `web/public/categories/`. The
mobile app should read the same files from a CDN or bundle a copy — but it must
use `art_path` from the row, not a local map, so adding a category on the web
does not require an app release.

**Do not emit a grey box or a scaled-up icon as a stand-in.** If an asset is
missing, the Lucide glyph in a tone-tinted plate is the designed fallback.

---

## 7. Urdu on native

- `I18nManager.forceRTL` stays **OFF**. Never call it. It flips the entire native
  layout tree and produces a second UI to maintain, which is the most expensive
  mistake available in this codebase.
- `<T>` sets `writingDirection: 'auto'` on `Text`. That is the only place
  direction changes.
- Numbers, dates, IDs and brand names never go inside `<T>` — they need the
  equivalent of `.tnum` (forced LTR, isolated), or Urdu renders `-Rs 899` as
  `Rs 899-`.
- Locale lives on `profiles.locale`. **Not** `preferences.locale` — that column
  does not exist and querying it returns an error, not a fallback.
- Category labels come from `name_ur` in the database, not from `ur.json`. A
  household's own subcategory can never be in a compiled bundle.

---

## 8. Native-only features — what makes the app worth installing

Ranked by how much each justifies a download over the web app:

1. **Receipt capture.** Camera → image → line items → a confirmed ledger row. The parchi is the actual input device for Pakistani household spending. This is the module that justifies the app.
2. **Offline logging.** §5.
3. **Notifications that actually arrive.** Task reminders and the daily digest. Web push is unreliable; this is not.
4. **Biometric lock.** A finance app on a shared family phone needs it.
5. **Share-sheet capture.** A JazzCash/Easypaisa SMS or screenshot shared into Bachat Book becomes a draft entry.
6. **Widgets** — month spend and a one-tap add. Last, and only after the rest is solid.

---

## 9. Sequence

Each phase ends with the acceptance test beside it. Do not start the next phase
until it passes on a real device.

| # | Phase | Ends when |
|---|---|---|
| **M0** | **Repair.** Rewrite `use-entries.ts` onto `transactions`. Fix `use-categories.ts` for the new catalogue. Regenerate mobile types. | An expense logged on the phone appears in the web Entries list and moves the same account balance. |
| **M1** | Auth, session, workspace switching, read-only banner. | Signing in on the phone lands on the same active workspace as the web; a read-only workspace refuses writes and says why. |
| **M2** | Overview + Accounts. Net worth = sum of account balances. | The phone's net worth equals the web's, to the paisa, for the same workspace. |
| **M3** | Entries + the Add sheet, expense/income/transfer. | Transfer creates two legs; deleting it removes both; no figure counts a transfer as flow. |
| **M4** | Offline outbox. | Aeroplane mode: log 3 expenses, force-quit, reopen, reconnect — exactly 3 rows arrive, and a double-drain creates no duplicates. |
| **M5** | Categories: catalogue order, Urdu, hidden filter, add-your-own. | A subcategory added on the phone appears on the web, and one hidden on the web disappears from the phone's picker. |
| **M6** | Tasks + calendar, including complete-with-payment. | Completing a paid task writes one ledger row and does not pull next month's occurrence forward. |
| **M7** | Notifications. | A task due tomorrow fires a local notification; the daily digest arrives. |
| **M8** | Receipt capture. | A photographed parchi produces line items the user confirms into one ledger row. |
| **M9** | Budgets, reports, zakat, committees. | Each matches the web for the same workspace. |
| **M10** | Biometric lock, share-sheet, polish, EAS build. | A signed APK/IPA runs the full M0–M9 set on a real device. |

---

## 10. Traps that apply here verbatim

From `CLAUDE.md` — these cost a round each on web and will cost the same here:

- **Never sum unsigned amounts across income and expense.** Net the directions first.
- **A PostgREST embed must NAME its foreign key when two exist.** `transactions` reaches `accounts` through `account_id` AND `transfer_account_id`; an unqualified embed answers `PGRST201` and returns NO rows. **Always surface `error` separately from "no rows"** — a real failure wearing the empty state's clothes is how Transactions showed "none found" for every household.
- **`household_members` cannot embed `profiles`.** Its FK points at `auth.users`. Fetch members, then profiles with `.in("id", ids)`.
- **Enforce account availability in the DATABASE, not the picker.** A disabled option stops a tap, not a sync from the outbox.
- **Recurrence lead time is capped at one period**, so a daily task cannot spawn three copies.
- **Generation is calendar-driven, completion is not.** Completing this month's bill must never pull next month's forward.
- **Fixture income must be sized against outgoings.** A demo dataset showing spending above income while net worth climbs tells two contradictory stories on one screen.

---

## 11. Needed before M8 and M10

- **Receipt extraction key.** M8 needs a vision model. Same rule as everything else: **the key is an env var, never a row in `platform_settings`** — that table is admin-editable and readable by any super-admin session.
- **Storage buckets** for receipt images, with RLS scoped by `household_id`.
- **Deep-link scheme** registered for `join/[token]` and password reset.
- **EAS credentials** for M10 — Apple developer account and Play console.
- **Two settings to flip before any build leaves the machine:** leaked-password protection in Supabase Auth, and the seed admin password.
