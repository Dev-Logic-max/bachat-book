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

Modules M2 onward write their own migrations when they start. Do not write
schema for a module before building it.

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
