/**
 * Seeds Digital Heroes with fake data: subscribers, scores, subscriptions,
 * and a draft draw with entries — so the admin dashboard, reports, and draw
 * simulation all have something real to show.
 *
 * Requires the SERVICE ROLE key (not the anon key) because it creates real
 * auth users and writes past RLS. Never ship this key to the browser / put
 * it in a VITE_ variable.
 *
 * Usage:
 *   1. In your Supabase dashboard: Project Settings → API → copy the
 *      "service_role" secret key.
 *   2. Add it to .env as SUPABASE_SERVICE_ROLE_KEY=...
 *   3. npm run seed
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    'Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.\n' +
    'Add SUPABASE_SERVICE_ROLE_KEY (from Project Settings → API → service_role) and re-run.'
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const FAKE_USERS = [
  { fullName: 'Asha Rao', email: 'asha.demo@digitalheroes.test' },
  { fullName: 'Marcus Webb', email: 'marcus.demo@digitalheroes.test' },
  { fullName: 'Priya Nair', email: 'priya.demo@digitalheroes.test' },
  { fullName: 'Tom Fletcher', email: 'tom.demo@digitalheroes.test' },
  { fullName: 'Leila Haddad', email: 'leila.demo@digitalheroes.test' },
  { fullName: 'Ben Okafor', email: 'ben.demo@digitalheroes.test' },
  { fullName: 'Grace Kim', email: 'grace.demo@digitalheroes.test' },
  { fullName: 'Dev Sharma', email: 'dev.demo@digitalheroes.test' },
]
const DEMO_PASSWORD = 'DemoPass123!'
const PLAN_PRICE_CENTS = { monthly: 1500, yearly: 15000 }

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomDateWithinDays(days) {
  const d = new Date()
  d.setDate(d.getDate() - randInt(0, days))
  return d.toISOString().slice(0, 10)
}

function randomNumberSet(count = 5, max = 49) {
  const set = new Set()
  while (set.size < count) set.add(randInt(1, max))
  return [...set].sort((a, b) => a - b)
}

async function main() {
  console.log('Fetching charities…')
  const { data: charities, error: charityErr } = await supabase.from('charities').select('id, name')
  if (charityErr) throw charityErr
  if (!charities?.length) {
    console.error('No charities found — run supabase/schema.sql first (it seeds three).')
    process.exit(1)
  }

  const createdUserIds = []

  for (const fake of FAKE_USERS) {
    process.stdout.write(`Creating ${fake.email}… `)

    const { data: existing } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    const already = existing?.users?.find((u) => u.email === fake.email)

    let userId
    if (already) {
      userId = already.id
      console.log('already exists, reusing.')
    } else {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: fake.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: fake.fullName },
      })
      if (createErr) throw createErr
      userId = created.user.id
      console.log('done.')
    }
    createdUserIds.push(userId)

    // profiles row (upsert so re-runs are safe)
    await supabase.from('profiles').upsert(
      { id: userId, full_name: fake.fullName, email: fake.email, role: 'subscriber' },
      { onConflict: 'id' }
    )

    // subscription: random plan, random charity, active
    const plan = Math.random() < 0.3 ? 'yearly' : 'monthly'
    const charity = charities[randInt(0, charities.length - 1)]
    const amountCents = PLAN_PRICE_CENTS[plan]
    const now = new Date()
    const periodEnd = new Date(now)
    if (plan === 'monthly') periodEnd.setMonth(periodEnd.getMonth() + 1)
    else periodEnd.setFullYear(periodEnd.getFullYear() + 1)

    const { data: sub } = await supabase
      .from('subscriptions')
      .upsert(
        {
          user_id: userId,
          plan,
          status: 'active',
          amount_cents: amountCents,
          charity_id: charity.id,
          charity_percent: [10, 15, 20, 25][randInt(0, 3)],
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          renews_at: periodEnd.toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    if (sub) {
      await supabase.from('subscription_events').insert({
        subscription_id: sub.id,
        event_type: 'created',
        amount_cents: amountCents,
      })
    }

    // 5 scores, unique dates
    const usedDates = new Set()
    const scoreRows = []
    while (scoreRows.length < 5) {
      const playedOn = randomDateWithinDays(60)
      if (usedDates.has(playedOn)) continue
      usedDates.add(playedOn)
      scoreRows.push({ user_id: userId, score: randInt(20, 42), played_on: playedOn })
    }
    await supabase.from('scores').delete().eq('user_id', userId)
    await supabase.from('scores').insert(scoreRows)
  }

  // --- Draft draw for the current month with an entry per subscriber ---
  console.log('\nCreating this month\'s draft draw…')
  const drawMonth = new Date().toISOString().slice(0, 7) + '-01'

  const { count: activeCount } = await supabase
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  const { data: allActiveSubs } = await supabase
    .from('subscriptions')
    .select('amount_cents')
    .eq('status', 'active')
  const totalPoolCents = (allActiveSubs ?? []).reduce((sum, s) => sum + s.amount_cents, 0)

  const { data: draw, error: drawErr } = await supabase
    .from('draws')
    .upsert(
      {
        draw_month: drawMonth,
        mode: 'random',
        state: 'draft',
        total_prize_pool_cents: totalPoolCents,
        active_subscriber_count: activeCount ?? 0,
      },
      { onConflict: 'draw_month' }
    )
    .select()
    .single()
  if (drawErr) throw drawErr

  for (const userId of createdUserIds) {
    await supabase.from('draw_entries').upsert(
      { draw_id: draw.id, user_id: userId, numbers: randomNumberSet() },
      { onConflict: 'draw_id,user_id' }
    )
  }

  console.log(`\nDone. Seeded ${createdUserIds.length} subscribers.`)
  console.log(`Draft draw for ${drawMonth} created with pool ${(totalPoolCents / 100).toFixed(2)} — `)
  console.log('go to Admin → Draws and hit "Simulate" to see it in action.')
  console.log(`\nAll demo accounts use the password: ${DEMO_PASSWORD}`)
}

main().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
