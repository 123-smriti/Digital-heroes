-- ============================================================================
-- Manual seed template — no service_role key needed.
--
-- 1. In Supabase → Authentication → Users → Add user, create each fake
--    subscriber by hand (check "Auto Confirm User").
-- 2. Copy each user's UUID from that list and paste it in below,
--    replacing 'PASTE-UUID-HERE'.
-- 3. Run this whole file in the SQL editor.
-- ============================================================================

-- --- One block per fake user — duplicate this block for as many as you want.

do $$
declare
  fake_user_id uuid := 'PASTE-UUID-HERE'; -- from Authentication → Users
  fake_charity_id uuid;
begin
  -- pick any existing charity to back
  select id into fake_charity_id from charities limit 1;

  insert into profiles (id, full_name, email, role)
  values (fake_user_id, 'Asha Rao', 'test1@demo.com', 'subscriber')
  on conflict (id) do nothing;

  insert into subscriptions (user_id, plan, status, amount_cents, charity_id, charity_percent, current_period_end, renews_at)
  values (fake_user_id, 'monthly', 'active', 1500, fake_charity_id, 15,
          now() + interval '1 month', now() + interval '1 month')
  on conflict (user_id) do nothing;

  insert into scores (user_id, score, played_on) values
    (fake_user_id, 32, current_date - 3),
    (fake_user_id, 28, current_date - 10),
    (fake_user_id, 35, current_date - 17),
    (fake_user_id, 30, current_date - 24),
    (fake_user_id, 33, current_date - 31)
  on conflict (user_id, played_on) do nothing;
end $$;

-- --- Draft draw for the current month (run once, not per user) -------------
insert into draws (draw_month, mode, state, total_prize_pool_cents, active_subscriber_count)
values (date_trunc('month', current_date)::date, 'random', 'draft', 4500, 3)
on conflict (draw_month) do nothing;

-- --- Give that user an entry in it (run once per fake user) ----------------
insert into draw_entries (draw_id, user_id, numbers)
select id, 'PASTE-UUID-HERE', array[3, 14, 22, 31, 47]
from draws where draw_month = date_trunc('month', current_date)::date
on conflict (draw_id, user_id) do nothing;
