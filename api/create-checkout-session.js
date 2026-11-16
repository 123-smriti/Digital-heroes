// Vercel Serverless Function: POST /api/create-checkout-session
// Creates a Stripe Checkout session in subscription mode. The actual
// subscription row is written by /api/stripe-webhook once payment succeeds —
// this endpoint just starts the checkout, it never touches the database.

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const PLAN_PRICE_CENTS = {
  monthly: 1500,
  yearly: 15000,
}

const PLAN_INTERVAL = {
  monthly: 'month',
  yearly: 'year',
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    STRIPE_SECRET_KEY,
    VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    APP_URL,
  } = process.env

  if (
    !STRIPE_SECRET_KEY ||
    !VITE_SUPABASE_URL ||
    !VITE_SUPABASE_ANON_KEY ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !APP_URL
  ) {
    console.error('Missing checkout server configuration')
    return res.status(500).json({ error: 'Server configuration error.' })
  }

  try {
    // 1. Authenticate the user using their Supabase access token
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

    if (authError || !authData.user || !authData.user.email) {
      return res.status(401).json({ error: 'Invalid or expired session.' })
    }

    const user = authData.user

    // 2. Validate the requested plan and charity contribution
    const { plan, charityId, charityPercent } = req.body ?? {}

    if (!Object.hasOwn(PLAN_PRICE_CENTS, plan)) {
      return res.status(400).json({ error: 'Invalid subscription plan.' })
    }

    if (
      typeof charityId !== 'string' ||
      !UUID_REGEX.test(charityId)
    ) {
      return res.status(400).json({ error: 'Invalid charity.' })
    }

    const percent = Number(charityPercent)

    if (
      !Number.isFinite(percent) ||
      percent < 10 ||
      percent > 100
    ) {
      return res.status(400).json({
        error: 'Charity contribution must be between 10% and 100%.',
      })
    }

    // 3. Verify that the selected charity exists
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

    // 4. Validate the trusted application URL
    const appUrl = new URL(APP_URL)

    if (
      appUrl.protocol !== 'https:' &&
      appUrl.hostname !== 'localhost'
    ) {
      return res.status(500).json({ error: 'Invalid application URL.' })
    }

    // 5. Create Stripe Checkout using server-controlled information
    const stripe = new Stripe(STRIPE_SECRET_KEY)

    const metadata = {
      userId: user.id,
      charityId,
      charityPercent: String(percent),
      plan,
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email,
      client_reference_id: user.id,

      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: PLAN_PRICE_CENTS[plan],
            recurring: {
              interval: PLAN_INTERVAL[plan],
            },
            product_data: {
              name: `Digital Heroes — ${plan} subscription`,
            },
          },
          quantity: 1,
        },
      ],

      metadata,

      subscription_data: {
        metadata,
      },

      success_url: `${appUrl.origin}/dashboard?checkout=success`,
      cancel_url: `${appUrl.origin}/subscribe?checkout=cancelled`,
    })

    return res.status(200).json({ url: session.url })

  } catch (error) {
    console.error('Checkout creation failed:', error.message)

    return res.status(500).json({
      error: 'Unable to start checkout. Please try again.',
    })
  }
}
