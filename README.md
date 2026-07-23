# Fuel Tracker

Track fuel delivered to storage locations and fuel dispensed into vessels — with running stock per location and usage graphs per vessel.

## Stack

Next.js 16 (App Router) + Supabase (Postgres, Auth) + Tailwind CSS 4 + Recharts.

## Data model

- **vessels** — boats you fuel.
- **locations** — fuel storage points (depots, tanks, jetties).
- **deliveries** — fuel arriving at a location (increases its stock).
- **fuel_entries** — fuel dispensed from a location into a vessel (decreases that location's stock, and is the vessel's usage record).

Two views do the math: `location_stock` (delivered − dispensed per location) and `vessel_usage` (total dispensed per vessel).

All authenticated users share full read/write access — this is built for a small team, not multi-tenant.

## Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com/dashboard).
2. **Run the migrations**: open the SQL Editor in your Supabase project and run, in order, [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) then [`supabase/migrations/0002_low_stock.sql`](supabase/migrations/0002_low_stock.sql).
3. **Copy env vars**: in your Supabase project, go to Settings → API, then:
   ```
   cp .env.local.example .env.local
   ```
   and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. **Make sure email signups are enabled**: in Supabase, go to Authentication → Sign In / Providers → Email, and confirm "Allow new users to sign up" is ON — anyone with the app's URL can create their own account with an email + password (there's no invite step). If you want to restrict who can join, turn this off and create accounts yourself instead (Authentication → Users → Add user).
5. **Install and run**:
   ```
   npm install
   npm run dev
   ```
   Open http://localhost:3000.

## Auth

Email + password, via Supabase Auth — sign up on the home page, or log in if you already have an account. Password resets go through Supabase's standard "Forgot password?" email flow (`/auth/reset-password`). Signing out and changing your password both live under `/settings`.

## Pages

- `/dashboard` — total stock, a fleet-wide stock/usage line chart (total stock plus one line per vessel), a date-range filter on the chart, stock per location (color-coded by low-stock threshold), a date-filterable recent activity feed, and a quick "+ Log fuel" action.
- `/vessels` — list + add vessels; each vessel page shows a date-filterable usage-by-month chart and its fuel log, with a form to log a fill.
- `/locations` — list + add locations with current stock; each location page shows a date-filterable running stock chart, a low-stock alert threshold setting, and its delivery/dispense log, with a form to log a delivery.
- `/settings` — change your password, sign out.

## Low stock alerts

Each location can have an optional low-stock threshold (set on its detail page, under "Low stock alert"). Anywhere stock is shown, it's colored: green when healthy, amber at or below the threshold, red if it's gone negative. Leave the threshold blank to disable the alert for that location.

## Notes

- Quantities are treated as litres throughout the UI; the database itself is unit-agnostic (`numeric`), so switch the "L" labels if you track a different unit.
- `deliveries` and `fuel_entries` both allow negative-stock states (the app just flags them in red) rather than blocking the insert — assumed to be simpler for correcting real-world timing/paperwork lag than a hard DB constraint.
