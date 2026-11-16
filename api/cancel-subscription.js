// Vercel Serverless Function: POST /api/cancel-subscription
// Cancels the subscription in Stripe (the billing source of truth) and
// mirrors the cancellation locally. The customer.subscription.deleted
// webhook will also fire and reconcile the same row — this direct update
// just means the UI doesn't have to wait for the webhook round-trip.

// api/cancel-subscription.js

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Check server configuration
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !stripeSecretKey) {
    console.error('Missing required server environment variables')
    return res.status(500).json({ error: 'Server configuration error.' })
  }

  try {
    // 1. Authenticate the logged-in user
    const authHeader = req.headers.authorization

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required.' })
    }

    const token = authHeader.slice(7)

    const supabaseAuth = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    const { data: authData, error: authError } =
      await supabaseAuth.auth.getUser(token)

    if (authError || !authData.user) {
      return res.status(401).json({ error: 'Invalid or expired session.' })
    }

    const userId = authData.user.id

    // 2. Validate the subscription ID
    const { subscriptionId } = req.body ?? {}

    if (
      typeof subscriptionId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subscriptionId)
    ) {
      return res.status(400).json({ error: 'Invalid subscription ID.' })
    }

    // 3. Create admin client (server-side only)
    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    // 4. Find subscription belonging to this authenticated user
    const { data: subscription, error: fetchError } =
      await supabaseAdmin
        .from('subscriptions')
        .select('id, user_id, stripe_subscription_id, status')
        .eq('id', subscriptionId)
        .eq('user_id', userId)
        .maybeSingle()

    if (fetchError) throw fetchError

    if (!subscription) {
      return res.status(404).json({
        error: 'Subscription not found or access denied.',
      })
    }

    // 5. Make repeated cancellation requests safe
    if (subscription.status === 'cancelled') {
      return res.status(200).json({ cancelled: true })
    }

    // 6. Cancel using the Stripe ID retrieved from our database
    if (subscription.stripe_subscription_id) {
      const stripe = new Stripe(stripeSecretKey)

      await stripe.subscriptions.cancel(
        subscription.stripe_subscription_id
      )
    }

    // 7. Update only this user's subscription
    const { error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('id', subscription.id)
      .eq('user_id', userId)

    if (updateError) throw updateError

    // 8. Record cancellation event
    const { error: eventError } = await supabaseAdmin
      .from('subscription_events')
      .insert({
        subscription_id: subscription.id,
        event_type: 'cancelled',
      })

    if (eventError) {
      console.error('Subscription event insert failed:', eventError)
    }

    return res.status(200).json({ cancelled: true })

  } catch (error) {
    console.error('Cancel subscription error:', error.message)

    return res.status(500).json({
      error: 'Unable to cancel subscription. Please try again.',
    })
  }
}
