# FleetWash OS — Production v1.3

Next.js 14 (App Router, server actions) + Supabase (Postgres, Auth, RLS, Storage).

## Deploy runbook (~30 minutes)
1. **Supabase**: create project → SQL Editor → paste `supabase/schema.sql` → Run.
2. **Storage**: create private bucket `wash-photos`.
3. **Auth**: Authentication → URL Configuration → set Site URL to your Vercel domain; enable Email provider (magic links are on by default).
4. **Local**: `cp .env.example .env.local`, fill `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API) and `NEXT_PUBLIC_SITE_URL`.
5. `npm install && npm run build` (should pass clean) then `npm run dev`.
6. **First run**: visit /login → magic link → /onboarding creates your company + owner profile.
7. **Vercel**: push to GitHub → import repo → add the same env vars → deploy. Update Supabase Site URL + redirect URLs to the production domain.
8. **Crew**: Settings → create invite link → text it to each worker.

## What's wired
- Magic-link auth, invite links (`redeem_invite` security-definer), owner/worker roles, middleware gating `/office`
- Multi-tenant RLS on every table; attribution enforced at the DB (`checked_by = auth.uid()` etc.)
- Field: today's jobs + auto load-out (baseline + client chems), job detail with attributed unit checkoffs, out-on-road + damage flags, location intel, per-place navigation, GPS-stamped individual clock, team notes
- Office: dashboard, availability-aware scheduling (14-day strip, tap-to-assign only available workers, time-off respected), clients (location card, chem toggles, unit roster), one-click invoice generation from checked-off units via `resolve_rate` (override → base), employee pay rates + invites, asset types & base rates

## v1.1 backlog (demo has these; port next)
Recurring job materializer (cron or on-read), live map (positions table is ready — add Supabase Realtime subscription + Mapbox), wash photo upload to the `wash-photos` bucket, printable invoice PDF, payroll engine + CSV export (drop in `fwos-features-1-3/payrollEngine.ts`), P&L dashboard, acid-safety gate, client rate override UI, spreadsheet importer UI.
