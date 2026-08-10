# Bachat Book — roadmap

Premium personal-finance app for Pakistan, with a calendar and task manager built
into the same spine. Web first, mobile after.

**Folder layout**
```
finance-tracker/Bachat Book/
  web/          Next.js 16 app (built, 1 screen done)
  app/          Expo app (P5, not created yet — see docs/MOBILE-PLAN.md)
  docs/         this file, ASSET-PROMPTS.md, SESSION-START.md
  references/   design reference images
```

---

## 0. Decisions already locked

| | |
|---|---|
| Scope | Finance deep + Calendar/Tasks. Travel, maps, city guides are **Phase 5**, deliberately unplanned. |
| Market | Pakistan only. PKR, lakh/crore grouping, FBR tax year, Hijri calendar. |
| Layout | **One layout in every locale.** `<html dir="ltr">` always. Urdu reverses text inside copy elements only. |
| Database | Supabase, own project, region `ap-south-1`. |
| Plans | Free and Pro. Two tiers, nothing else. |
| Platform roles | `super_admin`, `admin`, `user`. |
| Household roles | `owner`, `member`, `viewer` — separate from platform roles. |
| Social | In-app friends + invite links + **Google Contacts sync**. No Facebook (friend API is gone), no WhatsApp contacts API (does not exist) — WhatsApp is share-links only. |
| Palette | Cream `#F8F6F1`, navy `#0B1A33`, brass `#C6A15B`. Semantic green/red reserved for gains/losses. |

**On roles:** platform roles govern the product (support, moderation, plan overrides);
household roles govern one family's data. Keep them in separate tables — collapsing
them is the classic RLS bug. `viewer` is worth having from day one: a spouse who should
see the dashboard but not edit, or an accountant at tax time. A platform `support` role
can wait until there are users to support.

---

## 1. Modules

Each module ships **schema → API → screens → polish**, in that order, and is not
"done" until its screens survive the screenshot loop in light, dark and Urdu.

### M1 · Identity, households, plans
Foundation. Everything else has a `household_id`.

- **Tables** `profiles`, `user_roles`, `households`, `household_members`, `plans`, `subscriptions`, `preferences`
- **Screens** sign in/up, onboarding (household setup, currency, city, occupation), members + invites, plan picker, settings
- **Done when** a fresh user signs up, lands in their own household, and RLS provably blocks a foreign `household_id`

### M2 · Accounts & transactions
The ledger. Nothing above it works until this is right.

- **Tables** `institutions`, `accounts`, `categories`, `merchants`, `transactions`, `transaction_splits`, `rules`
- **Screens** account card wall, account detail, transaction list + filters, detail side panel, split editor, category manager, rules
- **Details** money is `bigint` paisa, never float. Transfers are a linked pair. Splits must sum to the header (enforced by trigger). Pakistani category tree + 67 brand logos already in `web/public/logos`.
- **Done when** a transfer between two accounts moves net worth by zero

### M3 · Calendar & tasks
The spine that makes this more than a budgeting app.

- **Tables** `calendar_events`, `tasks`, `task_checklist_items`, `calendar_connections`, `contacts`, `friendships`
- **Screens** month / week / day views, agenda, event create/edit modal, task board, task detail, contacts + birthdays
- **Details** dual Hijri + Gregorian. Everything with a date lands here: bills, salary, committee cycles, certificate maturities, FBR deadline, birthdays, tasks. Drag an event to reschedule. Google + Microsoft calendar sync via OAuth; Google Contacts for birthdays.
- **Done when** a bill created in M2 appears on the calendar without anyone writing a calendar record by hand

### M4 · Budgets, goals, debts
- **Tables** `budgets`, `event_budgets`, `goals`, `debts`, `debt_schedule`
- **Screens** budget list + editor, safe-to-spend, event budgets, goal cards, debt schedule + payoff comparison
- **Details** **event budgets** are the Pakistani differentiator — Ramadan, Eid, Qurbani, shaadi, school admission, forecast from last year's actuals. Debts include `qarz` (interest-free family loans), which no app tracks.

