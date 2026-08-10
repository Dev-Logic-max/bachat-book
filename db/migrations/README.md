# Migrations

## Status — 2026-08-09

The gap described below is **closed**. `0004_m2_m6_baseline.sql` is a real
`pg_dump` of the live public schema: 30 tables, 43 policies, 7 functions,
5 triggers, 5 indexes.

Two notes on that file:

- It was dumped with pg_dump **18** against a Postgres **17** server, so it
  opens with a `\restrict` line. That is a psql 18+ meta-command — strip it if
  you replay the file through an older psql.
- It is a *snapshot*, not a hand-authored migration. It supersedes the
  unrecorded `execute_sql` work from the M2–M6 sessions. Replay order is
  `0001 → 0002 → 0003 → 0004(baseline) → 0010`.

Everything from here goes through `apply_migration` and lands in this folder.

## The gap — how it happened (kept for context)

Supabase's migration history contains only:

| Version | Name |
|---|---|
| `20260806115126` | `0001_identity_households_plans` |
| `20260806115248` | `0002_plan_tiers` |
| `20260806120318` | `0003_lock_down_function_execute` |
| *(this folder)* | `0010_security_hardening` |

Everything between — roughly **20 tables**, all the M2–M6 triggers, and every
policy on them — was applied as raw `execute_sql` rather than `apply_migration`.
It is live and working, but it is recorded **nowhere**: not in Supabase's
history, not as files here.

**Consequence:** the database cannot be rebuilt from scratch, code-reviewed,
diffed, or rolled back. A second environment (staging, CI, a new laptop) has no
way to reach the current schema.

## Recovering the missing history

`supabase db pull` reads the live schema and writes a baseline migration. It
will do a far better job than hand-reconstruction:

```powershell
# One-time, from the repo root. Needs the DB password from
# Supabase → Project Settings → Database → Connection string.
supabase link --project-ref brunpltiektawjtcivwa
supabase db pull --schema public
```

Name the result `0004_m2_m6_baseline.sql` and drop it in this folder. After
that, **every** schema change goes through `apply_migration` (or a file here),
never `execute_sql`.

## Rules

- DDL uses `apply_migration`. `execute_sql` is for reads and one-off data fixes only.
- After any migration: `notify pgrst, 'reload schema';` or every REST endpoint
  returns a bodyless 404 while the tables, grants and policies are all fine.
- Regenerate `web/src/lib/supabase/types.ts` after every migration.
- Re-run the isolation proof in `../README.md` before closing a module.
