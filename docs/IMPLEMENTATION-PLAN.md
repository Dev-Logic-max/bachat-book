# Bachat Book — implementation plan

**Written 2026-08-09**, after a full audit of the live database and the 37-route
web app. Every "current state" claim below was verified against
`brunpltiektawjtcivwa`, not taken from a session summary.

This document is the handoff brief. Read `CLAUDE.md` and `docs/ROADMAP.md`
first — this file says *what is left and in what order*, those say *what the
product is* and *what will break if you ignore them*.

---

## 0. How to use this document

- Work top-down. §2 items block a public launch; §3 onward is feature work.
- **One workstream per session.** Each has its own acceptance test.
- Do not mark an item done until its acceptance test passes. "It compiles" is
  not an acceptance test.
- Report honestly. If something is half-built, say half-built. The previous
  handoff reported six modules complete when four of the roadmap's ten
  flagship features had not been started, which cost a full audit to discover.

---

## 1. Verified current state

**Working and confirmed:**

| Area | Evidence |
|---|---|
| Build | 37 routes compile; `typecheck` 0 errors; `lint` 0 errors / 66 warnings |
| Tenant isolation | Stranger sees **0 rows** on households, accounts, transactions, tasks, budgets, receipts, contacts, committees |
| Signup | Creates profile, `user` role, preferences, personal household, owner membership, active free subscription |
| Auth | Email + password sign-in works against the real endpoint |
| Catalog RLS | Closed 2026-08-09 — see `db/migrations/0010_security_hardening.sql` |
| Password reset | Full loop works as of 2026-08-09 (`/reset-password` added) |

**Schema:** 27 tables live. Migration history covers `0001`–`0003` and `0010`
only — see §2.1.

**Data volume:** 10 transactions, 4 accounts, 3 tasks, 3 budgets, 1 committee.
Analytics screens are rendering near-empty because of this, not because they
are broken. See §2.4.

---

## 2. Blockers — do these before any new feature

> **2026-08-09 update.** §2.1 is **done** — `db/migrations/0004_m2_m6_baseline.sql`
> now holds a real `pg_dump` of the live schema (30 tables, 43 policies, 7
> functions, 5 triggers). Two companion briefs were also written:
> **`UI-POLISH-PLAN.md`** (web UI/UX defects, traced to files) and
> **`MOBILE-PLAN.md`** (React Native / Expo, P5).
>
> **2026-08-10 update.** `UI-POLISH-PLAN.md` was rewritten after an architecture
> review. It now opens with a gating section (§0) that settles the
> `quick_entries` vs `transactions` question, which had been the hidden cause of
> five separately-reported bugs. The decision: **both tables stay**, bridged by an
> optional `linked_transaction_id`; sync is total while linked; **net worth is
> summed from account balances only**. `/entries` becomes its own module and
> `/transactions` stays transactions-only. §0 requires migration
> `0011_entry_transaction_link.sql` and must be applied and proved through the
> REST API before §2–§5 of that brief begin. Any *further* merging of the two
> tables needs owner sign-off first.

### 2.1 ~~Recover the missing migration history~~ — DONE 2026-08-09

~20 tables, all M2–M6 triggers and every policy on them were applied with raw
`execute_sql`. They exist nowhere as files or history. The database cannot be
rebuilt, diffed, or rolled back.

```powershell
supabase link --project-ref brunpltiektawjtcivwa
supabase db pull --schema public
```

Save as `db/migrations/0004_m2_m6_baseline.sql`. Full instructions in
`db/migrations/README.md`.

**From now on: DDL goes through `apply_migration`, never `execute_sql`.**

**Done when** a `supabase db reset` against a scratch project reproduces the
current schema.

### 2.2 Turn on leaked-password protection

Dashboard → Authentication → Attack Protection → enable. No API for it. Still
flagged by Supabase's linter.

### 2.3 Re-enable email confirmation before launch

