# Premium Pakistani Finance Tracker — build plan

## Context

A new, **fully standalone** product in `My Projects/`: a premium personal-finance OS
built for **Pakistan only** — daily expenses, a money calendar, financial todos,
receipt OCR, and investment plans with profit/return calculations. Supabase backing.

**Vellora is out of scope entirely.** No shared schema, no shared conventions, no
shared tenancy model. This app is designed for the Pakistani market on its own terms.
The one forward-looking hook: a Pakistani **POS product** is planned later and will
attach to this app, so §7 keeps a business/outlet seam open — nothing more.

The sequencing you asked for: **complete premium UI on mock data first, every page,
then wire functionality screen by screen.** Web first, mobile after.

Method follows `CLAUDE.md` — build one block, screenshot, compare against a reference,
fix, repeat 3–5 rounds. No new design documentation is written; the only doc produced
is the one file the pipeline requires (`design-brain/projects/<name>.md` — tokens,
class traps, asset inventory).

**Working name:** folder `finance-tracker/`. Renaming stays cheap because the name is
never baked into component names or CSS variables.

---

## 1. Why "Pakistani" changes the product, not just the copy

This is the core of the plan. A translated US budgeting app fails here, because the
money itself moves differently:

| Pakistani reality | What most apps get wrong |
|---|---|
| **Committee / BC** (rotating savings) is how a huge share of households save | No app tracks it. Genuinely unserved — searched, found nothing credible. **This is the single strongest differentiator in the build.** |
| **Zakat** at 2.5% on a *lunar* year, auto-deducted by banks on 1 Ramadan | Treated as a donation line item, not a computed obligation over zakatable assets |
| Tax year runs **1 July – 30 June**, not January | Every "annual" report is off by six months |
| **Filer vs Non-Filer** doubles withholding on almost everything | Ignored — yet it's the single biggest controllable cost for many users |
| **National Savings certificates & prize bonds** are mainstream investments | Only stocks/ETFs modelled |
| Gold is priced and held in **tola**, not grams or ounces | Wrong unit, wrong maths |
| **Plot files** (DHA, Bahria) are a primary asset class | No asset type fits them |
| Cash is still king; the *parchi* from the kiryana store is handwritten | OCR tuned for clean thermal US receipts |
| **Ramadan, Eid, Qurbani, shaadi** are the real budget shocks | Flat monthly budgets miss all four |
| Freelance USD income via Payoneer/Wise is a top income source | No FX-inflow handling, no 0.25% IT-export tax |
| Domestic help, generator fuel, solar, school fees dominate spend | Category tree has none of them |

Everything below is built on that table.

---

## 2. Feature map

Bold = built in the UI phase. Plain = schema now, screens later.

### Money core
- **Accounts** — cash, bank, credit card, **mobile wallet**, loan, manual asset, **foreign currency**.
- **Transactions** — income / expense / transfer, splits, tags, notes, receipt attachment.
- **Categories** — Pakistani tree (§3), two-level, icon + colour.
- **Merchants** — real local logos, spend history per merchant.
- Rules engine, linked transfers, FX snapshot per foreign transaction.

**Institutions modelled from day one:**
- *Banks* — HBL, UBL, MCB, Allied, NBP, Bank Alfalah, **Meezan**, Faysal, Askari, Bank of Punjab, JS, Soneri, Habib Metro, Standard Chartered, Dubai Islamic, BankIslami, Al Baraka.
- *Wallets / EMIs* — **JazzCash** (60M users), **Easypaisa**, **SadaPay**, **NayaPay**, Zindigi, UPaisa, HBL Konnect, Alfa.
- *Rails* — **Raast** transfers (free) vs IBFT (Rs 50–200 fee); the app shows which rail a transfer used and what the fee cost.
- *Utilities* — K-Electric, LESCO, IESCO, MEPCO, GEPCO, FESCO, PESCO, HESCO, QESCO, SNGPL, SSGC, WASA/KWSB, PTCL, StormFiber, Nayatel, Jazz, Zong, Telenor, Ufone.

### Calendar — the differentiator
- **Month grid where every day carries money**: in/out micro-bars, bill dots as merchant logos, net-flow number.
- **Running-balance projection** — forward 90 days, turns red where it crosses zero.
- **Drag a bill to another day** → projection redraws live.
- **Dual Hijri + Gregorian calendar.** Ramadan, both Eids, Muharram and the **Zakat anniversary (hawl)** are first-class markers. `Intl.DateTimeFormat` with `islamic-umalqura` — no dependency needed.
- **Pakistani recurring events** pre-seeded: salary (month-end/1st), **fuel price revision (1st & 16th, OGRA)**, utility bill cycles, school fee quarters, **committee payout month**, FBR return deadline (30 Sept), **prize bond draw dates**, NSS profit payment dates, FD/certificate maturities.
- **Season overlays** — Ramadan grocery spike, Eid clothing + Eidi, **Qurbani** (Bakra Eid), shaadi season, lawn-launch season.
- Agenda/week view and a yearly spend heatmap.

### Committee / BC tracker — flagship
- Create a committee: total members, monthly amount, duration, payout order.
- **Who has paid this month**, who is pending, chase reminders.
- **Your payout month** and what it's earmarked for.
- **True cost/benefit maths** — a committee is an interest-free loan if you take an early payout and a zero-return savings plan if you take a late one. The app computes the **implied XIRR of your position** against a Savings-Account benchmark. Nothing on the market does this.
- Multiple concurrent committees, cash or bank, WhatsApp-shareable status.

