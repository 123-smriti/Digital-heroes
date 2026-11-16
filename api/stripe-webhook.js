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
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
)

export const config = {
  api: { bodyParser: false },
}

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

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []

    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function validMetadata(metadata = {}) {
  const { userId, charityId, charityPercent, plan } = metadata
  const percent = Number(charityPercent)

  return (
    UUID_REGEX.test(userId ?? '') &&
    UUID_REGEX.test(charityId ?? '') &&
    Object.prototype.hasOwnProperty.call(PLAN_PRICE_CENTS, plan) &&
    Number.isFinite(percent) &&
    percent >= 10 &&
    percent <= 100
  )
}

async function recordSubscriptionEvent(subscriptionId, eventType, amountCents) {
  const { error } = await supabaseAdmin
    .from('subscription_events')
    .insert({
      subscription_id: subscriptionId,
      event_type: eventType,
      ...(amountCents != null ? { amount_cents: amountCents } : {}),
    })

  if (error) throw error
}

async function handleCheckoutCompleted(session) {
  // A completed Checkout session alone does not prove payment succeeded.
  if (
    session.mode !== 'subscription' ||
    !['paid', 'no_payment_required'].includes(session.payment_status) ||
    typeof session.subscription !== 'string'
  ) {
    console.warn('Checkout session is not eligible for activation:', session.id)
    return
  }

  const metadata = session.metadata ?? {}

  if (
    !validMetadata(metadata) ||
    session.client_reference_id !== metadata.userId
  ) {
    throw new Error('Invalid Checkout session metadata.')
  }

  const percent = Number(metadata.charityPercent)

  const stripeSubscription = await stripe.subscriptions.retrieve(
    session.subscription
  )

  if (
    !['active', 'trialing'].includes(stripeSubscription.status) ||
    stripeSubscription.metadata?.userId !== metadata.userId ||
    stripeSubscription.metadata?.charityId !== metadata.charityId ||
    stripeSubscription.metadata?.plan !== metadata.plan ||
    Number(stripeSubscription.metadata?.charityPercent) !== percent
  ) {
    throw new Error('Stripe subscription validation failed.')
  }

  const item = stripeSubscription.items?.data?.[0]
  const price = item?.price

  if (
    !price ||
    price.unit_amount !== PLAN_PRICE_CENTS[metadata.plan] ||
    price.currency !== 'usd' ||
    price.recurring?.interval !== PLAN_INTERVAL[metadata.plan]
  ) {
    throw new Error('Stripe subscription price validation failed.')
  }

  const periodStart = item.current_period_start
  const periodEnd = item.current_period_end

  if (!periodStart || !periodEnd) {
    throw new Error('Stripe billing period is missing.')
  }

  // Confirm the selected charity still exists.
  const { data: charity, error: charityError } = await supabaseAdmin
    .from('charities')
    .select('id')
    .eq('id', metadata.charityId)
    .maybeSingle()

  if (charityError) throw charityError
  if (!charity) throw new Error('Selected charity no longer exists.')

  const amountCents = price.unit_amount

  const { data: sub, error } = await supabaseAdmin
    .from('subscriptions')
    .upsert(
      {
        user_id: metadata.userId,
        plan: metadata.plan,
        status: 'active',
        amount_cents: amountCents,
        charity_id: metadata.charityId,
        charity_percent: percent,
        stripe_subscription_id: stripeSubscription.id,
        current_period_start: new Date(periodStart * 1000).toISOString(),
        current_period_end: new Date(periodEnd * 1000).toISOString(),
        renews_at: new Date(periodEnd * 1000).toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single()

  if (error) throw error

  await recordSubscriptionEvent(sub.id, 'created', amountCents)
}

async function handleSubscriptionDeleted(stripeSubId) {
  const { data: sub, error } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', stripeSubId)
    .maybeSingle()

  if (error) throw error
  if (!sub) return

  const { error: updateError } = await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'cancelled' })
    .eq('id', sub.id)

  if (updateError) throw updateError

  await recordSubscriptionEvent(sub.id, 'cancelled')
}

async function handlePaymentFailed(invoice) {
  const stripeSubId =
    invoice.subscription ??
    invoice.parent?.subscription_details?.subscription

  if (typeof stripeSubId !== 'string') return

  const { data: sub, error } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', stripeSubId)
    .maybeSingle()

  if (error) throw error
  if (!sub) return

  const { error: updateError } = await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'lapsed' })
    .eq('id', sub.id)

  if (updateError) throw updateError

  await recordSubscriptionEvent(sub.id, 'payment_failed')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end()
  }

  if (
    !process.env.STRIPE_SECRET_KEY ||
    !process.env.STRIPE_WEBHOOK_SECRET ||
    !process.env.VITE_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    console.error('Missing webhook server configuration')
    return res.status(500).json({ error: 'Server configuration error.' })
  }

  let event

  try {
    const rawBody = await readRawBody(req)
    const signature = req.headers['stripe-signature']

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (error) {
    console.error('Webhook signature verification failed:', error.message)
    return res.status(400).send('Invalid webhook signature.')
  }

  // Claim this event before processing it. The primary key prevents
  // concurrent duplicate deliveries from processing the same event.
  const { error: claimError } = await supabaseAdmin
    .from('stripe_webhook_events')
    .insert({
      event_id: event.id,
      event_type: event.type,
    })

  if (claimError) {
    if (claimError.code === '23505') {
      return res.status(200).json({ received: true, duplicate: true })
    }

    console.error('Could not claim webhook event:', claimError)
    return res.status(500).json({ error: 'Could not register webhook event.' })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object.id)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object)
        break

      default:
        break
    }

    return res.status(200).json({ received: true })
  } catch (error) {
    console.error('Webhook processing failed:', error)

    // Remove the claim so Stripe can retry this event.
    const { error: cleanupError } = await supabaseAdmin
      .from('stripe_webhook_events')
      .delete()
      .eq('event_id', event.id)

    if (cleanupError) {
      console.error('Could not release webhook event claim:', cleanupError)
    }

    return res.status(500).json({ error: 'Webhook processing failed.' })
  }
}