It is currently **off** so signup could be tested. A public deploy with it off
lets anyone register any address. Turn it on once transactional email is
configured, and add a "check your inbox" screen — sign-up currently assumes an
immediate session and will break when confirmation is on.

### 2.4 Seed the ledger properly

`ROADMAP.md §4` specifies 18 months of transactions ported from `web/src/mock`
(~1,300 rows). There are 10. Reports, budgets and cash-flow cannot be judged
until this is real.

Port `web/src/mock/generate.ts` into a seed script writing to the real tables.
Keep the `mulberry32` seed and the pinned `TODAY` so runs are reproducible.

**Trap** (`design-brain/projects/finance-tracker.md §7`): income must be sized
against outgoings, or the dashboard shows spending above income while net worth
climbs. Rent 125k + staff + car lease + school fees implies Rs 7 lakh+ monthly.

**Done when** `/reports` and `/budgets` render 18 months of plausible history
and the cash-flow chart has no contradictory months.

### 2.5 Rotate the seed credentials

`admin@bachatbook.com` / `<see your password manager -- not committed>` is in `ROADMAP.md`, `db/README.md`
and this repo's history. Development-only. Must be rotated or deleted before
any public deploy.

Also delete the two probe accounts: `ar3991492+probe1@gmail.com`,
`ar3991492+probe2@gmail.com`.

---

## 3. Cross-cutting work

### 3.1 Urdu regressed — decide and fix

Removing the `[locale]` segment made Urdu a `bb-locale` cookie only. Consequences:

- `/ur/...` no longer exists — Urdu cannot be linked, shared, bookmarked or crawled
- The documented screenshot workflow (`pnpm shot /ur/lab/overview`) is dead
- `messages/en.json` is 2.3 KB across 37 routes, so **most UI text is hardcoded English**

Two options — pick one and be consistent:

| | Restore `/en` `/ur` prefixes | Keep cookie-only |
|---|---|---|
| Shareable Urdu URL | yes | no |
| Screenshot loop | works as documented | needs a cookie-injection flag |
| SEO | correct | Urdu invisible |
| Work | re-nest routes under `[locale]` | none |

Recommended: **restore the prefix.** It is what `ROADMAP.md §0` locks in, and
Urdu-first users are a real segment for this product.

Either way, the string extraction is unavoidable: every hardcoded English
string in `src/app/(app)/**` and `src/components/**` moves into `messages/*.json`
and renders through `<T>`.

**Traps that cost a round each — do not rediscover them:**
- The layout **never** mirrors. `<html dir="ltr">` in every locale.
- `.tnum` forces `direction: ltr; unicode-bidi: isolate` — load-bearing, or
  Urdu renders `-Rs 899` as `Rs 899-`. Never wrap prose in it.
- Use logical properties only: `ps-`/`pe-`/`ms-`/`me-`/`start-`/`end-`.

### 3.2 The design loop was skipped

`design-brain/shots/` has nothing newer than 2026-08-06. **All 37 screens have
never been screenshotted** in dark, Urdu or mobile. `CLAUDE.md` calls the
compare step "the whole point".

`shot.mjs` opens a fresh incognito context and cannot sign in, so authed screens
capture the sign-in redirect instead. **Add a `--login` flag** to
`design-brain/lab/shot.mjs` that drives the real sign-in form with the seed
credentials before navigating. No auth bypass in product code.

Then run the loop for every screen: light, dark, Urdu, mobile — 3–5 rounds each.

### 3.3 Design debt to look for

The screens were built without the compare step, so expect the first-render
flatness `CLAUDE.md` warns about. Specifically check:

- Is there a **dark mass** on every screen? An all-white app in a 15-value band
  is the failure the navy rail exists to prevent.
- Are the 3D dioramas in `references/` used, or are screens falling back to
  bare Lucide icons? Two are on-brand (desk-with-cash, cards-with-POS); the
  ice-cream, lightbulb and petrol-pump renders are off-palette strays.
