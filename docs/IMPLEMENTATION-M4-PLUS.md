# Implementation plan — debts, import, and the five verticals

Written 2026-08-19, against the schema as it stands. Read `docs/SESSION-START.md`
first for the state of every module and the decisions already taken.

**The rule that governs all of this:** `transactions` is the only store of money
movement, and it is settled. Everything below is either a *reader* of the ledger
or writes to it through the one door that already exists — the pattern
`tasks.settled_transaction_id` uses, where a feature row points at a ledger row
and a trigger keeps the pair in step. Nothing here gets its own money table.

---

## A · Debts and udhaar — the next thing to build

**Decision taken:** one feature, two faces. Personal lending (`qarz`) and shop
customer khata share tables; the workspace preset decides which screen you see.
Repayments are **real money** and hit the ledger.

### The modelling problem, and its answer

Lending Rs 5,000 to your cousin is not an expense. You still own the money — it
has changed from cash into a receivable. If it is written as `type='expense'` it
inflates "money out" on the dashboard and in Entries, and the user is told they
spent Rs 5,000 they did not spend.

The ledger already has exactly one concept for "money moved but this is not
income or expense": **transfer**. CLAUDE.md states it plainly — *transfers and
opening balances are not flow* — and every money-in/money-out figure already
excludes them. Lending out is a transfer from your account to somewhere outside;
repayment is a transfer back.

**Before writing any code, check `transactions_amount_sign_check` and whether
`transfer_account_id` is nullable.** If a one-legged transfer is not permitted,
the fallback is a dedicated `is_lending` boolean on `transactions` — but check
first, because adding a column to the ledger is exactly what this plan tries to
avoid.

### Schema

```
debts
  id, household_id
  contact_id            → contacts, ON DELETE SET NULL
  counterparty_name     text NOT NULL   -- denormalised: deleting a contact
                                        -- must not erase who owed you money
  direction             'owed_to_us' | 'owed_by_us'
  kind                  'qarz' | 'loan' | 'khata'
  principal_paisa       bigint > 0
  due_date              date NULL        -- qarz usually has none
  status                'open' | 'settled' | 'written_off'
  opening_transaction_id → transactions, ON DELETE SET NULL
  note, created_at, updated_at

debt_payments
  id, debt_id → debts ON DELETE CASCADE
  amount_paisa   bigint > 0
  date           date
  transaction_id → transactions, ON DELETE SET NULL
  note, created_at
```

Outstanding is **derived**: `principal − sum(payments)`. Never stored. A stored
balance and a payment list will disagree the first time a payment is edited, and
then you have two numbers and no way to tell which is right.

### Behaviour that must hold

- Deleting a repayment must delete its ledger row, or the account keeps money
  the debt no longer accounts for. Mirror `uncompleteTask` — entry first, while
  the link still points at it, then clear the link.
- Overpayment is allowed and shown as such ("Rs 200 more than owed"), not
  blocked. People round up.
- `written_off` keeps every row. It is a status, never a delete — the money
  genuinely left, and last year's totals must not silently change.
- Four RLS policies per table. Reads `is_household_member`, writes
  `is_household_editor` **and** `workspace_is_active`.

### Screens

- **Personal preset** — one list: "owed to me" / "I owe", a running total each
  way, a contact avatar per row, one tap to record a repayment.
- **Shop preset** — customer khata: searchable customer list with running
  balances, a per-customer ledger, and "give goods on credit" as the primary
  action rather than "lend money".

Both read the same tables. `lib/modules.ts` decides which route the rail shows.

---

## B · Import — its own module

**Decision taken:** build the basic module now — file in, column mapping,
preview, idempotent write. Refine when real DigiKhata / CashBook exports arrive.

### Why it is its own module and not a bigger Import Statement screen

A bank statement is one shape from one institution. A migration is an arbitrary
CSV/XLSX from a competitor whose columns are in Urdu-English mix, whose dates
are `12-03-25` with no stated order, and whose amounts may be `1,200` or `1200/-`.
That needs mapping UI and a dry run; a statement parser does not.

