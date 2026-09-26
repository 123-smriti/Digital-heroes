-- ============================================================================
-- Batch seed template — fill in the three arrays below with the users you
-- already created under Authentication → Users, then run this whole file
-- once. Handles any number of users in one go.
-- ============================================================================

do $$
declare
  fake_charity_id uuid;
  user_ids  uuid[] := array[
    'PASTE-UUID-1',
    'PASTE-UUID-2',
    'PASTE-UUID-3'
    -- add as many as you created
  ];
  user_names text[] := array[
    'Asha Rao',
    'Marcus Webb',
    'Priya Nair'
    -- must be same length/order as user_ids
  ];
  user_emails text[] := array[
    'test1@demo.com',
    'test2@demo.com',
    'test3@demo.com'
    -- must match what you typed in the dashboard
  ];
  i int;
begin
  select id into fake_charity_id from charities limit 1;

  for i in 1..array_length(user_ids, 1) loop
    insert into profiles (id, full_name, email, role)
    values (user_ids[i], user_names[i], user_emails[i], 'subscriber')
    on conflict (id) do nothing;

    insert into subscriptions (
      user_id, plan, status, amount_cents, charity_id, charity_percent,
      current_period_end, renews_at
    )
    values (
      user_ids[i], 'monthly', 'active', 1500, fake_charity_id, 15,
      now() + interval '1 month', now() + interval '1 month'
    )
    on conflict (user_id) do nothing;

    -- 5 scores, roughly weekly, random-ish
    insert into scores (user_id, score, played_on)
    select user_ids[i], (20 + floor(random() * 20))::int, current_date - (n * 7)
    from generate_series(1, 5) as n
    on conflict (user_id, played_on) do nothing;
  end loop;
end $$;

-- --- Draft draw for the current month (once) --------------------------------
insert into draws (draw_month, mode, state, total_prize_pool_cents, active_subscriber_count)
values (
  date_trunc('month', current_date)::date,
  'random',
  'draft',
  4500,
  3
)
on conflict (draw_month) do nothing;

-- --- Give every one of those users an entry, with random unique numbers -----
do $$
declare
  user_ids uuid[] := array[
    'PASTE-UUID-1',
    'PASTE-UUID-2',
    'PASTE-UUID-3'
    -- same list as above
  ];
  target_draw_id uuid;
  i int;
  nums int[];
begin
  select id into target_draw_id
  from draws
  where draw_month = date_trunc('month', current_date)::date;

  for i in 1..array_length(user_ids, 1) loop
    nums := array[]::int[];
    while coalesce(array_length(nums, 1), 0) < 5 loop
      nums := array(select distinct unnest(array_append(nums, (1 + floor(random() * 49))::int)));
    end loop;

    insert into draw_entries (draw_id, user_id, numbers)
    values (target_draw_id, user_ids[i], nums)
    on conflict (draw_id, user_id) do nothing;
  end loop;
end $$;
