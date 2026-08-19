# Database

**Project** `Bachat Book` · ref `brunpltiektawjtcivwa` · region `ap-south-1`
**URL** https://brunpltiektawjtcivwa.supabase.co

Migrations are applied to and versioned **in Supabase**, which is the source of
truth. To pull them into this folder as files:

```bash
supabase link --project-ref brunpltiektawjtcivwa
supabase db pull
```

Hand-copying SQL here instead would drift from what is actually applied.

---

## Applied so far

| Migration | Contents |
|---|---|
| `0001_identity_households_plans` | enums, `profiles`, `user_roles`, `households`, `household_members`, `plans`, `subscriptions`, `preferences`, RLS helpers, `handle_new_user` trigger, all RLS policies |
| `0002_plan_tiers` | Free (`Bachat`) and Pro (`Bachat Pro`) rows with `limits` as JSON |
| `0003_lock_down_function_execute` | Revoked REST-RPC access to trigger functions and `anon` access to the RLS helpers |
| `single_ledger_retire_quick_entries` | **Dropped `quick_entries`** and its three sync triggers. Added `transactions.created_by`, `transactions.is_opening`, `transactions_amount_sign_check`. Dropped `accounts.allow_entry_link`. |
| `account_lock_and_soft_delete` | Added `accounts.is_locked` (+ `accounts_cash_never_locked`), `accounts.deleted_at`, and `assert_account_accepts_movement` on `transactions` |
| `plan_pricing_and_workspace_limits` | Fixed the 1000× price error (Pro was stored as Rs 900,000/mo). Added `workspaces` to `plans.limits`; free 2/2, pro 5/10 |
| `subscriptions_move_to_user` | **`subscriptions.household_id` → `user_id`**, one row per person, unique. Best plan survived the collapse |
| `plan_quota_helpers` | `user_plan_limits`, `user_workspace_limit`, `user_member_limit`, `workspace_is_active`, and the `assert_workspace_quota` / `assert_member_quota` triggers |
| `read_only_workspace_policies` | Split the single `FOR ALL` policy on 12 tenant tables into select + insert/update/delete, gating only the writes |
| `workspace_effective_plan` | `household_plan_limits`, `household_plan_code`, and the `workspace_access` view (`security_invoker`) |
| `revoke_plan_helpers_from_anon` | Removed the default `PUBLIC` execute grant the new helpers were created with |
| `m5_investments_and_wealth_ledger_sync` | `investments`, `investment_valuations`, `investment_payouts`, `household_integrations`. `sync_investment_current_value` trigger. Four policies each |
| `enforce_tenant_scoped_foreign_keys` | **Security fix.** Replaced 14 single-column FKs with composite `(fk, household_id)` keys. See "A foreign key is part of the tenant boundary" below |
| `index_tenant_scoped_foreign_keys` | Child-side indexes for those 14 composite keys, so a parent delete is not a sequential scan |
| `wealth_tables_respect_read_only_workspaces` | The four Wealth tables were missing `workspace_is_active` on their write policies, so a read-only workspace could still write through the API |

Modules M2 onward write their own migrations when they start. Do not write
schema for a module before building it.

---

## One ledger

`transactions` is the only store of money movement. There is no second table for
"quick entries" — there was, and every gap between the two copies was a bug:
changing an entry's account was a silent no-op, and unlinking left the
transaction behind so the account stayed debited with nothing explaining it.

Entries and Transactions are two **filtered views** of the same rows:

| Screen | Filter |
|---|---|
| Entries | `type in ('income','expense') and not is_opening` — every account, cash included |
| Transactions | `type = 'transfer'` **or** the account is `checking` / `savings` / `wallet` |
| Accounts | the balances those rows sum to |

- `amount_paisa` is **signed**; `transactions_amount_sign_check` ties the sign to
  `type` (transfers exempt — their two legs carry opposite signs). Read the sign
  when rendering, never `type`.
- `is_opening` marks a balance an account STARTED with. Excluded from every
  "money in" figure, or the opening position counts as income. New accounts start
  at zero and are funded by a visible income entry, so nothing writes this now.
- A **transfer is two rows** pointing at each other through
  `linked_transaction_id`. Delete them as a pair; one leg alone creates money.
- `sync_account_balance_trigger` derives `accounts.balance_paisa`. Never write a
  balance by hand — the next movement silently undoes it.

## Account state