- Loading states must be **layout-shaped skeletons**, never spinners.

---

## 4. Feature work, by roadmap module

Percentages are *verified* completeness against `ROADMAP.md`, not against the
previous session's renumbering.

### M1 · Identity, households, plans — ~85%

Remaining:

1. **Members + invites screen.** Listed in `ROADMAP.md` as an M1 screen; not built.
   - New table `household_invites`: `id`, `household_id`, `token` (random, unique),
     `email` (nullable — pins the invite to one address), `role`
     (`member`/`viewer`), `invited_by`, `expires_at`, `accepted_at`, `accepted_by`.
   - RLS: owner of the household manages rows; the **redeem path must be a
     `SECURITY DEFINER` RPC** (`redeem_invite(token)`), because the invitee is
     not yet a member and so cannot see the row under any sane policy.
   - Screen `/settings/members`: member list with role badges, role change,
     remove, and an Invite button producing a copyable link + WhatsApp share.
   - Redeem screen `/join/[token]`: shows who invited you and to what, then
     Accept. Signed-out users sign up first and return.
   - **Gate on the plan:** `plans.limits.household_members` is 1 on free, 6 on
     Pro. Read it from the DB, never hardcode.
2. **Google sign-in.** Only the `email` provider is enabled; the user asked for
   Google. Needs a Google Cloud OAuth client, then Supabase → Auth → Providers.
   Render the button conditionally off `/auth/v1/settings` so it never appears
   broken.
3. **Email-confirmation screen** — see §2.3.

**Done when** a second real user redeems an invite, appears in the member list,
sees that household's data, and the stranger isolation proof still passes.

### M2 · Accounts & transactions — ~85%

Remaining:

1. **Transfer acceptance test.** `ROADMAP.md`: "done when a transfer between two
   accounts moves net worth by zero." `transaction_splits` and `rules` both have
   0 rows — neither feature has been exercised. Write the test, run it, fix what
   it finds.
2. **Split-sum trigger.** Splits must sum to the header amount, enforced in the
   database, not just the UI.
3. **Rules engine** actually applying on transaction insert.
4. Custom **merchants** are still global (same bug categories had). Either add
   `household_id` to `merchants` or drop user-created merchants.

### M3 · Calendar & tasks — ~60%

Missing tables: `friendships`. Missing views: **week and day** (only month +
agenda exist).

The headline gap is the acceptance test: *"a bill created in M2 appears on the
calendar without anyone writing a calendar record by hand."* Calendar events are
currently seeded by hand. Build the projection — recurring bills, salary,
committee cycles, certificate maturities, the FBR deadline and birthdays all
derive onto the calendar.

Also: drag an event to reschedule; Google/Microsoft OAuth (needs app
registration in both consoles).

### M4 · Budgets, goals, debts — ~25%

Only `budgets` exists. **Missing entirely:** `event_budgets`, `goals`, `debts`,
`debt_schedule`.

- **Event budgets are the Pakistani differentiator** — Ramadan, Eid, Qurbani,
  shaadi, school admission, forecast from last year's actuals. Not started.
- **`qarz`** — interest-free family loans, which no competing app tracks. Not
  started. Needs its own debt kind with no interest schedule.
- Safe-to-spend, budget editor, payoff comparison: not started.

### M5 · Investments — ~10%

`/wealth/investments` is a page shell with **no schema behind it**. All six
tables missing: `investment_plans`, `investment_transactions`,
`price_snapshots`, `nss_rates`, `prize_bonds`, `prize_bond_draws`.

Scope: National Savings (Behbood, DSC, SSC, RIC, Sarwa Islamic), prize bonds,
mutual funds, PSX, **gold in tola**, plot files, term deposits. Metrics: XIRR,
TWR, CAGR and **real return after inflation**. Shariah filter across the surface.