### Zakat engine — flagship
- Classifies every asset **zakatable / non-zakatable** automatically (cash, gold, silver, savings, shares at market value, receivables → zakatable; personal residence, car, personal-use jewellery per chosen ruling → not).
- **Nisab** = 87.48g (7.5 tola) gold or 612.36g (52.5 tola) silver, live-priced, user picks the standard.
- **Hawl tracking** — lunar-year anniversary, wealth measured at both ends.
- **2.5% payable**, with a payment log against it, Ramadan-aware.
- **Bank auto-deduction awareness** — banks deduct Zakat on savings accounts on 1 Ramadan unless a **CZ-50 declaration** is filed; the app reminds, and reconciles the deducted amount against the computed obligation.
- Sadaqah, Fitrana, Qurbani and Khairat tracked separately from Zakat.

### Tax (FBR) — flagship
- **Tax year 1 July – 30 June** everywhere; every "yearly" view respects it.
- **Filer / non-filer switch** and an **ATL cost calculator** — "non-filer status cost you Rs X this year", broken down by withholding line.
- **Withholding captured automatically** on: profit on bank deposits (15% filer / 35% non-filer), cash withdrawals over Rs 50,000 (0.6% / 1.2%), utility bills, vehicle token, property, dividends.
- **Salary slab calculator** — FY2025-26 slabs, 0% to Rs 600,000 rising to 35% above Rs 4,100,000.
- **IT-export / freelance** — 0.25% concessional rate on remittances through proper channels; PSEB registration prompt.
- Year-end export shaped for the FBR IRIS return; 30 Sept deadline on the calendar.

### Todos / tasks
- **Financial task list**, linkable to an account, bill, goal, committee or investment.
- **Recurring tasks** — pay committee, file FBR return, renew token tax, submit CZ-50, rebalance.
- **Due dates on the calendar**; overdue escalates.
- **Auto-generated** — "3 receipts unmatched", "committee due in 2 days", "DSC matures in 30 days", "verify unusual Rs 84,000 charge".

### Receipts & OCR
- **Capture** — camera (mobile), drag-drop / paste / email-in (web).
- **Extraction** — merchant, date, total, **GST**, currency, payment method, **line items**.
- **Built for Pakistani receipts specifically**: faded thermal prints, **mixed Urdu/English**, handwritten *parchi* from kiryana shops, and **FBR POS invoices** (Tier-1 retailers must print an FBR invoice number + QR — scanning it gives verified merchant, GST and totals for free).
- **Review screen** — receipt image left, extracted fields right, per-field confidence, tap to correct.
- **Auto-match** to an existing transaction or create new.
- **Line-item splitting** across categories or people.
- **Warranty capture** — electronics receipts create a warranty-expiry calendar event.

### Investments & plans — Pakistani asset classes
Every metric below computed per plan: invested, current value, unrealised & realised P/L,
**XIRR**, **TWR**, CAGR, absolute return, and **real return after inflation** (which matters
far more here than in a low-inflation market).

| Class | Modelled as |
|---|---|
| **National Savings (CDNS)** | Behbood 12.48% (60+/widows, 10yr, monthly profit) · Defence Savings 11.08% (10yr) · Special Savings 10.20%→11.00% (3yr) · Regular Income 10.56% (5yr, monthly) · Short Term 3M/6M/1Y 10.32/10.36/10.68% · Savings Account 9.00% · Pensioner Benefit 12.48% · **Sarwa Islamic** SISA 9.96% / SITA 9.96–10.44%. Rates as revised 5 Jan 2026; stored as a dated rate table, not hardcoded. |
| **Prize bonds** | Denominations Rs 100 / 200 / 750 / 1500 / 7500 / 15000 / 25000 / 40000 premium. Holdings by serial, **quarterly draw dates on the calendar**, wins logged, effective return computed against a certificate benchmark. |
| **Bank term deposits** | TDR, plus **Islamic Mudarabah** term deposits. |
| **Mutual funds** | Al Meezan (Meezan Islamic, Rozana Amdani), NBP, UBL, HBL AMC, MCB Arif Habib, Atlas, Alfalah GHP, Faysal. NAV-based, daily. |
| **PSX equities** | KSE-100 / KSE-30 / **KMI-30 (Shariah)**. OGDC, PPL, MARI, PSO, HUBC, LUCK, ENGRO, FFC, HBL, MEBL, SYS, TRG, AIRLINK, NESTLE. |
| **Gold** | **Priced per tola** (1 tola = 11.6638 g), 22k/24k, physical and digital. |
| **Property & plot files** | DHA phases, Bahria Town, Capital Smart City, Park View — file number, instalment plan, transfer charges, rental yield. |
| **Committee / BC** | Full tracker above, treated as an investment position. |
| **Foreign currency & RDA** | USD/GBP/EUR accounts, **Roshan Digital Account** and **Naya Pakistan Certificates** for overseas family. |
| **Insurance-linked** | State Life, Jubilee, EFU, Adamjee, plus takaful variants. |
| **Crypto** | Manual holdings only, with a plain note about its unresolved regulatory status in Pakistan. |

Plus: **Halal / Shariah filter** across the whole investment surface — a real requirement
for a large share of the market, and a toggle that reshapes what's recommended and shown.

### Budgets, goals, debts
- **Budgets** — per category, monthly, rollover, "safe to spend today".
- **Event budgets** — Ramadan, Eid-ul-Fitr, **Qurbani**, shaadi, school admission season. These are the budgets that actually break Pakistani households, and no flat monthly budget models them.
- **Goals** — Hajj/Umrah, plot file, car, wedding, children's education, emergency fund. Target + date + required monthly contribution.
- **Debts** — bank loan/car lease EMI schedule and amortisation, **interest-free family/friend loans (qarz)** which are extremely common and untracked, committee obligations, credit card. Avalanche vs snowball comparison.