### M5 · Investments
- **Tables** `investment_plans`, `investment_transactions`, `price_snapshots`, `nss_rates`, `prize_bonds`, `prize_bond_draws`
- **Screens** portfolio overview, allocation donut, plan detail, NSS ladder, prize-bond holdings, projection
- **Details** National Savings (Behbood, DSC, SSC, RIC, Sarwa Islamic), prize bonds, mutual funds, PSX, **gold in tola**, plot files, term deposits. Metrics: XIRR, TWR, CAGR, and **real return after inflation**. Shariah filter across the whole surface.

### M6 · Committee (BC) — flagship
- **Tables** `committees`, `committee_members`, `committee_payments`
- **Screens** committee list, member ring, payment grid, payout schedule, comparison
- **Why it matters** nothing on the market tracks this properly. The differentiator is not "who paid" — it is computing the **implied XIRR of your position** against a Behbood/DSC benchmark, so the user learns whether their committee is an interest-free loan or a zero-return savings plan.

### M7 · Zakat & Tax — flagship
- **Tables** `zakat_years`, `zakat_payments`, `tax_years`, `withholding_entries`
- **Screens** Zakat dashboard (nisab gauge, zakatable breakdown, hawl timeline, payment log), Tax dashboard (filer toggle + cost meter, withholding ledger, slab calculator, IRIS-shaped export)
- **Details** silver nisab default (52.5 tola), lunar hawl, CZ-50 reminder, reconcile bank auto-deduction. Tax year 1 Jul – 30 Jun. Filer/non-filer cost meter is the single most persuasive number in the app.
- **Must carry** a visible "verify with your own advisor" line. The app computes; it does not advise.

### M8 · Receipts & OCR
- **Tables** `receipts`, `receipt_line_items`
- **Screens** receipt inbox, capture/upload, **extraction review**, line-item split, match-to-transaction
- **Details** Claude vision as primary extractor with a zod-validated schema — the real input is faded thermal paper, mixed Urdu/English, and handwritten kiryana *parchi*, which fixed-field extractors handle badly. FBR POS invoices take a cheaper path: read the printed QR.

### M9 · Reports & insights
- **Tables** `net_worth_snapshots`, plus views
- **Screens** income vs expense, category treemap, cash-flow Sankey, top merchants, inflation-adjusted net worth, exports
- **Later** anomaly detection, subscription price-hike alerts, Urdu + English natural-language search

### M10 · Admin & system
- **Tables** `audit_log`, `notifications`, `wallpapers`
- **Screens** super-admin console (users, households, plans, feature flags), audit trail, notification centre
- **Details** super_admin can impersonate for support — every impersonation writes to `audit_log`, no exceptions

---

## 2. Phases

| Phase | Contains | Outcome |
|---|---|---|
| **P1 Foundation** | M1 + M2 | Real auth, real ledger, real data replacing the fixtures |
| **P2 Spine** | M3 + M4 | Calendar and tasks live; budgets and goals on top of the ledger |
| **P3 Wealth** | M5 + M6 + M7 | Investments, committee, Zakat, tax — the features nothing else has |
| **P4 Capture & insight** | M8 + M9 + M10 | Receipts, reports, admin |
| **P5 Mobile** | Expo app in `app/` | Overview → Transactions → **Receipt capture** → Calendar → Committee |
| **P6 Expansion** | Trips, maps, city guides, local markets | Deliberately unplanned — steer with real usage |

Schema for a module is written when the module starts, not up front. A 40-table
migration written before any screen exists is a 40-table migration that gets rewritten.

---

## 3. Plans — Free vs Pro

| | Free | Pro |
|---|---|---|
| Accounts | 3 | Unlimited |
| Transactions | Unlimited | Unlimited |
| Budgets | 3 categories | Unlimited + event budgets |
| Calendar & tasks | Full | Full + Google/Microsoft sync |
| Committee | 1 | Unlimited + XIRR comparison |
| Zakat | Calculator | Full hawl tracking + CZ-50 + reconciliation |
| Tax | Slab calculator | Filer cost meter + withholding ledger + IRIS export |
| Investments | Manual holdings | NSS/prize-bond/gold tracking + XIRR + projections |
| Receipts | 10/month | Unlimited + line items + FBR QR |
| Household members | 1 | Up to 6 |
| Wallpapers & themes | Default | All |
| Export | CSV | CSV, PDF, IRIS-shaped |

