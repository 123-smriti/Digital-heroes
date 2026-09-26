# Digital Heroes

Golf performance tracking + monthly charity draws, built to the Digital Heroes
PRD (Level 1) for the trainee selection process.

**Stack:** React 18 + Vite + React Router, ESLint (flat config), Supabase
(Postgres + Auth + Storage), Recharts for admin reporting.

## 1. Set up Supabase

1. Create a **new** Supabase project (per the PRD's deployment constraints —
   don't reuse a personal one).
2. Open the SQL editor and run `supabase/schema.sql` in full. It creates every
   table, the rolling-5-scores trigger, row-level security policies, the
   `winner-proofs` storage bucket, and seeds three sample charities.
3. In Project Settings → API, copy the **Project URL** and **anon public key**.

## 2. Configure the app

```bash
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

## 3. (Optional) Seed demo data

To see the admin dashboard, reports chart, and draw simulation with real
numbers instead of empty tables:

1. In Supabase → Project Settings → API, copy the **service_role** secret key
   and add it to `.env` as `SUPABASE_SERVICE_ROLE_KEY` (see `.env.example` —
   this key is server-only, never exposed to the browser).
2. Run:
   ```bash
   npm run seed
   ```
   This creates 8 demo subscribers (password `DemoPass123!` for all of
   them), each with an active subscription, a charity pick, 5 scores, and an
   entry in a draft draw for the current month. Safe to re-run — it upserts
   rather than duplicating.

   **Don't want to use the service-role key?** `supabase/seed-manual.sql` is
   a dashboard-only alternative — create fake users by hand under
   Authentication → Users, then paste their UUIDs into that file and run it
   in the SQL editor. No script, no extra key.

   Creating more than a couple of users that way gets repetitive — once
   you've created them all in the dashboard, `supabase/seed-manual-batch.sql`
   does the profiles/subscriptions/scores/draw-entries step for all of them
   in a single run (fill in the UUID/name/email arrays at the top).
3. Log into the admin panel and go to **Draws → Simulate** on that draft draw
   to see the prize-pool split and winners play out.

## 4. Make yourself an admin

Sign up through the app once, then in the Supabase SQL editor:

```sql
update profiles set role = 'admin' where email = 'you@example.com';
```

Reload the app — you'll see an **Admin** link in the nav instead of Dashboard.

## 5. Set up Stripe (subscription payments)

Subscribing goes through real Stripe Checkout — no card details ever touch
our own code. Two Vercel serverless functions handle it: `api/create-checkout-session.js`
starts the checkout, and `api/stripe-webhook.js` is the *only* place a
subscription actually becomes `active` in the database (never trust the
client for that — Stripe confirms payment first).

1. Create a free [Stripe](https://dashboard.stripe.com/register) account
   (test mode is fine — no real charges needed for the assignment).
2. Developers → API keys → copy the **Secret key** (starts `sk_test_...`).
3. You'll need three more env vars beyond the Supabase ones. Locally, add
   them to `.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...       # see step 5 below
   SUPABASE_SERVICE_ROLE_KEY=...          # Project Settings → API → service_role
   ```
   (`SUPABASE_SERVICE_ROLE_KEY` is what lets the webhook write the
   subscription row past RLS — same key used by `scripts/seed.js`.)
4. Deploy once to Vercel first (step 6) so you have a live URL — the webhook
   needs somewhere real to point at (`localhost` won't work for Stripe's
   servers to reach).
5. Back in Stripe: Developers → Webhooks → **Add endpoint**
   - URL: `https://YOUR-DEPLOYED-SITE/api/stripe-webhook`
   - Events to send: `checkout.session.completed`, `customer.subscription.deleted`,
     `invoice.payment_failed`
   - After creating it, click into the endpoint → reveal the **Signing secret**
     — that's your `STRIPE_WEBHOOK_SECRET`.
6. Add all three variables (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `SUPABASE_SERVICE_ROLE_KEY`) to the Vercel project too — Settings →
   Environment Variables — then redeploy so the functions pick them up.

**Testing it:** use Stripe's test card `4242 4242 4242 4242`, any future
expiry, any CVC. Subscribe in the app → redirected to Stripe Checkout → pay
with the test card → redirected back → your subscription should show
`active` within a few seconds (that's the webhook firing).

Cancelling from the dashboard also calls Stripe directly
(`api/cancel-subscription.js`), so it actually ends the billing subscription,
not just a local flag.

## 6. Deploy

- **Vercel:** new project (per PRD constraints, not your personal account),
  import this repo, set the env vars below, deploy. Build command
  `npm run build`, output dir `dist`. The `api/` folder deploys automatically
  as serverless functions — no extra config needed.
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (steps 1–2)
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (step 5)
- **Supabase:** already live from step 1 — no separate deploy needed.

## What's implemented against the PRD

| PRD section | Status |
|---|---|
| §04 Subscription & payment | Plan selection, charity %, subscription record + full lifecycle (active/cancelled/lapsed) wired to Supabase. **Stripe Checkout is live** — `api/create-checkout-session.js` starts payment, `api/stripe-webhook.js` confirms it and writes the subscription, `api/cancel-subscription.js` cancels the real billing subscription. See "Set up Stripe" below. |
| §05 Score management | Full rolling-5 logic, enforced both client-side and by a DB trigger so it holds even if someone calls the API directly. One entry per date, edit/delete, reverse-chronological display. |
| §06/§07 Draw & prize pool | `src/lib/draws.js` — random draw, an algorithmic mode weighted by score frequency, 40/35/25 pool split with jackpot rollover, admin simulate-then-publish flow. |
| §08 Charity system | Directory with search, profile pages, homepage spotlight, 10% minimum contribution slider. |
| §09 Winner verification | Screenshot upload (Supabase Storage) from the user dashboard, admin approve/reject + pending→paid payout tracking. |
| §10 User dashboard | Subscription status, score entry, charity + contribution, participation summary, winnings overview — one page, tabbed. |
| §11 Admin dashboard | Users (role + subscription status), draws (create/simulate/publish), charities (CRUD), winners (verify/payout), reports (headline stats + prize-pool chart). |
| §12 UI/UX | Custom dark navy / forest-green / terracotta identity, Space Grotesk + Fraunces + Inter type pairing — deliberately not a golf-club look. |

## Known gaps / next steps

- **Renewal is Stripe's job** — Stripe re-bills automatically each period,
  but we don't yet listen for `invoice.payment_succeeded` to refresh
  `current_period_end` on renewal (only failure → `lapsed` is handled). Add
  that event to the webhook if you need `renews_at` to stay perfectly in sync
  across multiple billing cycles.
- **Auto-generated `draw_entries`** — right now an admin creates the draw
  shell; a scheduled job (Supabase Edge Function + cron, or a Vercel Cron
  Job calling a new `api/` route) should auto-assign each active subscriber
  a number set at the start of the billing cycle. `drawRandomNumbers()` in
  `src/lib/draws.js` is ready to reuse for that.
- **Email notifications** (win confirmation, renewal reminders) aren't built.
- **Independent donations** (`/donate`) don't go through Stripe yet — they
  write straight to the `donations` table. Same pattern as subscriptions
  would apply if you want real payment capture there too.
- Table components are intentionally plain (no virtualization) — fine at
  trainee-assignment scale, worth revisiting if user counts grow.

## Project structure

```
src/
  lib/            Supabase-backed domain logic (scores, draws, subscriptions, charities, storage)
  context/        Auth context (session + profile)
  components/     Shared UI (Navbar, ScoreEntry, CharitySelector, route guards)
  pages/          Public + subscriber pages
  pages/admin/    Admin control room, tabbed by function
  styles/         Design tokens + global CSS
supabase/
  schema.sql      Full DB schema, RLS policies, storage bucket, seed data
```