### Net worth & reports
- **Net worth** — assets minus liabilities over time, monthly snapshots, **gold and property revalued**.
- **Reports** — income vs expense, category breakdown, top merchants, **cash-flow Sankey**, **inflation-adjusted real net worth**, FBR-shaped tax export.

### Insights / AI (phase 5)
- Natural-language search, **English and Urdu** — "pichlay maheenay kitna kharch hua?"
- Anomaly and duplicate detection; **subscription price-hike detection**.
- Cash-flow forecast with shortfall warning.
- **Filer-status savings advisor**, **committee-vs-savings-certificate comparison**, Zakat projection.

### System
- Workspaces (personal / household / small business), members, roles, invites.
- **English + Urdu, with full RTL** (§4).
- Import CSV / bank statement PDF, export, audit log, notifications, 2FA.
- Shared expenses and settle-up between family members.

---

## 3. Pakistani category tree (seeded)

Not an afterthought — this is what makes the app feel local on first launch.

**Home & bills** — Rent · Society/maintenance charges · Electricity (K-Electric/DISCO) · Sui Gas · Water · Internet · Mobile packages · **Generator/UPS fuel** · **Solar instalment & maintenance**
**Household staff** — Maid · Driver · Cook · Chowkidar · Maali *(monthly recurring, near-universal, absent from every foreign app)*
**Food** — Kiryana/grocery · **Doodh wala (daily milk)** · Sabzi/fruit · Meat · Bakery · Restaurants · Food delivery (Foodpanda) · Chai/coffee
**Transport** — Petrol · CNG · **Careem / inDrive / Bykea / Yango** · Car maintenance · **Token tax** · Parking · Toll
**Education** — School fees · University fees · **Tuition centre** · Books & uniform · Exam fees
**Health** — Doctor · Pharmacy (Dvago/Sehat) · Lab tests (Chughtai/Dr Essa) · Hospital · Health takaful
**Family & social** — Family support · **Eidi** · Gifts · **Shaadi/mehndi/valima** · Aqiqah · Funeral/fateha
**Charity** — **Zakat** · Sadaqah · Fitrana · **Qurbani** · Khairat · Mosque/madrassa
**Shopping** — Clothing (**lawn season**) · Khaadi/Gul Ahmed/Sapphire/J. · Footwear (Bata/Servis) · Electronics · Home
**Personal** — Salon/barber · Gym · Subscriptions (Netflix/Spotify/YouTube) · Hobbies
**Financial** — Bank charges · **Withholding tax** · IBFT/Raast fees · Loan EMI · **Committee contribution** · Insurance premium
**Religious** — Hajj/Umrah savings · Qurbani animal · Ramadan iftar/sehri

**Income** — Salary · Bonus/annual increment (July) · **Freelance USD (Payoneer/Wise/Upwork)** · **Remittance received** · Rental income · Business income · Profit on savings/certificates · Dividends · **Committee payout** · Prize bond win · Agriculture

**Cities** seeded for merchant/branch context: Karachi, Lahore, Islamabad, Rawalpindi,
Faisalabad, Multan, Peshawar, Quetta, Gujranwala, Sialkot, Hyderabad, Sukkur, Bahawalpur,
Sargodha, Abbottabad, Mardan, Mirpur, Gilgit.

---

## 4. The premium formula

`SPEC.md §0` — 44 of 48 references carry their weight with imagery, not CSS. A dense
finance app can't be photographs, so five things carry it instead:

| # | Carrier | Concretely |
|---|---|---|
| 1 | **Dark mass** | Navy rail + one navy band per page. Without it everything sits in a 15-value near-white band and reads cheap. |
| 2 | **Real Pakistani merchant logos** | Foodpanda, Careem, Daraz, K-Electric, Khaadi, Imtiaz, Meezan, JazzCash — real marks, not coloured initials. **Highest premium-per-effort item in the build**, and the thing that makes it instantly read as *ours*. |
| 3 | **Charts as photography** | Gradient area fills, animated draw-in, no gridline clutter, tabular numerals, units at 40% size and muted (`SPEC §3`). |
| 4 | **Card art** | Accounts as real cards — layered gradient, fine noise, embossed last-4, bank mark. Meezan green, HBL green, UBL blue, SadaPay's minimal black. |
| 5 | **Gemini 3D objects** | Hero bands, empty states, onboarding, feature tiles. Prompt pack in §5. |

### Palette — cream / navy / brass

Light premium cream canvas, deep navy dark mass, antique brass accent — as you asked.
Navy + cream + brass reads as private banking, and critically **brass does not collide
with semantic green/red**, which an emerald accent would.

| Token | Value | Role |
|---|---|---|
| `--canvas` | `#F8F6F1` | warm cream page background |
| `--surface` | `#FFFFFF` | cards — white on cream separates without borders |
| `--surface-subtle` | `#F1EDE4` | nested fills, hovers, table stripes |
| `--surface-3` | `#E8E2D6` | deepest warm neutral |
| `--border` | `#E6E0D4` | hairline |
| `--navy-900` | `#0B1A33` | rail, dark bands, primary button fill |
| `--navy-800` | `#12264A` | dark-band elevated surface |
| `--navy-700` | `#1B3563` | dark-band border |
| `--brass` | `#C6A15B` | accent — active state, focus ring, chart-1, highlights |
| `--brass-soft` | `#F2E9D6` | brass tint fills |
| `--foreground` | `#0D1420` | primary text |
| `--muted` | `#6E6A62` | warm grey labels, captions |
| `--gain` | `#0F8B5F` | positive delta |
| `--loss` | `#B4342A` | negative delta |

Cream + brass also sits naturally alongside Islamic geometric motifs and gold — used
sparingly as a hairline pattern in the Zakat and Ramadan surfaces, nowhere else.

