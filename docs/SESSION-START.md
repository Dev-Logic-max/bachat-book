# Starting a new session

Open the session **inside `finance-tracker/Bachat Book/`** so the 27KB `CLAUDE.md`
loads automatically. It carries the product rules and the Traps list, and every
one of those traps cost a round to learn. Do not open inside `web/` or `app/` —
those hold stubs, and the real instructions will not load.

Then paste the prompt at the bottom of this file.

---

## 1. Where the product actually is

**Live database.** Supabase project `brunpltiektawjtcivwa` (`ap-south-1`),
seeded, RLS proven through the REST API rather than only in SQL. Clients at
`web/src/lib/supabase/`.

**`web/` builds clean** — 41 routes, 0 lint errors, 0 type errors.

**`app/`** (Expo) is a separate workstream. A different session is working in it.
Do not touch `app/` from a web session; stage web files only when committing.

### Modules, honestly assessed

| | State | What that means |
|---|---|---|
| **M1** Identity, households, plans | **Done** | Sign-up, onboarding, invitations, roles, workspaces, plan gating, admin console with a real role guard |
| **M2** Accounts & the ledger | **Done** | ONE ledger (`transactions`). Accounts, transfers, splits, rules, the 152-row category catalogue, statement import stub |
| **M3** Calendar & tasks | **Done** | Task board with 4 columns, subtask pricing, task↔entry two-way sync, calendar showing tasks and events |
| **M4** Budgets, goals, debts | **Part done** | Budgets live. Event budgets, goals and debts **not built** |
| **M5** Investments | **Screens only** | UI exists, schema is thin. Not wired to real data |
| **M6** Committee (BC) | **Screens only** | Same — the XIRR comparison that makes it a flagship is not built |
| **M7** Zakat & Tax | **Screens only** | Calculators work off inputs; no `zakat_years`, no withholding ledger |
| **M8** Receipts & OCR | **Not started** | Route stub only |
| **M9** Reports | **Partial** | Reports page exists; no snapshots table, no Sankey, no exports |
| **M10** Admin | **Mostly done** | Console, households, institutions, category catalogue. No audit log, no notification centre |

### The core rules that are non-negotiable

These are in `CLAUDE.md` in full. The short version:

- **Money is `bigint` paisa.** Never float, never `numeric`.
- **ONE LEDGER.** `transactions` is the only store of money movement. Entries and
  Transactions are two filtered views of it. Never add a second table "for
  convenience" — that was tried, and every gap between the copies was a bug.
- **`transactions.amount_paisa` is SIGNED** and tied to `type` by a constraint.
  Read the sign when rendering, never `type`.
- **Platform roles ≠ household roles.** `user_roles` vs `household_members`.
  Collapsing them is the classic RLS bug.
- **`is_household_member()` means "may read". Writes need `is_household_editor()`.**
  Every tenant table needs four policies, not one `FOR ALL`.
- **`types.ts` is HAND-WRITTEN.** Running `supabase gen types` over it is a
  downgrade — it deletes ~15 string-union aliases and 40 import sites with them.
- **After any migration run `notify pgrst, 'reload schema';`** or every REST call
  returns a bodyless 404 while the schema looks fine.
- **The layout never mirrors.** `<html dir="ltr">` in every locale.

---

## 2. What was built in the last three sessions

Newest first. All committed, none pushed.

**`0d97634` — nested modals**
Adding a subcategory from inside a task closed every dialog and created nothing.
Three nested modals meant three nested `<form>` elements, so the inner submit ran
the outer form's save too. `Modal` now renders through a **portal** and **stops
propagation** on submit. Also: subtask drag-reorder now works (the grip had never
been wired to anything), the Overdue column moved to last, and the task card's
row actions float over the title instead of moving the priority tag.

**`12f71e0` — category CRUD**
A new subcategory was written but invisible: household rows carry `sort_order`
1000, so they sorted behind every seeded row and fell outside the card's
six-row slice. Own rows now always render. Separately, the on/off switch was
writing to `household_hidden_categories` for every row — that table rejects your
own rows, so the toggle silently failed on exactly the ones you created. Two
mechanisms now, one reader (`isCategoryOff`). Adds `/admin/categories`, which did
not exist: the shared main categories had **no** admin screen for weeks.