Gate on **value, not volume** — the free tier has to be genuinely usable or nobody
stays long enough to convert. Committee, Zakat and the filer cost meter are the
conversion drivers; each shows a real rupee number Pro would save.

---

## 4. Seed data

`super_admin` account, created by the seed and used to sign in during development:

| | |
|---|---|
| Name | **Abdul Rehman** |
| Email | `admin@bachatbook.com` |
| Password | `<see your password manager -- not committed>` |
| Platform role | `super_admin` |
| Household | "Rehman Family", role `owner` |

Seed also loads: Pakistani institutions (banks, wallets, DISCOs), the system category
tree with Urdu names, merchants with logo paths, NSS rate table effective 5 Jan 2026,
prize-bond denominations, and a demo household with 18 months of transactions ported
from `web/src/mock`.

**Never seed real credentials into anything that ships.** This account is
development-only and must be removed or rotated before any public deploy.

---

## 5. Design rules that already cost a round

Learned the hard way on the Overview screen — do not rediscover them.

- **Layout never mirrors.** One layout, all locales. Urdu is text-level only.
- **Never switch element type on a client-only hook.** A `useReducedMotion()` branch between `div` and `motion.div` is a hydration mismatch; React drops the subtree and the page renders blank below the header. Entrances are CSS keyframes with `animation-fill-mode: both`.
- **`.tnum` forces `direction: ltr; unicode-bidi: isolate`.** Without it Urdu renders `-Rs 899` as `Rs 899-`.
- **Dark mode inverts the band relationship.** In light, navy is the dark mass on cream; in dark it must be *lighter* than the canvas or it disappears.
- **React Compiler bans synchronous `setState` in `useEffect`.** Use an initializer, a rAF callback, or `useSyncExternalStore`.
- **Money is `bigint` paisa.** Never float, never `numeric` for money.
- **Fixture income must be sized against outgoings**, or the dashboard shows spending above income while net worth climbs.

---

## 6. Status

**M1 back end is done.** Supabase project `brunpltiektawjtcivwa` in `ap-south-1` is
live: schema applied, plan tiers loaded, Abdul Rehman seeded as `super_admin`, tenant
isolation verified. Details in `db/README.md`. Next session builds M1's screens.

Curantis was paused to free the free-tier slot — its data is intact and it can be
restored from the Supabase dashboard whenever you need it.

### Where it actually stands — 2026-08-09

M1–M10 screens were built across several sessions, then audited against the live
database on 2026-08-09. **37 routes build clean and tenant isolation is proven**,
but every module has its screens built and its hard part missing — the committee
XIRR benchmark, event budgets, receipt OCR and the NSS ladder are all still to do.

Verified module-by-module completeness and the ordered work list are in
**`docs/IMPLEMENTATION-PLAN.md`**. Read that before picking up any module.

Fixed in the 2026-08-09 audit session: RLS enabled on `categories` /
`institutions` / `merchants` (anon could previously delete the whole catalog),
custom categories scoped to a household, `sync_account_balance` hardened and its
cross-account UPDATE bug fixed, the password-reset flow completed, and the
advisor disclaimer added to the Zakat and Tax surfaces.

## 7. Open items

- **3D assets** — prompts in `ASSET-PROMPTS.md`, waiting on generation. B1/B2/B3 unblock the most screens.
- **Leaked-password protection is off** in Supabase Auth. Turn it on before real signups.
- **Google/Microsoft OAuth** — needs app registration in both consoles before M3 calendar sync.
- **The seed password must be rotated.** The web app is now publicly deployed at
  `bachat-book-seven.vercel.app`, so this is overdue rather than pending.