**Accent discipline.** Brass may touch: active nav, focus ring, chart-1, selected states,
small badges, progress fills, ≤4% wash on the rail. Brass must **never** touch shadows,
borders, card surfaces, table headers, or page background. Target coverage 8–10%.
**Primary buttons are navy, not brass** — brass on cream fails contrast.

**Shadows are neutral, never tinted:**
```css
--shadow-sm: 0 1px 2px rgb(11 26 51 / 0.05);
--shadow-md: 0 1px 2px rgb(11 26 51 / 0.05), 0 8px 20px -8px rgb(11 26 51 / 0.10);
--shadow-lg: 0 2px 4px rgb(11 26 51 / 0.06), 0 20px 40px -16px rgb(11 26 51 / 0.16);
```

**Dark mode** is a designed second surface mode, not an inversion — canvas `#080F1C`,
surface `#0F1A2E`, border `#1C2A44`, brass lifted to `#D9B978`, text cream `#EFEAE0`.
Built right after Wave A so no screen is ever retrofitted.

### Urdu & RTL — a day-one constraint

`en` + `ur` via next-intl. Urdu is right-to-left, so this cannot be bolted on:
- **Logical CSS properties only** — `ps-`/`pe-`/`ms-`/`me-`/`start-`/`end-`, never `pl-`/`pr-`/`ml-`/`mr-`. A lint rule enforces it from the first commit.
- **Noto Nastaliq Urdu** for Urdu text — Nastaliq needs ~1.8× the line-height of Latin; the type scale carries an Urdu variant.
- Numbers stay Latin digits (standard in Pakistani finance), currency stays `Rs` prefixed.
- Charts, calendars and the money-in/money-out direction all mirror.
- Every screen is captured in both directions during its screenshot rounds.

### Number formatting

South Asian grouping — **`Rs 1,25,000`** (one lakh twenty-five thousand), not `125,000`.
KPI positions use shorthand — **`Rs 12.5 lakh`**, `Rs 1.4 crore` — with a settings toggle
for users who prefer full digits. Gold shows in **tola**. `Intl.NumberFormat('en-PK')` plus
a small custom grouper, since ICU's `en-PK` doesn't apply lakh/crore grouping by default.

### Type

| Family | Job | Never |
|---|---|---|
| **Fraunces** (`font-display`) | page titles, hero KPI numbers, marketing | body, labels, table cells |
| **Inter** | all UI text, labels, buttons, forms, table cells | headings |
| **JetBrains Mono** | money in tables, IDs, timestamps | prose |
| **Noto Nastaliq Urdu** | all Urdu text | Latin text |

Fraunces is A/B'd against **Instrument Serif** and **Sora** on the real hero KPI in
round 1 of Overview, before the rest of the app commits.

### Density & radii

24px page padding, 16px grid gap, 20px card padding, 52px table rows; scale
4·8·12·16·20·24·32. Radii: control 10px, card 14px, panel 18px, modal/hero 22px, pill 999px.
The 20–28px band in `SPEC §4` is mobile/marketing — it applies on Expo in phase 6, not on
web tables. Marketing-page density is separate and larger.

### Signature interactions

1. **Net-worth hero** — navy band, Fraunces number counting up over 900ms, gradient area chart bleeding to the band edges, KPI card row **overlapping the band's bottom edge by ~50%** (`SPEC §1.1` on a dashboard).
2. **Card wall** — accounts as fanned card art; click to spread, click again to expand into detail.
3. **Receipt scan reveal** — extracted values **fly out of the receipt image into their form slots**, each with a confidence-coloured underline. This one interaction sells the app.
4. **Money calendar drag** — drag a bill to a new date, projection line redraws live.
5. **Committee ring** — a circular member ring, filled segments = paid, brass segment = whose turn it is, your month marked.
6. **Zakat gauge** — wealth against nisab as a rising vessel; crossing nisab is a designed moment.
7. **Sankey cash flow** — income sources → categories → savings.
8. **Allocation donut morph** — tap a slice, the donut unrolls into a bar breakdown.
9. **Transaction rows** — merchant logo, sticky date headers with per-day totals, right-aligned tabular amounts; hover actions on web, swipe on mobile.
10. **Command palette (⌘K)** — jump anywhere, add a transaction, search in natural language.
11. **Detail as panel, never a page** — side panel on web, bottom sheet on mobile.
12. **Skeletons shaped like the real layout**, never spinners. Empty states get a 3D object.
13. **Motion budget** — entrance fade + 8px rise 220ms, stagger 40ms, press `scale(0.98)`. Count-up and chart draw-in are the only long animations. `prefers-reduced-motion` settles to final state (the shot script runs with it on).

---

## 5. Phase 0 — foundations

Five things the screenshot loop cannot fix afterwards.

**0.1 Reference set.** `design-brain/Images/` holds 48 HR/travel/landing references —
wrong domain. Collect **20–25 finance references** into `design-brain/Images/finance/`:
global premium (Copilot Money, Monarch, Mercury, Ramp, Wise, Revolut, Robinhood) **plus
Pakistani/regional** (SadaPay, NayaPay, Zindigi, Alfa, Meezan, JazzCash, Easypaisa, Raast).
Without these the comparison step has nothing to compare against.

**0.2 Repo scaffold** — `finance-tracker/finance-web/`. Next.js 16, React 19, Tailwind v4,
`@base-ui/react` + shadcn, framer-motion, recharts, lucide, next-intl (`en`/`ur`), zod,
TanStack Query + Table, `@supabase/ssr`. **pnpm — npm is broken on this machine.**
Routes under `[locale]` from day one; retrofitting i18n + RTL later is expensive.