**`9424d03` — subtask pricing**
A paid task used to want one figure up front — the number you do not have while
you are still in the shop. Each subtask now takes its own price as you tick it
(eggs 230, oil 520, tissue 110) and completing the task opens on their total,
still editable. Adds `task_checklist_items.amount_paisa`, makes the task↔entry
sync symmetric on the name, and gives completed tasks a receipt chip that deep
links to the exact ledger row.

Before those: the 26/126 category catalogue, the two-tier ownership model, the
5-tab bottom nav, workspace cards, and the header/rail chrome.

---

## 3. What is NOT done, in priority order

1. **The 26 category icons are missing.** Every `/categories/*.png` 404s and
   falls back to a placeholder ring. Brief in `docs/ASSET-PROMPTS.md`. This is
   the biggest visual gap and it is blocked on the owner, not on code.
2. **M4** — event budgets, goals, debts. See §4.
3. **Four env vars are unset**, so three finished features are inert:
   `EMAIL_API_KEY` (invitations), `CRON_SECRET` (daily digest — the endpoint
   correctly refuses every request without it), `WHATSAPP_VERIFY_TOKEN` and
   `WHATSAPP_APP_SECRET` (webhook).
4. **Leaked-password protection is off** in Supabase Auth, and the seed admin
   password is still `password@admin`.
5. **M5–M10** have screens without schema. Each needs schema → API → screens.
6. **Nothing is deployed.** No Vercel project yet.

---

## 4. Decisions already taken — do not relitigate

- **Udhaar is ONE feature with two faces.** Personal lending (`qarz`) and shop
  customer khata share tables; the workspace preset decides which screen you get.
  A shopkeeper who also lends to family gets both without switching apps.
- **Import from DigiKhata / CashBook / Excel is its own module.** Build the basic
  version — file in, column mapping, preview, idempotent write — and refine when
  the owner supplies real export files from those apps.
- **Goals are on hold.** The owner's call: finish what the application needs
  first. Do not build goals without asking again.
- **Event budgets are the M4 priority** — Ramadan, Eid, Qurbani, shaadi, school
  admission, forecast from last year's actuals. Nothing else on the Pakistani
  market does this.
- **Plans belong to a PERSON, not a workspace.** A workspace runs on its owner's
  plan. Gate with `household_plan_code()`, never the viewer's own plan.

---

## 5. How to work here

**Run it:**
```powershell
cd "Bachat Book\web"; pnpm dev      # port 3100 — pnpm only, npm is broken
```

**Screenshot it** (from PowerShell, never Git Bash — Bash rewrites the leading
`/` into a Windows path and the route 404s):
```powershell
cd "..\..\design-brain"; $env:LAB_URL="http://localhost:3100"
pnpm shot /lab/<screen> --name <screen> --viewport both
```

**Verify against the live database, not against your own diff.** Every fix above
was confirmed by driving the real UI with Playwright and reading the network
responses. Several "obvious" fixes were wrong until that happened.

**Commits:** one subject line, then 2–3 plain lines. No file lists, no test
results, **never** a `Co-Authored-By` trailer. Never commit a doc-only change on
its own — let it ride with the next real commit.

---

## 6. Prompt to paste into the new session

```
Read CLAUDE.md and docs/SESSION-START.md first — SESSION-START has the current
state of every module and the decisions already taken.

Context: M1, M2 and M3 are done and proven. M4 is partly done (budgets live;
event budgets, goals and debts missing). M5-M10 have screens but thin schema.
The web app builds clean on 41 routes. A separate session owns app/ — do not
touch it, and stage web files only.

Your job this session is <STATE IT HERE>.

Rules I care about:
- Verify against the live database and the real UI, not against your diff.
  Drive it with Playwright and read the actual network responses.
- Ask me for decisions DURING the session, not after you stop. Use simple
  language and give me a concrete Pakistani example for each option.
- Do not touch the core ledger. transactions is the only store of money
  movement and its behaviour is settled.
- types.ts is hand-written. Never run `supabase gen types` over it.
- After any migration: notify pgrst, 'reload schema';
```
