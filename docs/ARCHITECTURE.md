# The module ↔ ledger contract

How money moves through Bachat Book. This is the reference for anyone adding a
module or touching one that already exists.

Read `CLAUDE.md` first for the product rules and the Traps list. This file is the
one that says **who is allowed to write money, and what happens on edit.**

---

## 1. There is one ledger

`transactions` is the only store of money movement. Everything else describes it.

```
                          ┌──────────────────────┐
                          │     transactions     │  ← the only money
                          │  signed bigint paisa │
                          └──────────┬───────────┘
                                     │
                 ┌───────────────────┼───────────────────┐
                 ▼                   ▼                   ▼
           ┌──────────┐      ┌──────────────┐     ┌───────────┐
           │ Entries  │      │ Transactions │     │ Accounts  │
           │ (a view) │      │   (a view)   │     │ balances  │
           └──────────┘      └──────────────┘     └───────────┘
```

| Screen | Shows | Filter |
|---|---|---|
| **Entries** | Income and expense, cash included | `type in (income, expense) and not is_opening` |
| **Transactions** | Bank/wallet movement, plus every transfer | `type = 'transfer' or account.type in (checking, savings, wallet)` |
| **Accounts** | The running total those rows add up to | `sync_account_balance_trigger` |

An income or expense on a **bank** account appears on both screens. On a **cash**
account it appears only in Entries. A **transfer** appears only in Transactions —
which is why a loan paid out of cash cannot be found in Entries, and why
`ledgerRef()` must never send you there looking for one.

There is no second table for "quick entries". There never will be. Two tables
holding the same movement with an optional link between them is where the bugs
lived.

---

## 2. The satellite modules

Investments, Udhaar, Committee and Zakat each keep their own records **and**,
when a record names an account, write **exactly one row** into `transactions`.

> The module row is the **meaning**. The ledger row is the **money**.

```
  investments.funding_transaction_id ─┐
  investments.exit_transaction_id ────┤
  investment_payouts.transaction_id ──┤
  debts.opening_transaction_id ───────┼──→  transactions.id
  debt_payments.transaction_id ───────┤
  committee_payments.transaction_id ──┘
```

Every one of those columns is nullable, and null is a **real, supported state**:
gold you have owned for thirty years, a khata the shopkeeper is only now writing
down, a friend's committee instalment that never passed through your bank.

### What each module writes

| Module | Event | Ledger row | Why |
|---|---|---|---|
| **Investments** | Buy a holding | `transfer`, negative | Buying is not spending — you still own the money, it changed form |
| | Profit received | `income`, positive | Genuinely new money |
| | Profit reinvested | **nothing** | No cash arrived; the growth is inside `current_value_paisa` |
| | Cash it in | `transfer`, positive | The money coming back was always yours |
| **Udhaar** | Lend | `transfer`, negative | Lending is not spending |
| | Borrow | `transfer`, positive | Borrowing is not income |
| | Repayment | `transfer`, opposite sign to the opening | |
| **Committee** | **My** instalment | `expense`, negative | The money is gone; what returns is the payout |
| | **My** payout | `income`, positive | Genuinely new money arriving |
| | Anyone else's instalment | **nothing** | Ahmed's Rs 5,000 never passed through my bank |
| **Zakat** | Payment logged | `expense`, negative | Money really left, to Edhi or a madrassa |

**Why a one-legged `transfer` and not an `expense`.** Three reasons, all load-bearing:

1. Lending Rs 5,000 is not spending Rs 5,000. Written as an expense it would
   poison the dashboard, every budget, every report and the tax surfaces at once.
2. `transactions_amount_sign_check` exempts transfers, so a negative amount is
   legal without inventing a fourth transaction type.
3. Every money-in / money-out figure in the product **already** excludes
   transfers by `type`. Nothing downstream has to learn that debts exist.

The account balance still moves, because `sync_account_balance_trigger` adds
`amount_paisa` directly. **That is the whole trick: balances move, flow does not.**

---

## 3. The four cases

Any save that can change a record's account must handle **all four**. Writing
three of them is the exact shape of the bug the single ledger exists to prevent —
the old entry/transaction pair had branches for adding a link and for removing
one, none for *moving* one, so changing an entry's account was a silent no-op.

| Existing leg | Account named | Do |
|---|---|---|
| yes | yes | **update** it — account, amount, date, note |
| yes | no | **delete** it; the balance goes back |
| no | yes | **create** it |
| no | no | nothing |

`legAction()` in `lib/module-ledger.ts` returns which. Order matters on delete:
**the ledger row goes first, while the link still points at it.** Every
`transaction_id` is `ON DELETE SET NULL`, which points the wrong way — drop the
module row first and the ledger row is stranded with nothing naming it.

### Where this lives

| Module | Create | Edit | Delete |
|---|---|---|---|
| Investments | `createInvestment` · `recordPayout` | `updateInvestment` · `updatePayout` · `syncHoldingToLedger` | `deleteInvestment` · `deletePayout` |
| Udhaar | `createDebt` · `recordPayment` | `updateDebt` · `updateDebtPayment` | `deleteDebt` · `deletePayment` |
| Committee | `recordCommitteePayment` | `updateCommitteePayment` | `deleteCommitteePayment` · `deleteMember` · `deleteCommittee` |

Retro-syncing a record that never had a leg goes through the **same** update
function, never a shortcut that only knows how to insert. That is what keeps a
record that grew a leg afterwards indistinguishable from one that had it from the
start — there is one way for a debt to hold an opening transfer, not two.

---

## 4. Whether an account may take a movement