**0.3 Token layer** — `globals.css` (marketing/auth) + `app.css` (`.app-shell`, product
palette). `bg-linear-to-*`, not `bg-gradient-to-*` (Tailwind v4). RTL logical-property
lint rule active.

**0.4 Logo set — a real task, not a footnote.** `simple-icons` covers global brands
(Netflix, Spotify, KFC, Careem) but **has almost no Pakistani brands**. So: assemble
~80 local marks — Foodpanda, Daraz, Bykea, inDrive, Imtiaz, Al-Fatah, Naheed, Chase Up,
Khaadi, Gul Ahmed, Sapphire, J., Outfitters, Bata, Servis, K-Electric, LESCO, IESCO,
SNGPL, SSGC, PTCL, StormFiber, Jazz, Zong, Telenor, Ufone, HBL, UBL, MCB, Meezan,
Bank Alfalah, Allied, Faysal, JazzCash, Easypaisa, SadaPay, NayaPay, PSO, Shell, Total
Parco, Dvago, Chughtai Lab, Shaukat Khanum, Cheezious, Broadway, Johnny & Jugnu,
Kababjees, Student Biryani, Gloria Jean's — sourced at 128px, background knocked out,
saved as WebP in `public/logos/`. **Point 2 of the premium formula depends entirely on
this existing before Wave A starts.**

**0.5 Mock data engine** — `src/mock/`, deterministic seeded generator, no `Math.random`
at render. Realism decides whether the UI reads premium:
- 18 months, ~2,400 transactions with **Pakistani rhythm** — salary at month-end, rent on the 1st–5th, doodh wala monthly, K-Electric bill mid-month, **Ramadan grocery spike**, **Eid clothing + Eidi burst**, **Qurbani in the Zil-Hajj month**, school fees quarterly, fuel purchases clustered around price revisions, a shaadi season month.
- 6 accounts (2 banks, 1 Meezan Islamic, JazzCash, SadaPay, cash), 3 cards, 2 loans, 80 merchants, 3 portfolios, 24 holdings, **8 plans** (DSC, Behbood, 2 Meezan funds, PSX basket, gold in tola, a DHA plot file, a Rs 40,000 prize bond holding), **2 active committees**, 40 receipts, 30 tasks.
- **Mock types authored to match the eventual DB shape** so phase 8 is a data-source swap, not a refactor.

**0.6 Lab + capture** — `src/app/[locale]/lab/<screen>/page.tsx`; layout imports `app.css`
and wraps in `.app-shell`. Capture from **PowerShell, not Git Bash**:
```powershell
cd "finance-tracker\finance-web"; pnpm dev
cd design-brain; $env:LAB_URL="http://localhost:3001"; pnpm shot /en/lab/overview --name overview --viewport both
```

---

## 6. Gemini 3D asset prompt pack

You generate these; I build against them. Six-part recipe verified in `ASSETS.md §Route A`
— object, material, palette, lighting, camera, negatives. **The negative clause is not
optional**: without it Gemini writes garbled pseudo-text onto screens and signage and the
asset is unusable above thumbnail size.

**Palette string used in every prompt** (paste verbatim, keep the hex):
> deep navy #0B1A33, warm cream #F8F6F1 and antique brass #C6A15B, with brass as the single metallic accent

**A1 — Dashboard hero island** *(16:9)*
> Isometric 3D render of a personal finance workspace floating as an island: a curved desk with a slim laptop showing an abstract rising area chart, a stack of two credit cards, a small potted plant, a tea cup, and a floating transparent panel with abstract bar shapes. Soft matte plastic and brushed metal materials. Colour palette: deep navy #0B1A33, warm cream #F8F6F1 and antique brass #C6A15B, with brass as the single metallic accent. HDRI studio lighting, strong ambient occlusion, soft contact shadows beneath the island. 35mm camera, subtle depth of field. Pure white background, absolutely no text, no letters, no numbers, no logos, no signage, no currency symbols. Ultra detailed, sharp, 8K.

**A2 — Empty-state objects** *(1:1, 2×2 sheet — batch trick from `ASSETS.md`)*
> 2x2 grid of four separate small isometric 3D objects on a pure white background, evenly spaced with generous white gaps between them. Top-left: an empty open wallet lying flat. Top-right: a blank desk calendar with no markings. Bottom-left: a single curled blank paper receipt. Bottom-right: an empty glass jar with a brass lid. Soft matte plastic with brushed brass details. Colour palette: deep navy #0B1A33, warm cream #F8F6F1 and antique brass #C6A15B, with brass as the single metallic accent. HDRI studio lighting, strong ambient occlusion, soft contact shadows under each object. 35mm camera, consistent scale and identical camera angle across all four. Pure white background, absolutely no text, no letters, no numbers, no logos, no signage. Ultra detailed, sharp, 8K.

**A3 — Core feature icons** *(1:1, 2×2 sheet)*
> 2x2 grid of four separate small isometric 3D icon objects on a pure white background, evenly spaced with generous white gaps between them. Top-left: a paper receipt curling upward. Top-right: a credit card at a slight angle. Bottom-left: a desk calendar. Bottom-right: a clipboard with three checkbox rows. Soft matte plastic with brushed brass details. Colour palette: deep navy #0B1A33, warm cream #F8F6F1 and antique brass #C6A15B, with brass as the single metallic accent. HDRI studio lighting, strong ambient occlusion, soft contact shadows under each object. 35mm camera, consistent scale and identical camera angle across all four. Pure white background, absolutely no text, no letters, no numbers, no logos, no signage, no currency symbols. Ultra detailed, sharp, 8K.

