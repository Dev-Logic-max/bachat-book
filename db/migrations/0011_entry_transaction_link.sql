-- 0011_entry_transaction_link.sql
--
-- Bridges public.quick_entries (the fast daily log) to public.transactions (the
-- bank/wallet ledger) with an OPTIONAL one-to-one link, and keeps linked pairs in
-- lockstep on edit.
--
-- Decided model (owner, 2026-08-10):
--   * Both tables stay. Neither is retired.
--   * An entry is INDEPENDENT by default; linking is opt-in per entry.
--   * While linked, amount / date / category / note stay in sync both ways.
--   * Unlinking is the only way to break sync.
--   * An account can opt out of linking entirely (accounts.allow_entry_link).
--   * DELETE is deliberately NOT cascaded here. The confirmation modal decides
--     whether the partner row dies too; the FK below is the safety net that keeps
--     a surviving row valid and simply unlinked.
--
-- Sign conventions differ between the two tables and this is the single most
-- likely place to introduce a silent money bug:
--   transactions.amount_paisa is SIGNED   (income > 0, expense < 0)
--   quick_entries.amount_paisa is UNSIGNED plus a `type` of income|expense
-- Both directions convert explicitly below.

begin;

-- ---------------------------------------------------------------------------
-- 1. The bridge
-- ---------------------------------------------------------------------------
-- NOTE: transactions.linked_transaction_id already exists and is a SELF
-- reference used to pair the two halves of a transfer. This is a different
-- column on a different table. Do not conflate them.

alter table public.quick_entries
  add column if not exists linked_transaction_id uuid
    references public.transactions(id) on delete set null;

-- One entry per transaction, at most. Partial so the many nulls stay legal.
create unique index if not exists quick_entries_linked_transaction_id_key
  on public.quick_entries (linked_transaction_id)
  where linked_transaction_id is not null;

create index if not exists quick_entries_household_id_idx
  on public.quick_entries (household_id, entry_date desc);

-- ---------------------------------------------------------------------------
-- 2. Per-account opt-out
-- ---------------------------------------------------------------------------
-- Blocks LINKING only. The account still counts toward net worth — the flag
-- governs whether entries may attach to it, not whether the money is yours.

alter table public.accounts
  add column if not exists allow_entry_link boolean not null default true;

-- ---------------------------------------------------------------------------
-- 3. Categories: give quick_entries a real FK
-- ---------------------------------------------------------------------------
-- quick_entries.category is free text ('kiryana'), transactions.category_id is a
-- text FK to categories.id. Sync cannot cross that, so add the FK column and
-- backfill whatever already matches.

alter table public.quick_entries
  add column if not exists category_id text
    references public.categories(id) on delete set null;

update public.quick_entries qe
   set category_id = c.id
  from public.categories c
 where c.id = qe.category
   and qe.category_id is null;

-- The Add Entry modal shipped a hardcoded list whose ids mostly do not exist in
-- categories. Map the legacy values onto the real rows so old entries keep a
-- category instead of silently losing one.
update public.quick_entries
   set category_id = case category
                       when 'dining'    then 'restaurant'
                       when 'fuel'      then 'petrol'
                       when 'utilities' then 'home'
                       when 'general'   then 'shopping'
                     end
 where category_id is null
   and category in ('dining', 'fuel', 'utilities', 'general');

-- quick_entries.category stays as a display fallback for anything unmapped.
-- Do NOT drop it in this migration.

-- ---------------------------------------------------------------------------
-- 4. Richer ledger fields
-- ---------------------------------------------------------------------------
-- `note` already serves as "purpose" — deliberately not adding a second
-- free-text field beside it.

alter table public.transactions
  add column if not exists reference_no    text,
  add column if not exists payment_method  text,
  add column if not exists attachment_path text;

alter table public.transactions
  drop constraint if exists transactions_payment_method_check;
alter table public.transactions
  add constraint transactions_payment_method_check
  check (payment_method is null or payment_method in
    ('cash', 'debit_card', 'credit_card', 'bank_transfer', 'raast',
     'cheque', 'mobile_wallet', 'other'));

-- ---------------------------------------------------------------------------
-- 5. Link integrity guard
-- ---------------------------------------------------------------------------
-- A UI-only rule gets bypassed by the next feature that writes a link, so the
-- three conditions are enforced here as well as in the picker.

create or replace function public.assert_entry_link_valid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tx_household   uuid;
  tx_type        text;
  tx_account     uuid;
  account_allows boolean;
