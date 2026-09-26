import { supabase } from './supabaseClient'

export const PLAN_PRICE_CENTS = {
  monthly: 1500, // $15.00 / mo — placeholder pricing, adjust freely
  yearly: 15000, // $150.00 / yr (~2 months free)
}

export const MIN_CHARITY_PERCENT = 10

/** Amount of a subscription fee that flows to the chosen charity. */
export function charityContribution(amountCents, charityPercent) {
  return Math.round((amountCents * charityPercent) / 100)
}

export async function fetchMySubscription(userId) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, charity:charities(id, name)')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Creates or updates the caller's subscription row. Actual card capture is
 * expected to happen via Stripe Checkout/Elements — this just persists the
 * resulting plan/charity choice. Wire `stripeSubscriptionId` up once Stripe
 * is connected; until then the flow still exercises the full data model.
 */
export async function upsertSubscription(userId, { plan, charityId, charityPercent, stripeSubscriptionId }) {
  if (charityPercent < MIN_CHARITY_PERCENT) {
    throw new Error(`Charity contribution can't be less than ${MIN_CHARITY_PERCENT}%.`)
  }
  const amountCents = PLAN_PRICE_CENTS[plan]
  const now = new Date()
  const periodEnd = new Date(now)
  if (plan === 'monthly') periodEnd.setMonth(periodEnd.getMonth() + 1)
  else periodEnd.setFullYear(periodEnd.getFullYear() + 1)

  const { data, error } = await supabase
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        plan,
        status: 'active',
        amount_cents: amountCents,
        charity_id: charityId,
        charity_percent: charityPercent,
        stripe_subscription_id: stripeSubscriptionId ?? null,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        renews_at: periodEnd.toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single()
  if (error) throw error

  await supabase.from('subscription_events').insert({
    subscription_id: data.id,
    event_type: 'created',
    amount_cents: amountCents,
  })

  return data
}

export async function cancelSubscription(subscription) {
  const res = await fetch('/api/cancel-subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscriptionId: subscription.id,
      stripeSubscriptionId: subscription.stripe_subscription_id,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Could not cancel subscription.')
}

export function formatCents(cents, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
    (cents ?? 0) / 100
  )
}
