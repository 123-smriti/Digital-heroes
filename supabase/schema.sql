-- ============================================================================
-- Digital Heroes — Supabase schema
-- Run this in the Supabase SQL editor of a NEW project (per PRD §15.1).
-- ============================================================================

-- --- Extensions -------------------------------------------------------------
create extension if not exists "pgcrypto";

-- --- Enums -------------------------------------------------------------------
create type user_role as enum ('subscriber', 'admin');
create type subscription_plan as enum ('monthly', 'yearly');
create type subscription_status as enum ('active', 'inactive', 'cancelled', 'lapsed');
create type draw_mode as enum ('random', 'algorithmic');
create type draw_state as enum ('draft', 'simulated', 'published');
create type match_tier as enum ('3_number', '4_number', '5_number');
create type payout_status as enum ('pending', 'paid');

-- --- Profiles (extends auth.users) -------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role user_role not null default 'subscriber',
  created_at timestamptz not null default now()
);

-- --- Charities -----------------------------------------------------------------
create table charities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  image_url text,
  is_featured boolean not null default false,
  upcoming_event_name text,
  upcoming_event_date date,
  created_at timestamptz not null default now()
);

-- --- Subscriptions ---------------------------------------------------------
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  plan subscription_plan not null,
  status subscription_status not null default 'inactive',
  amount_cents integer not null,           -- fee charged for this billing cycle
  charity_id uuid references charities(id),
  charity_percent numeric(5,2) not null default 10.00 check (charity_percent >= 10.00),
  stripe_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  renews_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id) -- one active subscription record per user; history kept in subscription_events
);

create table subscription_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  event_type text not null, -- created | renewed | cancelled | lapsed | payment_failed
  amount_cents integer,
  created_at timestamptz not null default now()
);

-- --- Independent donations (not tied to gameplay, PRD §08.1) ----------------
create table donations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  charity_id uuid not null references charities(id),
  amount_cents integer not null,
  created_at timestamptz not null default now()
);

-- --- Scores (rolling last-5, PRD §05) ---------------------------------------
create table scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  score integer not null check (score between 1 and 45),
  played_on date not null,
  created_at timestamptz not null default now(),
  unique (user_id, played_on) -- one entry per date
);

-- Enforce "only latest 5 retained" via trigger: on insert, delete the oldest
-- entry beyond 5 for that user.
create or replace function enforce_score_rolling_window()
returns trigger as $$
begin
  delete from scores
  where user_id = new.user_id
    and id not in (
      select id from scores
      where user_id = new.user_id
      order by played_on desc, created_at desc
      limit 5
    );
  return new;
end;
$$ language plpgsql;

create trigger trg_scores_rolling_window
after insert on scores
for each row execute function enforce_score_rolling_window();

-- --- Draws (monthly, PRD §06/§07) -------------------------------------------
create table draws (
  id uuid primary key default gen_random_uuid(),
  draw_month date not null, -- first of the month this draw covers
  mode draw_mode not null default 'random',
  state draw_state not null default 'draft',
  winning_numbers int[] not null default '{}', -- the drawn 5-number combination
  total_prize_pool_cents integer not null default 0,
  pool_5_cents integer not null default 0, -- 40% share
  pool_4_cents integer not null default 0, -- 35% share
  pool_3_cents integer not null default 0, -- 25% share
  jackpot_rollover_cents integer not null default 0, -- carried in from a prior unclaimed 5-match
  active_subscriber_count integer not null default 0,
  published_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (draw_month)
);

