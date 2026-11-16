
import { supabase } from './supabaseClient'

export const PLAN_PRICE_CENTS = {
  monthly: 1500,
  yearly: 15000,
}

export const MIN_CHARITY_PERCENT = 10

/** Amount of a subscription fee that flows to the chosen charity. */
export function charityContribution(amountCents, charityPercent) {
  return Math.round((amountCents * charityPercent) / 100)
}

/** Fetch the current user's subscription. RLS protects access. */
export async function fetchMySubscription(userId) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, charity:charities(id, name)')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

/** Cancel through the authenticated server endpoint. */
export async function cancelSubscription(subscription) {
  if (!subscription?.id) {
    throw new Error('A valid subscription is required.')
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError || !session?.access_token) {
    throw new Error('Please log in again to cancel your subscription.')
  }

  const res = await fetch('/api/cancel-subscription', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      subscriptionId: subscription.id,
    }),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data.error ?? 'Could not cancel subscription.')
  }

  return data
}

export function formatCents(cents, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format((cents ?? 0) / 100)
}