`ROADMAP.md` notes an NSS rate table effective 5 Jan 2026 for the seed.

### M6 · Committee (BC) — ~20% — **highest-value remaining work**

Only `committees` exists (1 row). Missing `committee_members`,
`committee_payments`.

The differentiator is **not** "who paid". It is computing the **implied XIRR of
the user's position** against a Behbood/DSC benchmark, so they learn whether
their committee is an interest-free loan or a zero-return savings plan. Nothing
on the market does this.

Depends on M5's `nss_rates` for the benchmark. Build M5's rate table first.

Screens: committee list, member ring, payment grid, payout schedule, comparison.

### M7 · Zakat & Tax — ~50%

Tables exist in a different shape than the roadmap (`zakat_records`,
`tax_profiles`, `tax_deductions` vs. `zakat_years`, `zakat_payments`,
`tax_years`, `withholding_entries`). Decide whether to migrate or keep.

Missing: nisab **gauge**, lunar **hawl timeline**, CZ-50 reminder, reconciling
the bank's automatic Ramadan deduction, the **filer/non-filer cost meter** as a
real computed rupee number, IRIS-shaped export.

The advisor disclaimer was added 2026-08-09 (`components/advisor-note.tsx`) and
must stay on every tax and Zakat surface, including printed and exported output.

### M8 · Receipts & OCR — ~20%

`receipts` exists; `receipt_line_items` does not. The uploader works but
**there is no extraction** — which is the entire module.

Use Claude vision as the primary extractor with a zod-validated schema. The real
input is faded thermal paper, mixed Urdu/English and handwritten kiryana
*parchi*, which fixed-field extractors handle badly. FBR POS invoices take a
cheaper path — read the printed QR.

Screens: inbox, capture/upload, **extraction review**, line-item split,
match-to-transaction. Gate monthly volume on `plans.limits.receipts_per_month`.

### M9 · Reports & insights — ~30%

`net_worth_snapshots` missing. `/reports` has income-vs-expense and category
bars; missing the cash-flow **Sankey**, category **treemap**, top merchants and
**inflation-adjusted net worth** — the last being the one that matters most in
Pakistan.

### M10 · Admin & system — ~30%

`audit_log`, `notifications`, `wallpapers` all missing.

`/admin` exists. The explicit roadmap requirement is not built: **super_admin
can impersonate for support, and every impersonation writes to `audit_log`, no
exceptions.** Do not ship impersonation without the audit trail.

### P5 · Mobile — PLAN FINALIZED & CORRECTED 2026-08-10

`app/` does not exist. Expo SDK 54+ (prebuild), Android-only for v1. Full plan in
**`docs/MOBILE-PLAN.md`**, corrected 2026-08-10 after a second-pass audit caught
six errors in the first draft — two would have produced silently broken code.

**Bugs caught and fixed:**

1. ~~`preferences.locale`~~ → **`profiles.locale`** (Postgres error, not fallback)
2. **Zero Storage buckets** in the project — bucket must be created before upload
3. `push_subscriptions` is Web Push shaped — can't hold an Expo token without `0013`
4. `receipts` has no extraction columns — `0012` adds them
5. Web `receipts/page.tsx` has no file input (hardcodes `"/logos/imtiaz.png"`)
6. `committees` is a solo tracker — mobile committee is **read-only v1**

**All decisions locked:**

| Decision | Answer |
|---|---|
| Platform | Android-only v1 |
| Offline | Full offline-first (TanStack Query read cache + **expo-sqlite write outbox**) |
| Biometric | Opt-in, prompted after **second** sign-in |
| AI Copilot | Skip for v1 |
| Notifications v1 | **Local scheduling only** — token registered for server push later |

**Critical architecture choices:**
- **expo-sqlite for write outbox**, not AsyncStorage — a queue with ordering,
  retry counts and status is a table; rewriting a JSON blob loses writes.
