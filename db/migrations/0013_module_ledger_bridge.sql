-- 0013 — the module ↔ ledger bridge: funds, and the day a debt opened
--
-- Applied to brunpltiektawjtcivwa. See docs/ARCHITECTURE.md §4 and §3.

-- ===========================================================================
-- 1. An account cannot spend money it does not hold.
--
-- The dropdown could not stop this: a lend of Rs 2,00,000 out of an account
-- holding Rs 500 was accepted, and the balance simply went to -Rs 1,99,500 with
-- nothing on any screen calling it wrong. Same class as
-- assert_account_accepts_movement — enforcement belongs in the database, because
-- a disabled <option> stops a click, not a REST call or a statement import.
--
-- The escape hatch is per ACCOUNT, not per transaction: a current account with a
-- running finance facility really can go below zero, a cash box cannot.
-- ===========================================================================

alter table public.accounts
  add column if not exists allow_negative_balance boolean not null default false;

comment on column public.accounts.allow_negative_balance is
  'Overdraft / running finance. When false (the default) no movement may drive balance_paisa below zero.';

-- Accounts that are ALREADY negative are grandfathered in. Flipping the rule on
-- under them would leave two live accounts unable to take any expense at all,
-- which reads as the app breaking rather than as a rule being introduced.
update public.accounts
   set allow_negative_balance = true
 where balance_paisa < 0
   and allow_negative_balance = false;

create or replace function public.assert_account_has_funds()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  acc       record;
  projected bigint;
begin
  -- A row moving to a DIFFERENT account also un-does its effect on the old one.
  -- Dragging an income off an account lowers that account, so the side being
  -- left has to be checked too, not just the side being joined.
  if TG_OP = 'UPDATE' and OLD.account_id is distinct from NEW.account_id then
    select balance_paisa, allow_negative_balance, name into acc
      from public.accounts where id = OLD.account_id;

    if found and not acc.allow_negative_balance then
      projected := acc.balance_paisa - OLD.amount_paisa;
      if projected < 0 then
        raise exception
          '"%" would be left at Rs %, and it is not allowed to go below zero.',
          acc.name, trim(to_char(projected / 100.0, 'FM999999999990.00'))
          using errcode = 'check_violation';
      end if;
    end if;
  end if;

  select balance_paisa, allow_negative_balance, name into acc
    from public.accounts where id = NEW.account_id;

  -- A missing account is assert_account_accepts_movement's complaint, not ours.
  if not found or acc.allow_negative_balance then
    return new;
  end if;

  projected := acc.balance_paisa
             + NEW.amount_paisa
             - case
                 when TG_OP = 'UPDATE'
                  and OLD.account_id is not distinct from NEW.account_id
                 then OLD.amount_paisa
                 else 0
               end;

  if projected < 0 then
    raise exception
      '"%" holds Rs %. This needs Rs % more. Pick another account, record it without one, or allow that account to go below zero in Edit Account.',
      acc.name,
      trim(to_char(acc.balance_paisa / 100.0, 'FM999999999990.00')),
      trim(to_char((-projected) / 100.0, 'FM999999999990.00'))
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC on every new function, so a SECURITY DEFINER
-- helper is callable signed-out the moment it is created. Granting to
-- `authenticated` only ADDS a grant; PUBLIC has to be revoked explicitly.
revoke execute on function public.assert_account_has_funds() from public, anon;

-- Named to sort AFTER assert_account_accepts_movement_trigger: same-timing
-- triggers fire alphabetically, and "this account is deleted" is a better first
-- complaint than "this account is short".
--
-- INSERT and UPDATE only. A delete is how a wrong row gets corrected away, so
-- blocking it would deadlock the fix.
drop trigger if exists assert_account_has_funds_trigger on public.transactions;
create trigger assert_account_has_funds_trigger
  before insert or update of account_id, amount_paisa
  on public.transactions
  for each row execute function public.assert_account_has_funds();

-- ===========================================================================
-- 2. A debt knows when it was opened.
--
-- createDebt already took a date and stamped the opening transfer with it, but
-- the debt row itself only had created_at. A loan recorded today for money lent
-- in June read as "lent 2026-08-21" on its own card, and an edit had no date
-- field to correct because there was no column behind it.
-- ===========================================================================

alter table public.debts
  add column if not exists opened_on date;

update public.debts d
   set opened_on = coalesce(
         (select t.date from public.transactions t where t.id = d.opening_transaction_id),
         d.created_at::date)
 where d.opened_on is null;

alter table public.debts
  alter column opened_on set default current_date,
  alter column opened_on set not null;

comment on column public.debts.opened_on is
  'The day the money actually changed hands. created_at is when the row was typed, which is not the same fact.';

notify pgrst, 'reload schema';
