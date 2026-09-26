// Vercel Serverless Function: POST /api/stripe-webhook
// Stripe calls this directly (not the browser) once a payment event happens.
// This is the ONLY place a subscription actually becomes "active" in the
// database — Checkout starting a session is not enough on its own.
//
// Configure in the Stripe dashboard: Developers → Webhooks → Add endpoint
//   URL: https://YOUR-DEPLOYED-SITE/api/stripe-webhook
//   Events: checkout.session.completed, customer.subscription.deleted,
//           invoice.payment_failed
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // service role — bypasses RLS, server-only
)

// Stripe needs the raw request body (unparsed) to verify the signature.
export const config = {
  api: { bodyParser: false },
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

const PLAN_PRICE_CENTS = { monthly: 1500, yearly: 15000 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  let event
  try {
    const rawBody = await readRawBody(req)
    const signature = req.headers['stripe-signature']
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const { userId, charityId, charityPercent, plan } = session.metadata ?? {}
        if (!userId || !charityId) break

        const amountCents = PLAN_PRICE_CENTS[plan] ?? session.amount_total
        const now = new Date()
        const periodEnd = new Date(now)
        if (plan === 'yearly') periodEnd.setFullYear(periodEnd.getFullYear() + 1)
        else periodEnd.setMonth(periodEnd.getMonth() + 1)

        const { data: sub, error } = await supabaseAdmin
          .from('subscriptions')
          .upsert(
            {
              user_id: userId,
              plan: plan ?? 'monthly',
              status: 'active',
              amount_cents: amountCents,
              charity_id: charityId,
              charity_percent: Number(charityPercent) || 10,
              stripe_subscription_id: session.subscription,
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
              renews_at: periodEnd.toISOString(),
            },
            { onConflict: 'user_id' }
          )
          .select()
          .single()
        if (error) throw error

        await supabaseAdmin.from('subscription_events').insert({
          subscription_id: sub.id,
          event_type: 'created',
          amount_cents: amountCents,
        })
        break
      }

      case 'customer.subscription.deleted': {
        const stripeSubId = event.data.object.id
        const { data: sub } = await supabaseAdmin
          .from('subscriptions')
          .select('id')
          .eq('stripe_subscription_id', stripeSubId)
          .maybeSingle()
        if (sub) {
          await supabaseAdmin.from('subscriptions').update({ status: 'cancelled' }).eq('id', sub.id)
          await supabaseAdmin.from('subscription_events').insert({
            subscription_id: sub.id,
            event_type: 'cancelled',
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const stripeSubId = event.data.object.subscription
        if (!stripeSubId) break
        const { data: sub } = await supabaseAdmin
          .from('subscriptions')
          .select('id')
          .eq('stripe_subscription_id', stripeSubId)
          .maybeSingle()
        if (sub) {
          await supabaseAdmin.from('subscriptions').update({ status: 'lapsed' }).eq('id', sub.id)
          await supabaseAdmin.from('subscription_events').insert({
            subscription_id: sub.id,
            event_type: 'payment_failed',
          })
        }
        break
      }

      default:
        break // ignore events we don't care about
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    return res.status(500).json({ error: err.message })
  }
}