-- Each subscriber's entry for a given draw (their number picks / assigned numbers)
create table draw_entries (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references draws(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  numbers int[] not null,
  created_at timestamptz not null default now(),
  unique (draw_id, user_id)
);

-- --- Winners & verification (PRD §09) ---------------------------------------
create table winners (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references draws(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  tier match_tier not null,
  amount_cents integer not null,
  proof_url text, -- screenshot of scores uploaded by winner
  verified boolean not null default false,
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  payout_status payout_status not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table profiles enable row level security;
alter table charities enable row level security;
alter table subscriptions enable row level security;
alter table subscription_events enable row level security;
alter table donations enable row level security;
alter table scores enable row level security;
alter table draws enable row level security;
alter table draw_entries enable row level security;
alter table winners enable row level security;

-- helper: is the current user an admin?
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

-- Profiles: users read/update their own row; admins read/update all
create policy "profiles_select_own_or_admin" on profiles
  for select using (auth.uid() = id or is_admin());
create policy "profiles_update_own_or_admin" on profiles
  for update using (auth.uid() = id or is_admin());
create policy "profiles_insert_self" on profiles
  for insert with check (auth.uid() = id);

-- Charities: public read; admin write
create policy "charities_select_all" on charities for select using (true);
create policy "charities_admin_write" on charities for all using (is_admin()) with check (is_admin());

-- Subscriptions: owner + admin
create policy "subscriptions_select_own_or_admin" on subscriptions
  for select using (auth.uid() = user_id or is_admin());
create policy "subscriptions_insert_own" on subscriptions
  for insert with check (auth.uid() = user_id);
create policy "subscriptions_update_own_or_admin" on subscriptions
  for update using (auth.uid() = user_id or is_admin());

create policy "sub_events_select_own_or_admin" on subscription_events
  for select using (
    is_admin() or exists (select 1 from subscriptions s where s.id = subscription_id and s.user_id = auth.uid())
  );

-- Donations: owner + admin
create policy "donations_select_own_or_admin" on donations
  for select using (auth.uid() = user_id or is_admin());
create policy "donations_insert_own" on donations
  for insert with check (auth.uid() = user_id or user_id is null);

-- Scores: owner + admin
create policy "scores_select_own_or_admin" on scores
  for select using (auth.uid() = user_id or is_admin());
create policy "scores_write_own_or_admin" on scores
  for all using (auth.uid() = user_id or is_admin()) with check (auth.uid() = user_id or is_admin());

-- Draws: published draws readable by everyone; drafts admin-only
create policy "draws_select_published_or_admin" on draws
  for select using (state = 'published' or is_admin());
create policy "draws_admin_write" on draws
  for all using (is_admin()) with check (is_admin());

-- Draw entries: owner + admin
create policy "draw_entries_select_own_or_admin" on draw_entries
  for select using (auth.uid() = user_id or is_admin());
create policy "draw_entries_admin_write" on draw_entries
  for all using (is_admin()) with check (is_admin());

-- Winners: owner + admin can see; owner can upload proof; admin verifies
create policy "winners_select_own_or_admin" on winners
  for select using (auth.uid() = user_id or is_admin());
create policy "winners_update_own_proof" on winners
  for update using (auth.uid() = user_id or is_admin());
create policy "winners_admin_insert" on winners
  for insert with check (is_admin());

-- ============================================================================
-- Storage: bucket for winner-uploaded score screenshots (PRD §09)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('winner-proofs', 'winner-proofs', true)
on conflict (id) do nothing;

create policy "winner_proofs_public_read" on storage.objects
  for select using (bucket_id = 'winner-proofs');

create policy "winner_proofs_authenticated_upload" on storage.objects
  for insert with check (bucket_id = 'winner-proofs' and auth.role() = 'authenticated');

create policy "winner_proofs_owner_update" on storage.objects
  for update using (bucket_id = 'winner-proofs' and auth.role() = 'authenticated');

-- ============================================================================
-- Seed: a couple of charities so the directory isn't empty
-- ============================================================================
insert into charities (name, description, is_featured, upcoming_event_name, upcoming_event_date) values
  ('Greenway Trust', 'Restores public green spaces in underserved neighbourhoods.', true, 'Community Golf Day', current_date + interval '30 days'),
  ('First Tee Foundation', 'Gets kids from low-income families into sport and mentoring.', false, null, null),
  ('Coastal Relief Network', 'Emergency response and rebuilding after coastal flooding.', false, null, null);

-- ============================================================================
-- Bootstrapping your first admin
-- ============================================================================
-- Sign up normally through the app first, then run:
--   update profiles set role = 'admin' where email = 'you@example.com';
