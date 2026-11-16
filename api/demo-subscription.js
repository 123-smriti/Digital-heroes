
import { createClient } from '@supabase/supabase-js'

const PLAN_PRICE_CENTS = {
  monthly: 1500,
  yearly: 15000,
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
  } = process.env

  if (
    !VITE_SUPABASE_URL ||
    !VITE_SUPABASE_ANON_KEY ||
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    return res.status(500).json({ error: 'Server configuration error.' })
  }

  try {
    const authHeader = req.headers.authorization

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Please log in first.' })
    }

    const token = authHeader.slice(7)

    const supabaseAuth = createClient(
      VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    const { data: authData, error: authError } =
      await supabaseAuth.auth.getUser(token)

    if (authError || !authData.user) {
      return res.status(401).json({ error: 'Invalid or expired session.' })
    }

    const { plan, charityId, charityPercent } = req.body ?? {}

    if (!Object.prototype.hasOwnProperty.call(PLAN_PRICE_CENTS, plan)) {
      return res.status(400).json({ error: 'Invalid subscription plan.' })
    }

    if (typeof charityId !== 'string' || !UUID_REGEX.test(charityId)) {
      return res.status(400).json({ error: 'Invalid charity.' })
    }

    const percent = Number(charityPercent)

    if (!Number.isFinite(percent) || percent < 10 || percent > 100) {
      return res.status(400).json({
        error: 'Charity contribution must be between 10% and 100%.',
      })
    }

    const supabaseAdmin = createClient(
      VITE_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    const { data: charity, error: charityError } = await supabaseAdmin
      .from('charities')
      .select('id')
      .eq('id', charityId)
      .maybeSingle()

    if (charityError) throw charityError

    if (!charity) {
      return res.status(400).json({ error: 'Selected charity not found.' })
    }

    const userId = authData.user.id

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('subscriptions')
      .select('id, status')
      .eq('user_id', userId)
      .maybeSingle()

    if (existingError) throw existingError

    if (existing?.status === 'active') {
      return res.status(409).json({
        error: 'You already have an active subscription.',
      })
    }

    const start = new Date()
    const end = new Date(start)

    if (plan === 'monthly') {
      end.setMonth(end.getMonth() + 1)
    } else {
      end.setFullYear(end.getFullYear() + 1)
    }

    const { data: subscription, error: saveError } = await supabaseAdmin
      .from('subscriptions')
      .upsert(
        {
          user_id: userId,
          plan,
          status: 'active',
          amount_cents: PLAN_PRICE_CENTS[plan],
          charity_id: charityId,
          charity_percent: percent,
          stripe_subscription_id: null,
          current_period_start: start.toISOString(),
          current_period_end: end.toISOString(),
          renews_at: end.toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    if (saveError) throw saveError

    const { error: eventError } = await supabaseAdmin
      .from('subscription_events')
      .insert({
        subscription_id: subscription.id,
        event_type: 'created',
        amount_cents: PLAN_PRICE_CENTS[plan],
      })

    if (eventError) {
      console.error('Demo subscription event error:', eventError)
    }

    return res.status(200).json({
      success: true,
      demo: true,
      subscription,
      message: 'Demo subscription activated. No payment was taken.',
    })
  } catch (error) {
    console.error('Demo subscription error:', error.message)

    return res.status(500).json({
      error: 'Could not activate demo subscription. Please try again.',
    })
  }
}