**A4 — Investment icons** *(1:1, 2×2 sheet)*
> 2x2 grid of four separate small isometric 3D icon objects on a pure white background, evenly spaced with generous white gaps between them. Top-left: a closed bank vault door with a brass wheel. Top-right: a rising staircase of three solid blocks with a small brass arrow above it. Bottom-left: a neat stack of round coins beside a single small gold bar. Bottom-right: a target disc with a dart in the centre. Soft matte plastic with brushed brass details. Colour palette: deep navy #0B1A33, warm cream #F8F6F1 and antique brass #C6A15B, with brass as the single metallic accent. HDRI studio lighting, strong ambient occlusion, soft contact shadows under each object. 35mm camera, consistent scale and identical camera angle across all four. Pure white background, absolutely no text, no letters, no numbers, no logos, no signage, no currency symbols. Ultra detailed, sharp, 8K.

**A5 — Committee / group savings** *(1:1 — the flagship feature needs its own object)*
> Isometric 3D render of eight small rounded human figures standing evenly spaced in a perfect circle on a floating cream platform, with a single brass coin hovering above the centre of the circle and a thin brass ring connecting the figures. Soft matte plastic with brushed brass details. Colour palette: deep navy #0B1A33, warm cream #F8F6F1 and antique brass #C6A15B, with brass as the single metallic accent. HDRI studio lighting, strong ambient occlusion, soft contact shadow beneath the platform. 35mm camera, subtle depth of field. Pure white background, absolutely no text, no letters, no numbers, no logos, no signage, no currency symbols, no facial features. Ultra detailed, sharp, 8K.

**A6 — Zakat / giving** *(1:1)*
> Isometric 3D render of two cupped open hands rising from a floating cream platform, with five small round coins hovering in a gentle arc above the palms, and a simple eight-pointed geometric star motif embossed flat on the platform surface. Soft matte plastic with brushed brass details. Colour palette: deep navy #0B1A33, warm cream #F8F6F1 and antique brass #C6A15B, with brass as the single metallic accent. HDRI studio lighting, strong ambient occlusion, soft contact shadow beneath the platform. 35mm camera, subtle depth of field. Pure white background, absolutely no text, no letters, no numbers, no logos, no signage, no currency symbols. Ultra detailed, sharp, 8K.

**A7 — Auth / onboarding object** *(4:5, portrait side panel)*
> Isometric 3D render of a rounded modern safe with a brushed brass dial, standing on a small floating cream platform, with three thin abstract cards fanned in the air above it. Soft matte plastic and brushed metal materials. Colour palette: deep navy #0B1A33, warm cream #F8F6F1 and antique brass #C6A15B, with brass as the single metallic accent. HDRI studio lighting, strong ambient occlusion, soft contact shadow beneath the platform. 35mm camera, subtle depth of field. Pure white background, absolutely no text, no letters, no numbers, no logos, no signage. Ultra detailed, sharp, 8K.

**A8 — Receipt scanner hero** *(16:9)*
> Isometric 3D render of a smartphone standing upright on a small floating platform, angled down toward a long curled paper receipt lying flat, with a soft brass scanning light beam between the phone and the receipt, and three small blank floating panels rising from the receipt. Soft matte plastic and paper materials. Colour palette: deep navy #0B1A33, warm cream #F8F6F1 and antique brass #C6A15B, with brass as the single metallic accent. HDRI studio lighting, strong ambient occlusion, soft contact shadows beneath the platform. 35mm camera, subtle depth of field. Pure white background, absolutely no text, no letters, no numbers, no logos, no signage, no currency symbols. Ultra detailed, sharp, 8K.

**A9 — Investments hero** *(16:9)*
> Isometric 3D render of a floating island with an ascending staircase of four solid blocks, a slim brass arrow curving upward above them, two stacks of round coins and one small gold bar at the base, and a thin transparent panel showing an abstract rising line. Soft matte plastic and brushed brass materials. Colour palette: deep navy #0B1A33, warm cream #F8F6F1 and antique brass #C6A15B, with brass as the single metallic accent. HDRI studio lighting, strong ambient occlusion, soft contact shadows beneath the island. 35mm camera, subtle depth of field. Pure white background, absolutely no text, no letters, no numbers, no logos, no signage, no currency symbols. Ultra detailed, sharp, 8K.

**A10 — Error / 404 object** *(1:1)*
> Isometric 3D render of a single tipped-over round coin resting on a small floating cream platform, with two smaller coins lying flat beside it. Soft matte plastic with brushed brass details. Colour palette: deep navy #0B1A33, warm cream #F8F6F1 and antique brass #C6A15B, with brass as the single metallic accent. HDRI studio lighting, strong ambient occlusion, soft contact shadow beneath the platform. 35mm camera. Pure white background, absolutely no text, no letters, no numbers, no logos, no signage, no currency symbols. Ultra detailed, sharp, 8K.

**Handling notes.** Gemini renders come back with an **off-white vignetted background**, not
pure white — they read as grey rectangles on a cream canvas. Fix with `mix-blend-mode: multiply`
at render time, or knock the background out once and save as WebP. Originals to
`design-brain/assets/finance/`, mirrored into `finance-web/public/generated/`.
**Look at each result before building on it** — text artefacts or off-palette output means
regenerate, not work around.

---

## 7. Phase 1 — web UI, screen by screen

One screen per block. Build → `pnpm shot` → compare against a reference → fix → repeat
3–5 rounds → your approval → next screen. No whole-page redesigns in one pass.

**Wave A — sets the visual language** (most rounds; everything downstream inherits)
| # | Route | Contains |
|---|---|---|
| 1 | `/lab/overview` | Net-worth navy hero + overlapping KPI row, cash-flow chart, recent transactions, upcoming bills, budget rings, committee + Zakat strip |
| 2 | `/lab/transactions` | Filter bar, sticky date groups, merchant-logo rows, detail side panel, bulk edit, split UI |
| 3 | `/lab/accounts` | Card wall (banks + JazzCash/SadaPay wallets), account detail, balance history, Raast vs IBFT fee view |

