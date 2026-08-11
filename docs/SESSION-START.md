# Starting the implementation session

Open the session **inside `finance-tracker/Bachat Book/`** so `CLAUDE.md` loads
automatically. Then paste the prompt below.

---

## Already done — do not redo

The database is **live, seeded and verified end to end**. See `db/README.md`.

- Supabase project `Bachat Book` · ref `brunpltiektawjtcivwa` · `ap-south-1`
- M1 schema applied: profiles, user_roles, households, household_members, plans, subscriptions, preferences — with RLS policies and helper functions
- Free and Pro plan rows loaded
- **Sign-in works against the real endpoint**: `$SEED_ADMIN_EMAIL` / `$SEED_ADMIN_PASSWORD` (both in `web/.env.local`, gitignored) returns a token, and that token reads exactly its own household
- Isolation verified through the REST API: anon sees **0 rows** on every tenant table
- Trigger functions revoked from the REST RPC surface
- `web/.env.local` and `.env.example` written; `@supabase/ssr` installed; clients at `web/src/lib/supabase/`

**M1's back end is finished. The session starts at M1's screens.**

Two things still need doing by hand in the Supabase dashboard (no API for either):
1. **Authentication → Policies** → enable leaked-password protection
2. **Authentication → URL Configuration** → add `http://localhost:3100/**` to Redirect URLs, or email confirmation and OAuth callbacks will fail

---

## The prompt

```
Read CLAUDE.md, then docs/ROADMAP.md and db/README.md.

Bachat Book — a premium Pakistani personal-finance app with a calendar and task
manager built in. The Supabase database is already live, seeded and verified:
M1 schema is complete and admin@bachatbook.com / <redacted> signs in for
real as super_admin. The web app in web/ has one screen built on mock fixtures
(/lab/overview) which stays on fixtures for now.

Build the M1 screens against the real database, one at a time:
  1. Sign in / sign up / forgot password
  2. Onboarding — household setup, base currency, city, occupation
  3. App shell with real session + household switcher
  4. Household members + invites
  5. Plan picker — Free vs Pro, reading limits from plans.limits, not hardcoded
  6. Settings — profile, preferences, filer status, language

Rules:
- Read the design tokens and the whole Traps list in CLAUDE.md before writing
  any component. Every trap in that list cost a full round to find.
- Auth must be real: protected routes, session refresh in proxy.ts, redirect on
  expiry, server-side session checks. No mock auth, no bypasses, no TODOs left
  in the flow.
- One layout in every locale. Urdu changes text direction only, via <T>.
- Screenshot every screen and compare before calling it done: light, dark,
  Urdu, mobile. Show me each screen before moving to the next.
- pnpm typecheck && pnpm lint clean before the module closes.
- After any migration: regenerate web/src/lib/supabase/types.ts AND run
  notify pgrst, 'reload schema'; or the REST API 404s.

Ask me before deciding anything with more than one reasonable answer — give me
options rather than picking silently.
```

---

## What the session should produce, in order

| Step | Output | Verify by |
|---|---|---|
| 1 | Auth screens wired to Supabase | Sign in as Abdul Rehman lands on the dashboard |
| 2 | Onboarding flow | A brand-new signup gets its own household |
| 3 | Members + invites | Second user joins; RLS still isolates other households |
| 4 | Plan picker | Limits read from `plans.limits`, not hardcoded |
| 5 | Settings | Preferences persist across reload |
| 6 | Module close | Screenshots in light, dark, Urdu, mobile; typecheck + lint clean |

---

## Running the app

```powershell
cd "c:\Users\HP\Desktop\My Projects\finance-tracker\Bachat Book\web"
pnpm dev
```
Open **http://localhost:3100/en/lab/overview**. Urdu: swap `/en/` for `/ur/`.

Screenshots — **PowerShell, not Git Bash** (Bash mangles the leading `/`):
```powershell
cd "c:\Users\HP\Desktop\My Projects\design-brain"
$env:LAB_URL="http://localhost:3100"
pnpm shot /en/lab/overview --name overview --viewport both
pnpm shot /en/lab/overview --name overview --viewport desktop --dark
```

---

## Session hygiene

- **One module per session** where possible. M1 and M2 are each a full session.
- **Screenshot every screen** before calling it done — light, dark, Urdu, mobile.
- `pnpm typecheck && pnpm lint` must be clean before a module closes.
- When a session ends mid-module, note where it stopped at the bottom of `ROADMAP.md`.
- Design lessons that cost a round go in `CLAUDE.md` §Traps, not into a new document.