Two independent rules, both enforced in the **database**, because a disabled
`<option>` stops a click — not a REST call, a statement import, or an edit that
drags an existing expense onto the account.

**`assert_account_accepts_movement`** — availability.

| State | Meaning | Blocks |
|---|---|---|
| `deleted_at` | Tombstone. Past rows survive and render a "Deleted account" tag | everything |
| `is_archived` | Deactivated. Reversible, hidden from pickers, excluded from what you hold | everything |
| `is_locked` | Savings you may pay into but never spend from. Never valid for `cash` | outgoing only |

**`assert_account_has_funds`** — sufficiency. No movement may drive
`balance_paisa` below zero unless `accounts.allow_negative_balance` is true.

- Fires on **insert and update only**. Deletes are never blocked — a delete is
  how a wrong row gets corrected away, and refusing it would deadlock the fix.
- An edit is measured by the **difference**. Raising an existing Rs 5,000 expense
  to Rs 6,000 asks the account for Rs 1,000, not a fresh Rs 6,000.
- Moving a row to a different account checks **both** sides: dragging an income
  off an account lowers that account too.
- The exception is per **account**, not per movement. A current account with a
  running finance facility can go negative; a cash box cannot. Set it in
  Edit Account.

`checkFunds()` in `lib/module-ledger.ts` says the same thing in the form, live,
naming the account and the shortfall. **It is the explanation, not the
protection** — a form that checks first still loses the race against a second tab.

Unavailable accounts are **shown** in pickers, greyed with a reason chip, never
hidden. An account that vanishes reads as data loss and sends you hunting for it.

---

## 5. Net worth is not cash in hand

`lib/net-worth.ts` is the single source. The dashboard, Reports and Zakat all read
it, so they cannot disagree.

```
  cash in hand  =  Σ live account balances
  net worth     =  cash + open holdings at today's value
                        + udhaar owed to you (open, outstanding)
                        − udhaar you owe     (open, outstanding)
```

Four rules, each of which is a wrong number someone would otherwise see:

1. **Lending does not change net worth.** The transfer leg already took the money
   out of the account; the receivable adds it back. Cash falls, net worth is flat.
2. **Borrowing does not change net worth either.** Cash rises and the liability
   rises with it. Counting the cash without the debt would inflate net worth by
   every rupee ever borrowed — which is why the payable is netted off rather than
   ignored, even though the money is genuinely in your hand.
3. **A written-off receivable drops out**, because `status` is no longer `open`.
   Writing off therefore *lowers* net worth and touches no balance — the rupees
   left when you lent them and they are not coming back. That is the honest answer.
4. **Holdings count at today's value**, funded through the ledger or not. A plot
   bought before the app existed is still yours. What that requires is that an
   account which *did* pay for a holding actually records it — an unsynced holding
   funded from an untouched balance is counted twice, which is what the sync icon
   on the card exists to close.

**Net worth can be lower than cash in hand.** That is not a bug. It is what owing
more than you are owed looks like, and it is the ordinary state of anyone
repaying a loan.

---

## 6. Every record links to its ledger row

`LedgerRefChip` on the card; `ledgerRef()` picks the destination.

- `type = 'transfer'` → `/transactions?month=YYYY-MM&tx=<id>`
- everything else → `/entries?month=YYYY-MM&entry=<id>`

**The month is not optional.** Both screens open on the current month, so an id
alone lands on a page that does not contain the row.

Where a record has **no** ledger row and something can be done about it, the card
shows a **sync icon** instead — first in `RowActions`, before the pencil, because
it adds where the other two change and destroy. It appears only on unsynced
records, so its presence is the message: everything without it is accounted for.
It opens `LinkToAccountModal`, which is shared by every module and checks funds.

Delete dialogs name every linked row **and link to it**. Listing what you are
about to destroy without a way to look at it asks for the user's trust rather
than their judgement.

---

## 7. The household switches

`household_integrations` — `sync_investments`, `sync_committees`, `sync_zakat`.
Off by default.

- The switch governs whether **new** records offer an account. It never
  backfills: twelve holdings would swing the balances by lakhs on one click with
  nothing on screen able to explain it.
- Turning it **off** breaks nothing already linked. An existing record with a leg
  keeps showing its account picker so the row can still be moved or detached —
  otherwise "off" would strand a real ledger row with no way to reach it.
- Udhaar has **no switch.** Lending and borrowing always offer an account,
  because money changing hands with a person is the thing the module is for.

The account on a record is also its **default** — the one its later payments and
its eventual close open on, still changeable per entry.

---

## 8. Adding a module — the checklist

1. `<module>_id` and a nullable `transaction_id`, `ON DELETE SET NULL`.
2. RLS: **four** policies, not one `FOR ALL`. `is_household_member()` for select,
   `is_household_editor()` for insert/update/delete. A viewer must not write.
3. Writes in `lib/<module>-actions.ts`. Never in a component.
4. Create, edit and delete each move the ledger row **with** the record. Cover
   all four cases. Delete the ledger row **first**.
5. Roll back the ledger row if the module row fails to save, or the balance is
   wrong with nothing on any screen to explain why.
6. `LedgerRefChip` when there is a row; `onSync` when there is not.
7. Funds and availability come free from the triggers. Call `checkFunds()` in the
   form anyway, so the user gets a sentence instead of a Postgres error.
8. Decide whether it belongs in `netWorthBreakdown()`. If it holds value the
   accounts do not, it does.
9. Prove isolation with the stranger-vs-owner query in `db/README.md`, through
   the REST API and not only in SQL.