**Wave B — the differentiators**
| # | Route | Contains |
|---|---|---|
| 4 | `/lab/calendar` | Month grid with money, projection line, drag-to-reschedule, **dual Hijri/Gregorian**, Pakistani event overlays, agenda + heatmap |
| 5 | `/lab/receipts` | Receipt inbox, capture/upload, **the extraction review screen**, FBR POS QR path, line-item split, match-to-transaction |
| 6 | `/lab/investments` | Portfolio overview, allocation donut, holdings table, **plan detail with XIRR/CAGR/TWR + real return**, NSS certificate ladder, prize bond draws, gold in tola, plot-file instalments, Shariah filter |
| 7 | `/lab/committee` | **Committee tracker** — member ring, payment status, payout month, implied-XIRR comparison |
| 8 | `/lab/zakat` | **Zakat engine** — nisab gauge, zakatable asset breakdown, hawl timeline, CZ-50 reminder, payment log |

**Wave C — supporting screens**
| # | Route | Contains |
|---|---|---|
| 9 | `/lab/budgets` | Category budgets, rollover, safe-to-spend, **event budgets** (Ramadan/Eid/Qurbani/shaadi) |
| 10 | `/lab/tasks` | Financial todos, recurring, linked entities, auto-generated tasks |
| 11 | `/lab/goals` | Hajj/Umrah, plot, car, wedding, education; funding sources and required contribution |
| 12 | `/lab/debts` | Bank EMI + amortisation, **qarz (interest-free family loans)**, avalanche vs snowball |
| 13 | `/lab/tax` | **FBR surface** — Jul–Jun year, filer/non-filer toggle and cost, withholding ledger, slab calculator, IRIS-shaped export |
| 14 | `/lab/reports` | Income vs expense, category treemap, **Sankey**, top merchants, inflation-adjusted net worth |

**Wave D — the frame**
| # | Route | Contains |
|---|---|---|
| 15 | `/lab/settings` | Profile, workspace + members, categories, rules, **filer status**, Zakat preferences, language (en/ur), currency display |
| 16 | `/lab/auth` | Sign in / up / reset / 2FA + onboarding (A7) |
| 17 | `/lab/states` | Every empty, loading, error and zero-data state in one sweep |
| 18 | `/lab/landing` | Marketing page — landing density and type scale |

Dark mode is designed immediately after Wave A and carried through everything after.
Every screen is captured **LTR and RTL**. Approved screens move from `lab/` into `(app)/`;
nothing in the product imports from `lab/`, so it stays deletable.

---

## 8. Phase 2 — Supabase schema

Own Supabase project, own conventions, **no Vellora coupling**:

| Convention | Value |
|---|---|
| ORM | Drizzle, SQL migrations in `drizzle/` |
| PK | `id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL` |
| Timestamps | `created_at` / `updated_at` `timestamptz DEFAULT now() NOT NULL` |
| Naming | snake_case, plural tables, `<table>_<col>_idx`, `<table>_<cols>_unique` |
| Tenancy | `workspace_id uuid NOT NULL` on every tenant table |
| RLS | enabled **and** `FORCE`d on every table, keyed on `auth.uid()` via a `workspace_members` lookup — standard Supabase auth, no GUC indirection |
| Money | `bigint` **paisa** (PKR minor units) + `currency text` — never floats |
| Quantities | `numeric(24,8)` — crypto needs 8 decimals; gold stored in grams, displayed in tola |
| Dates | Gregorian in the DB; Hijri derived at read time, never stored |

**Core tables:** `workspaces`, `workspace_members`, `accounts`, `institutions`, `categories`,
`merchants`, `transactions`, `transaction_splits`, `transfers`, `rules`, `budgets`,
`budget_periods`, `event_budgets`, `recurring_series`, `bills`, `tasks`, `task_occurrences`,
`receipts`, `receipt_line_items`, `portfolios`, `instruments`, `holdings`, `investment_plans`,
`investment_transactions`, `price_snapshots`, `nss_rate_table`, `prize_bond_holdings`,
`prize_bond_draws`, `committees`, `committee_members`, `committee_payments`, `zakat_years`,
`zakat_payments`, `tax_years`, `withholding_entries`, `goals`, `debts`, `debt_schedule`,
`net_worth_snapshots`, `fx_rates`, `gold_rates`, `attachments`, `audit_log`.

**Ledger integrity:** every transaction is a header plus `transaction_splits` rows that must
sum to the header amount, enforced by a trigger. Transfers are a linked pair so net worth
never double-counts. This split-based double-entry pattern makes fees, partial-category
allocation and multi-account moves reportable instead of special-cased.

**POS seam (for later, nothing built now):** `workspaces` carries a `kind` of
`personal | household | business`, and `merchants` is modelled as a first-class entity
rather than a text field. That is the entire hook — enough for a future POS to push sales
and purchases in, with no speculative tables built today.

Written and migrated in this phase; **nothing wired to the UI yet.**

## 9. Phase 3 — wiring, screen by screen

Same order as phase 1. Per screen: swap the `src/mock/` import for a TanStack Query hook
against the same TypeScript types, add mutations, optimistic updates, loading and error
states. **Component props do not change** — the payoff of authoring mock types against the
DB shape in 0.5.

Then: auth + workspace provisioning, CSV / bank-statement import, and the calculation engine
— XIRR (Newton-Raphson with bisection fallback), TWR, CAGR, **real return vs CPI**,
amortisation, **NSS profit accrual per certificate rules**, **Zakat hawl + nisab**,
**FBR slab and withholding**, **committee position XIRR**, budget rollover, recurring-series
materialisation, notifications.