| Column | Meaning |
|---|---|
| `is_archived` | Deactivated. Reversible, hidden from pickers, excluded from the held total, records intact. |
| `deleted_at` | Soft-deleted. Permanent. Never a real `DELETE` — removing the rows would rewrite closed months. Past transactions survive and render a "Deleted account" tag. |
| `is_locked` | Savings you may pay into but never spend from. Never valid for `cash`, which is the fallback every entry lands on. |

`assert_account_accepts_movement` enforces all three in the database. A disabled
dropdown option stops a click, not a statement import or a REST call.

---

## Conventions

- **Money is `bigint` paisa.** Never float, never `numeric`. Rupees exist only at formatting time.
- `id uuid primary key default gen_random_uuid()`, `created_at` / `updated_at` `timestamptz default now()`.
- snake_case, plural tables, `<table>_<col>_idx`, `<table>_<cols>_unique`.
- Every tenant table carries `household_id` and has RLS **enabled with explicit policies**.
- **Platform roles** (`user_roles`) and **household roles** (`household_members`) stay in separate tables. Collapsing them lets a household owner inherit platform admin rights.

### RLS helpers

`is_household_member()`, `is_household_owner()`, `is_platform_admin()` and
`has_role()` are `SECURITY DEFINER`. That is required, not stylistic: a policy on
`household_members` that queries `household_members` directly recurses forever.

They must stay executable by `authenticated` — a policy expression is evaluated
as the querying role, so revoking that breaks every policy that calls them.

### Plans and read-only workspaces

A plan belongs to a **person**: `subscriptions` is keyed by `user_id`, one row
each. A workspace's entitlements are its **owner's** — resolve them with
`household_plan_code()` / `household_plan_limits()`, never from whoever is
looking, or a free member inside a Pro workspace sees different numbers from the
owner on the same screen.

Which workspaces are live is **derived, never stored**:

> Rank an owner's workspaces oldest-first. The first N are writable, where N is
> their plan's `workspaces` limit. The rest are read-only.

The personal workspace created at sign-up is always the oldest, so it is
structurally always writable — there is no "protected" flag to set and no way for
a downgrade to strand someone outside their own default workspace. A lapsed
subscription (`past_due` / `canceled`) falls through to the free limits inside
`user_plan_limits`, so the downgrade needs no separate job.

Read-only is a **write** restriction only. Reads stay open: the ledger is the
user's own financial history, and hiding it reads as data loss. That is why the
12 tenant tables each carry four policies instead of one `FOR ALL` — `FOR ALL`
cannot express "select is looser than the rest".

---

## Seed account

| | |
|---|---|
| Name | Abdul Rehman |
| Email | `admin@bachatbook.com` |
| Password | `SEED_ADMIN_PASSWORD` in `web/.env.local` (gitignored) |
| Platform roles | `user`, `super_admin` |
| Household | Rehman Family (`owner`), Karachi |
| Plan | Pro |

Verified working against the real endpoint — `POST /auth/v1/token?grant_type=password`
returns a token, and that token reads exactly its own household's rows.

**Rotate before any public deploy.**

Inserting an auth user by hand needs both an `auth.users` row **and** a matching
`auth.identities` row (with `provider_id` set) — GoTrue rejects email sign-in
without the identity, and the failure is silent. The seed is idempotent: it
deletes any prior seed identity first, households before users because
`households.owner_id` is `ON DELETE RESTRICT`.

---

## Verifying isolation

Run this after any schema change. It must show the stranger seeing zero rows.

**The SQL test is not sufficient on its own.** It runs as `postgres` with
`set role`; PostgREST is what the app actually talks to, and grants can differ
there. Sign in for real and compare. Last run, with the owner temporarily
downgraded to free so their third workspace fell out of the allowance:

| Check | Result |
|---|---|
| anon → `transactions` | `401` permission denied |
| anon → `workspace_access` | `401` permission denied |
| signed in → `workspace_access` | `200`, rank 3 returns `is_active: false` |
| read-only workspace, SELECT | `200`, rows still visible |
| read-only workspace, INSERT | `403` RLS violation |
| active workspace, INSERT | `201` created |
| third workspace on free, INSERT | `400` "Your plan allows 2 workspace(s)." |

That last pair is the one worth re-running: a false positive on the active
workspace locks a paying user out of their own ledger, which is worse than a
missed block.

