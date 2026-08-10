-- ============================================================================
-- 0010_security_hardening
-- Applied 2026-08-09 to brunpltiektawjtcivwa via apply_migration.
--
-- Closes three holes found in an audit of the M2-M6 work:
--   1. categories / institutions / merchants had RLS disabled. The publishable
--      key ships in the browser bundle, so anon could read, edit AND DELETE the
--      entire Pakistani catalog.
--   2. `categories` had no household_id, but /settings/categories lets a user
--      create custom categories -- which therefore landed in the GLOBAL catalog
--      and appeared in every other household's list.
--   3. sync_account_balance() was SECURITY DEFINER with a mutable search_path
--      and reachable at /rest/v1/rpc/sync_account_balance by anon.
--      It also corrupted balances when a transaction moved between accounts.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Household-scope custom categories. NULL household_id = system catalog row.
-- ---------------------------------------------------------------------------
alter table public.categories
  add column if not exists household_id uuid
    references public.households(id) on delete cascade;

create index if not exists categories_household_id_idx
  on public.categories(household_id);

-- ---------------------------------------------------------------------------
-- 2. Enable RLS on the three catalog tables and give each explicit policies.
--    Enabling RLS without policies would block ALL access, so both happen here.
-- ---------------------------------------------------------------------------
alter table public.categories   enable row level security;
alter table public.institutions enable row level security;
alter table public.merchants    enable row level security;

-- categories: system rows are readable by every signed-in user; household rows
-- only by that household's members.
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories
  for select to authenticated
  using (household_id is null or public.is_household_member(household_id));

drop policy if exists categories_insert on public.categories;
create policy categories_insert on public.categories
  for insert to authenticated
  with check (
    (household_id is not null and public.is_household_member(household_id))
    or (household_id is null and public.is_platform_admin())
  );

drop policy if exists categories_update on public.categories;
create policy categories_update on public.categories
  for update to authenticated
  using (
    (household_id is not null and public.is_household_member(household_id))
    or public.is_platform_admin()
  )
  with check (
    (household_id is not null and public.is_household_member(household_id))
    or public.is_platform_admin()
  );

drop policy if exists categories_delete on public.categories;
create policy categories_delete on public.categories
  for delete to authenticated
  using (
    (household_id is not null and public.is_household_member(household_id))
    or public.is_platform_admin()
  );

-- institutions + merchants: shared reference data. Everyone signed in reads;
-- only a platform admin writes.
drop policy if exists institutions_select on public.institutions;
create policy institutions_select on public.institutions
  for select to authenticated using (true);

drop policy if exists institutions_write on public.institutions;
create policy institutions_write on public.institutions
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists merchants_select on public.merchants;
create policy merchants_select on public.merchants
  for select to authenticated using (true);

drop policy if exists merchants_write on public.merchants;
create policy merchants_write on public.merchants
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 3. Harden the balance trigger and fix the cross-account UPDATE bug.
--    The old body always applied both legs of an UPDATE to NEW.account_id, so
--    moving a transaction between accounts left BOTH balances wrong.
--    Body is fully schema-qualified, so an empty search_path is safe.
-- ---------------------------------------------------------------------------
create or replace function public.sync_account_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if TG_OP = 'INSERT' then
    update public.accounts
       set balance_paisa = balance_paisa + NEW.amount_paisa, updated_at = now()
     where id = NEW.account_id;

  elsif TG_OP = 'DELETE' then
    update public.accounts
       set balance_paisa = balance_paisa - OLD.amount_paisa, updated_at = now()
     where id = OLD.account_id;

  elsif TG_OP = 'UPDATE' then
    if OLD.account_id is not distinct from NEW.account_id then
      update public.accounts
         set balance_paisa = balance_paisa - OLD.amount_paisa + NEW.amount_paisa,
             updated_at = now()
       where id = NEW.account_id;
    else
      -- Transaction moved accounts: unwind the old, apply to the new.
      update public.accounts
         set balance_paisa = balance_paisa - OLD.amount_paisa, updated_at = now()
       where id = OLD.account_id;
      update public.accounts
         set balance_paisa = balance_paisa + NEW.amount_paisa, updated_at = now()
       where id = NEW.account_id;
    end if;
  end if;
  return null;
end;
$function$;

-- A trigger function must never be callable as a REST RPC. Triggers do not
-- check EXECUTE, so revoking here does not affect the trigger itself.
revoke all on function public.sync_account_balance() from public, anon, authenticated;

notify pgrst, 'reload schema';
