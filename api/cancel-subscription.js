// Vercel Serverless Function: POST /api/cancel-subscription
// Cancels the subscription in Stripe (the billing source of truth) and
// mirrors the cancellation locally. The customer.subscription.deleted
// webhook will also fire and reconcile the same row — this direct update
// just means the UI doesn't have to wait for the webhook round-trip.
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({
      error: 'Stripe is not configured on the server (STRIPE_SECRET_KEY missing).',
    })
  }

  const { subscriptionId, stripeSubscriptionId } = req.body ?? {}
  if (!subscriptionId) {
    return res.status(400).json({ error: 'Missing subscriptionId.' })
  }

  try {
    if (stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(stripeSubscriptionId)
      } catch (err) {
        // Already cancelled on Stripe's side, or was never a real Stripe
        // subscription (e.g. seeded test data) — don't block the local
        // cancellation on that.
        console.warn('Stripe cancel warning:', err.message)
      }
    }

    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('id', subscriptionId)
    if (error) throw error

    await supabaseAdmin.from('subscription_events').insert({
      subscription_id: subscriptionId,
      event_type: 'cancelled',
    })

    return res.status(200).json({ cancelled: true })
  } catch (err) {
    console.error('cancel-subscription error:', err)
    return res.status(500).json({ error: err.message })
  }
}