## 10. Phase 4 — OCR and intelligence

**OCR.** Research finding: purpose-built extractors lead on clean receipts (Veryfi best on
financial documents; Textract AnalyzeExpense ~93% field / 89% line-item; Mindee fastest to
integrate but 3–5% behind on complex documents). **For Pakistan the recommendation is Claude
vision as the primary extractor**, with a strict zod-validated JSON schema — because the real
input here is faded thermal paper, **mixed Urdu/English**, and handwritten kiryana *parchi*,
which fixed-field extractors handle poorly and a multimodal model handles natively, with line
items and no per-vendor templates. **FBR POS invoices take a separate, cheaper path**: read
the printed QR for verified merchant, GST and total, and skip extraction entirely.
Pipeline: upload → Supabase Storage → Edge Function → extract → confidence-scored fields →
review UI → match or create.

**Then:** rules engine, anomaly and duplicate detection, subscription price-hike detection,
cash-flow forecasting, **Urdu + English natural-language search**, filer-status advisor,
committee-vs-certificate comparison, weekly digest.

## 11. Phase 5 — mobile (Expo)

Starts only after the web visual language is settled. `finance-tracker/finance-mobile/`:
Expo 54, React Native 0.81, NativeWind 4, Moti, Reanimated 4.

Tokens exported from one shared TS file consumed by both Tailwind configs, so cream/navy/brass
can never drift. Mobile follows `SPEC §2`: greeting header, pill search + square filter button,
scrolling chip rows, **floating inset bottom-nav island** (never a flat bar), media cards,
bottom action bars. Radii return to the 20–28px band — that band was read off mobile references.
RTL is native via `I18nManager`.

Priority: Overview → Transactions → **Receipt capture** (genuinely better on a phone) →
Calendar → Committee → Accounts → Investments → Tasks.

Haptics on: transaction saved, receipt extracted, committee payment marked, budget threshold
crossed, swipe actions.

**Honest limitation:** `pnpm shot` is Playwright over a web route and won't drive an Expo app.
Mobile rounds use Expo Web for layout plus real device screenshots for the final call — a
slower loop, which is the main reason web goes first.

---

## 12. Verification

- **Per screen:** `pnpm shot /en/lab/<name> --name <name> --viewport both`, plus a `/ur/` capture for RTL. Compare side by side against its `design-brain/Images/finance/` reference. Run `SPEC.md §10`'s 10-point checklist on every capture — the last item ("would this survive being placed next to the reference without looking like the cheap one?") is the one that decides.
- **Per wave:** `pnpm typecheck` and `pnpm lint` clean; both viewports, both surface modes, both text directions captured; reduced-motion capture settles to final state, not blank.
- **Assets:** every Gemini render inspected at full size before use — no text artefacts, palette on-brand, camera consistent across a sheet.
- **Schema (phase 2):** migrations apply to a clean database; RLS proven by querying as `authenticated` against a foreign `workspace_id` and getting zero rows; split-sum trigger proven by an unbalanced insert being rejected.
- **Calculations (phase 3):** XIRR, TWR, CAGR, amortisation, **Zakat nisab/hawl**, **FBR slabs** and **NSS accrual** unit-tested against known-good values before any of it reaches a screen. Tax and Zakat maths carry a visible "verify with your own advisor" line — this app computes, it does not advise.

---

## Open items

- **Name** — deferred by you. Working name `finance-tracker`; rename stays cheap.
- **Fraunces vs Instrument Serif vs Sora** — decided in round 1 of Overview on a real hero KPI.
- **Urdu at launch or after** — the RTL groundwork goes in from day one either way (it can't be retrofitted), but whether Urdu *strings* are translated during the UI phase or after is worth a decision when we reach Wave D.

## Sources

- [Digital payment apps Pakistan 2026 — JazzCash vs Easypaisa vs SadaPay vs NayaPay](https://freetoolforge.org/guides/best-digital-payment-apps-pakistan-2026) · [Best digital wallets in Pakistan](https://www.remitbee.com/blog/money-transfer/remittance/best-digital-wallets-in-pakistan)
- [National Savings — latest profit rates](https://savings.gov.pk/latest-profit-rates/) · [Prize bonds](https://savings.gov.pk/prize-bonds/) · [National Savings Certificates 2026](https://investellia.com/national-savings-certificates-pakistan-2026-rates-types-how-to-buy/)
- [FBR income tax slabs 2025-26](https://hisaabkar.pk/guides/fbr-income-tax-slabs-2026/) · [Withholding tax rates Pakistan 2025-26](https://waystax.com/withholding-tax-rates-in-pakistan/)
- [Zakat calculation Pakistan 2026](https://qubafoundation.org/calculate-zakat-2026-pakistan/) · [Zakat on gold and silver](https://www.transparenthands.org/gold-prices-in-pakistan-and-how-to-calculate-zakat/)
- [Invoice OCR API benchmarks 2026](https://invoicedataextraction.com/blog/invoice-ocr-api-benchmarks) · [Best OCR API 2026](https://imagetotable.ai/blog/best-ocr-api-2026)
- [Measuring investment performance — ROI, CAGR, TWR, MWR, IRR](https://www.mycapitally.com/blog/measuring-investment-performance)
- [Fintech UX practices 2026](https://procreator.design/blog/best-fintech-ux-practices-for-mobile-apps/) · [Bento grid dashboard design 2026](https://www.orbix.studio/blogs/bento-grid-dashboard-design-aesthetics)
- [Real-time double-entry ledger design](https://finlego.com/blog/designing-a-real-time-ledger-system-with-double-entry-logic) · [Supabase RLS best practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