begin
  if new.linked_transaction_id is null then
    return new;
  end if;

  select t.household_id, t.type, t.account_id, a.allow_entry_link
    into tx_household, tx_type, tx_account, account_allows
    from public.transactions t
    join public.accounts a on a.id = t.account_id
   where t.id = new.linked_transaction_id;

  if tx_household is null then
    raise exception 'linked_transaction_id % does not exist',
      new.linked_transaction_id;
  end if;

  if tx_household <> new.household_id then
    raise exception 'cannot link an entry to a transaction in another household';
  end if;

  -- quick_entries.type only permits income|expense, so a transfer would break
  -- the check constraint the first time sync ran.
  if tx_type = 'transfer' then
    raise exception 'cannot link an entry to a transfer transaction';
  end if;

  if not account_allows then
    raise exception
      'account % has entry linking disabled (accounts.allow_entry_link = false)',
      tx_account;
  end if;

  return new;
end;
$$;

drop trigger if exists assert_entry_link_valid_trigger on public.quick_entries;
create trigger assert_entry_link_valid_trigger
  before insert or update of linked_transaction_id, household_id
  on public.quick_entries
  for each row
  execute function public.assert_entry_link_valid();

-- ---------------------------------------------------------------------------
-- 6. Bidirectional edit sync
-- ---------------------------------------------------------------------------
-- THE TRAP: two triggers that update each other recurse forever. Both are
-- guarded so each fires only for statements issued from outside the database,
-- never for the partner trigger's write.
--
-- The guard is `pg_trigger_depth() = 0`, NOT 1. A WHEN clause is evaluated
-- BEFORE the trigger function is entered, so for a top-level statement the depth
-- is still 0; it reads 1 only once you are inside the function body. Guarding on
-- 1 silently disables the trigger entirely — it never fires for anything, and
-- nothing errors. Verified empirically against this database, not assumed.
--
-- sync_account_balance_trigger on transactions has NO depth guard, which is
-- correct and required: when the entry side changes a transaction amount, the
-- account balance must still re-settle. Verified in §0.5 proof step 2.

create or replace function public.sync_entry_to_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.linked_transaction_id is null then
    return null;
  end if;

  update public.transactions
     set amount_paisa = case
                          when new.type = 'income' then  abs(new.amount_paisa)
                          else                          -abs(new.amount_paisa)
                        end,
         type         = new.type,
         date         = new.entry_date,
         category_id  = new.category_id,
         note         = new.note,
         updated_at   = now()
   where id = new.linked_transaction_id;

  return null;
end;
$$;

create or replace function public.sync_transaction_to_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A transfer can never be linked (guarded above), so no conversion needed.
  if new.type = 'transfer' then
    return null;
  end if;

  update public.quick_entries
     set amount_paisa = abs(new.amount_paisa),
         type         = case when new.amount_paisa >= 0 then 'income'
                                                        else 'expense' end,
         entry_date   = new.date,
         category_id  = new.category_id,
         -- category is NOT NULL; keep the old value when the transaction has no
         -- category rather than violating the constraint.
         category     = coalesce(new.category_id, category),
         note         = new.note
   where linked_transaction_id = new.id;

  return null;
end;
$$;

drop trigger if exists sync_entry_to_transaction_trigger on public.quick_entries;
create trigger sync_entry_to_transaction_trigger
  after update on public.quick_entries
  for each row
  when (pg_trigger_depth() = 0)
  execute function public.sync_entry_to_transaction();

drop trigger if exists sync_transaction_to_entry_trigger on public.transactions;
create trigger sync_transaction_to_entry_trigger
  after update on public.transactions
  for each row
  when (pg_trigger_depth() = 0)
  execute function public.sync_transaction_to_entry();

-- ---------------------------------------------------------------------------
-- 7. Lock the functions down
-- ---------------------------------------------------------------------------
-- Supabase exposes every public function as a REST RPC. These three are trigger
-- and guard internals: reachable at /rest/v1/rpc/<name> unless revoked.

revoke all on function public.assert_entry_link_valid()    from public, anon, authenticated;
revoke all on function public.sync_entry_to_transaction()   from public, anon, authenticated;
revoke all on function public.sync_transaction_to_entry()   from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. One-time data cleanup
-- ---------------------------------------------------------------------------
-- add-account-modal.tsx force-tagged every positive opening balance with
-- category_id 'salary' — the category whose NAME is "Monthly Salary" — which is
-- why every new account's ledger showed a salary badge on its opening row.
-- (Negative opening balances used 'general', which is not a real category id, so
-- that insert silently failed the FK and no row was ever created.)

update public.transactions
   set category_id = null,
       note        = 'Opening balance'
 where note = 'Initial Balance';

commit;

-- Without this every REST endpoint returns a bodyless 404 while the schema,
-- grants and policies are all fine. Give it a few seconds to propagate.
notify pgrst, 'reload schema';
