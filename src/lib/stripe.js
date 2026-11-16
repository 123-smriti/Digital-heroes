/** Calls our own /api/create-checkout-session (Vercel serverless function)
 *  and returns the Stripe-hosted Checkout URL to redirect the browser to.
 *  No Stripe secret ever touches the client — only the resulting URL does. */

import { supabase } from './supabaseClient'

export async function createCheckoutSession({
  plan,
  charityId,
  charityPercent,
}) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError || !session?.access_token) {
    throw new Error('Please log in before subscribing.')
  }

  const res = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      plan,
      charityId,
      charityPercent,
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(
      data.error ?? 'Could not start checkout. Please try again.'
    )
  }

  if (!data.url) {
    throw new Error('Stripe did not return a checkout URL.')
  }

  return data.url
}