### Schema

```
import_jobs
  id, household_id, source ('digikhata'|'cashbook'|'excel'|'bank'|'other')
  filename, status ('draft'|'previewed'|'committed'|'failed')
  mapping jsonb          -- their column → our field
  row_count, imported_count, created_by, created_at

import_rows
  id, job_id → import_jobs ON DELETE CASCADE
  row_index int
  raw jsonb              -- the original line, kept verbatim
  parsed jsonb           -- after mapping and coercion
  status ('pending'|'imported'|'skipped'|'error')
  error text
  transaction_id → transactions ON DELETE SET NULL
  fingerprint text       -- hash of (date, amount, counterparty, note)
```

**`fingerprint` is what makes a re-run safe.** Unique index on
`(household_id, fingerprint)`; a second import of the same file writes nothing.
Without it, importing twice doubles two years of a shopkeeper's history and there
is no way to tell which copy is real.

### Flow

1. Upload → parse → guess the mapping from the header row.
2. **Mapping screen** — their column on the left, our field on the right, live
   sample values from row 1 so a wrong guess is obvious.
3. **Preview** — first 50 rows as they would land, with per-row errors and a
   count of duplicates that will be skipped. Nothing written yet.
4. **Commit** — insert inside one transaction, write `transaction_id` back onto
   each `import_row` so the whole job is reversible.
5. **Undo** — delete every transaction this job created. Only possible because
   step 4 recorded them.

### Research still to do

Get real exports from DigiKhata, CashBook, Udhaar Book and one PK bank. The
column names, date formats and the way each encodes "customer owes me" versus
"I paid supplier" cannot be guessed and must not be assumed.

---

## C · The five verticals

**Decision taken:** implementation plan now, "coming soon" in the UI, build
later by explicit decision.

All 21 module entries already exist in `lib/modules.ts` with `status: "soon"`,
which is what makes them appear in the workspace picker and the rail. **Do not
remove them.** The registry is the single source the rail, the bottom nav and
the create-workspace picker all read.

### Shop — build first

Where udhaar actually lives, and DigiKhata's market.

| Module | Tables | Note |
|---|---|---|
| Customer Khata | reuses `debts` + `debt_payments`, `kind='khata'` | The whole point of decision A |
| Suppliers | `suppliers`, `supplier_bills` | Mirror image of khata — you owe them |
| Inventory | `products`, `stock_movements` | Cost and quantity only. Not a full POS |
| Daily Close | `daily_closes` | Counted cash vs what the ledger says. The difference is the finding |

**Daily Close is the one worth getting right.** A shopkeeper counts the drawer
each night; the app already knows what it should be. Naming the gap is the most
useful thing this vertical does.

### Freelance — build second

| Module | Tables |
|---|---|
| Clients | reuses `contacts` |
| Invoices | `invoices`, `invoice_lines` |
| Remittance & PRC | `remittances` — USD in, PKR out, the PRC for FBR |

Small, and the PRC piece is genuinely unserved: freelancers earning in dollars
need a Proceeds Realisation Certificate at tax time and currently track it in
WhatsApp messages to their bank.

### Agriculture, Factory, Rental — plan only

Each is a different user with a different vocabulary. Sketched in
`docs/ROADMAP.md`; do not start any of them until shop and freelance are real
and someone is actually using them.

---

## D · Sequence

1. **Debts / udhaar** — finishes M4 and unlocks shop khata.
2. **Import module** — basic version; the thing that lets a DigiKhata user move.
3. **Shop vertical** — khata, suppliers, inventory, daily close.
4. **M5–M7 schema** — investments, committee, Zakat/tax currently have screens
   without tables.
5. **Freelance vertical.**
6. **M8 receipts, M9 reports, M10 audit log.**

Goals are deliberately absent. The owner's call: finish what the application
needs first, and ask again before building them.