```sql
create temp table rls_check(who text, households int, members int, subscriptions int);
grant insert on rls_check to authenticated;

do $$
declare v_owner uuid; v_stranger uuid := gen_random_uuid();
begin
  select id into v_owner from public.profiles where email = 'abdulrehman@bachatbook.pk';
  set local role authenticated;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner::text, 'role', 'authenticated')::text, true);
  insert into rls_check select 'owner',
    (select count(*) from public.households),
    (select count(*) from public.household_members),
    (select count(*) from public.subscriptions);

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_stranger::text, 'role', 'authenticated')::text, true);
  insert into rls_check select 'stranger',
    (select count(*) from public.households),
    (select count(*) from public.household_members),
    (select count(*) from public.subscriptions);

  reset role;
end $$;

select * from rls_check order by who;
```

Last run: owner `1/1/1`, stranger `0/0/0`. ✅

Also verified through the **real REST API**, which is the check that actually
matters — the in-database test can pass while the API is still broken:

| table | signed in | anon |
|---|---|---|
| households / household_members / subscriptions / profiles | 1 | **0** |
| user_roles | 2 (`user` + `super_admin`) | **0** |
| plans | 2 | **0** |

---

## Traps

**A foreign key is part of the tenant boundary, and RLS does not check it.**

Every tenant policy here tests `household_id` on the row being written and
nothing else. So a row carrying YOUR household_id could name a foreign key
belonging to SOMEONE ELSE'S household, and every policy passed. Signed in as a
real user of another household:

```sql
insert into transactions (household_id, account_id, amount_paisa, type, date)
values (my_household, their_account, -100000, 'expense', current_date);
-- accepted. sync_account_balance is SECURITY DEFINER, so it took Rs 1,000
-- off a stranger's balance: 505000 -> 405000.
```

The attacker could not **read** that account — `select` returned zero rows — but
could **write** to it, which is worse, because it is invisible from both sides.
The same shape let an `investment_valuations` row rewrite another household's
holding from Rs 10,00,000 to Rs 0.01 through the value trigger.

The fix is declarative, not another trigger: the foreign key itself carries the
tenant, so a stranger's row cannot satisfy it and no policy, ordering or future
code path can bypass it.

```sql
alter table accounts add constraint accounts_id_household_key unique (id, household_id);

alter table transactions add constraint transactions_account_id_fkey
  foreign key (account_id, household_id)
  references accounts (id, household_id) on delete cascade;
```

Two things to know when doing this again:

- `household_id` is NOT NULL, so a plain `ON DELETE SET NULL` fails — it would
  try to blank it too. Use the **column-list** form, `ON DELETE SET NULL
  (transfer_account_id)`, which needs PG 15+ (we are on 17.6).
- Index the child side. Without it, deleting one account sequentially scans
  every transaction the household owns.

`categories` and `merchants` are deliberately excluded: their platform rows are
shared across every household by design, and a composite key would break exactly
the sharing they exist for. Tables with no `household_id` of their own
(`transaction_splits`, `task_checklist_items`, `event_budget_*`) inherit tenancy
from their parent through an `EXISTS` in their own policies, so they were never
exposed.

Re-run after any migration that adds a foreign key between two tenant tables:

```sql
select c.conrelid::regclass as child, a.attname, c.confrelid::regclass as parent
from pg_constraint c
join unnest(c.conkey) with ordinality k(attnum, ord) on true
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
where c.contype = 'f' and array_length(c.conkey, 1) = 1
  and c.confrelid::regclass::text in ('accounts','transactions','investments','tasks');
```

**After any migration, PostgREST needs its schema cache reloaded** or every
endpoint returns a bodyless `404` even though the tables, grants and policies are
all correct:

```sql
notify pgrst, 'reload schema';
```

It takes a few seconds to propagate — do not conclude it failed on the first retry.

**Two PowerShell traps cost real time while verifying this.** Both produce
convincing wrong answers:

- `"$base/rest/v1/$t?select=*"` — `$t?` mis-parses. Use `$($t)`.
- `@($null).Count` is **1**, not 0, so an empty `[]` response counts as one row. Compare the body to `"[]"` instead.

---

## Outstanding

- **Leaked-password protection.** Dashboard → Authentication → Policies. There is no Management API tool for it, so it has to be toggled by hand. Checks new passwords against HaveIBeenPwned.
- **Redirect URLs.** Dashboard → Authentication → URL Configuration must list `http://localhost:3100/**` before email confirmation or OAuth callbacks will work.