- **Client-generated UUIDs** on every insert — upsert with `ignoreDuplicates`
  makes retries idempotent, not double-salary.
- **M3 (offline layer) before any writing screen** — non-negotiable. Retrofitting
  an outbox under screens that already call Supabase means rewriting all of them.
- **Asset pipeline corrected:** Items/ are contact sheets (v2), Categories/ need
  bg removal + crop + 256px WebP; raw PNGs add ~100MB to APK.

Ship order: Scaffold → Auth → **Offline layer** → Overview → Entries → Accounts
→ Receipt capture → Calendar → Committee (read-only) → Settings → Release.

**Two web sessions block mobile M7+:**

- **W1** — `0012_receipt_line_items.sql`: Storage bucket `receipts`, the
  `receipt_line_items` table, extraction lifecycle columns on `receipts`, and
  the Claude-vision Edge Function.
- **W2** — multi-file upload + extraction review on `/receipts`, plus
  `0013_push_targets.sql` to hold Expo push tokens.

**Open items (none blocking M1–M6):** privacy policy, crash reporting, pnpm vs
prebuild, seed credential rotation.

12 sessions planned (W1+W2+M1–M10). See `MOBILE-PLAN.md` §13.

---

## 5. Suggested order

| Session | Work | Why |
|---|---|---|
| 1 | §2.1 migrations + §2.4 seeding | Everything downstream is judged on real data |
| 2 | §3.1 Urdu decision + string extraction | Gets harder with every screen added |
| 3 | §3.2 `--login` flag + screenshot loop | Design debt compounds |
| 4 | M1 invites + Google sign-in | Closes P1 |
| 5 | M2 transfer test, splits, rules | Closes the ledger |
| 6 | M5 schema + NSS rates | Unblocks M6 |
| 7 | **M6 committee XIRR** | The flagship |
| 8 | M4 event budgets + qarz | The second differentiator |
| 9 | M7 depth, M8 OCR, M9, M10 | |

---

## 6. Definition of done, per module

A module is not done until **all** of these hold:

1. Its acceptance test from `ROADMAP.md §1` passes, demonstrated.
2. The stranger-vs-owner isolation proof in `db/README.md` still returns zeroes.
3. `supabase get_advisors --type security` shows no new ERROR-level findings.
4. Schema changes are files in `db/migrations/` **and** in Supabase's history.
5. `web/src/lib/supabase/types.ts` regenerated.
6. Screenshots exist in light, dark, Urdu and mobile, compared against a
   reference for 3–5 rounds.
7. `pnpm typecheck && pnpm lint && pnpm build` clean.
8. No hardcoded plan limits — read `plans.limits`.
9. No hardcoded English in new UI — strings go through `<T>`.

---

## 7. Ground rules

These come from `CLAUDE.md §Traps`. Each one already cost a full round.

- Money is **`bigint` paisa**. Never float, never `numeric`. Rupees exist only at formatting time.
- **Platform roles** (`user_roles`) and **household roles** (`household_members`) stay in separate tables.
- RLS helpers must be `SECURITY DEFINER` and stay executable by `authenticated`.
- Every `public` function is exposed as a REST RPC. **Revoke execute on trigger functions.**
- After any migration: `notify pgrst, 'reload schema';`
- The layout **never** mirrors. Urdu is text-level only, via `<T>`.
- Never switch element **type** on a client-only hook — hydration mismatch drops the subtree.
- React Compiler bans synchronous `setState` in `useEffect`. Use an initializer, rAF, or `useSyncExternalStore`.
- Dark mode **inverts** the band relationship: navy must be *lighter* than the canvas.
- `text-brass` fails contrast on cream. Primary buttons are `bg-navy-900`.
- Gradients are `bg-linear-to-*` (Tailwind v4), not `bg-gradient-to-*`.
- Tax and Zakat surfaces carry the advisor line. The app computes; it does not advise.
