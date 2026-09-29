# Digital Heroes

A golf performance-tracking platform combined with monthly charity draws —
subscribe, log your rounds, back a cause, and get entered into a prize pool
funded by every active subscriber. Built to the Digital Heroes PRD (Level 1)
for the trainee selection process.

## Live demo & test credentials

**Live URL:** https://digital-heroes-sigma-weld.vercel.app

**Admin login**
- Email: `sam@gmail.com`
- Password: `1********`

**Subscriber login**
- Email: `pam@gmail.com`
- Password: `1*******`

**Stripe test card** (for the subscribe flow):
`4242 4242 4242 4242`, any future expiry, any CVC.

## What it does

- **Subscriptions** — monthly/yearly plans via Stripe Checkout, with a
  minimum 10% of every payment routed to a charity the subscriber picks
- **Score tracking** — Stableford scores, last 5 rounds only (rolling
  window), add/edit/delete
- **Charity system** — searchable directory, profile pages, homepage
  spotlight, plus a donation flow that's independent of any subscription
- **Monthly draws** — random or score-weighted number draws, a 40/35/25
  prize-pool split across match tiers, jackpot rollover when unclaimed,
  admin simulate-before-publish workflow
- **Winner verification** — screenshot proof upload, admin approve/reject,
  pending → paid payout tracking
- **Two dashboards** — a subscriber dashboard (subscription, scores,
  charity, winnings) and an admin control room (users, draws, charities,
  winners, reports)

## Tech stack

- **Frontend:** React 18, Vite, React Router, ESLint (flat config)
- **Backend:** Supabase (Postgres, Auth, Storage, Row-Level Security)
- **Payments:** Stripe Checkout + webhooks, via Vercel Serverless Functions
- **Charts:** Recharts (admin reports)
- **Hosting:** Vercel


## Project structure

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
