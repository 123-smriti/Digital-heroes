/** Calls our own /api/create-checkout-session (Vercel serverless function)
 *  and returns the Stripe-hosted Checkout URL to redirect the browser to.
 *  No Stripe secret ever touches the client — only the resulting URL does. */
export async function createCheckoutSession({ plan, charityId, charityPercent, userId, userEmail }) {
  const res = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan,
      charityId,
      charityPercent,
      userId,
      userEmail,
      siteUrl: window.location.origin,
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error ?? 'Could not start checkout — please try again.')
  }
  return data.url
}
