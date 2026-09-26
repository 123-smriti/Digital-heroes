// Vercel Serverless Function: POST /api/create-checkout-session
// Creates a Stripe Checkout session in subscription mode. The actual
// subscription row is written by /api/stripe-webhook once payment succeeds —
// this endpoint just starts the checkout, it never touches the database.
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const PLAN_PRICE_CENTS = { monthly: 1500, yearly: 15000 }
const PLAN_INTERVAL = { monthly: 'month', yearly: 'year' }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({
      error: 'Stripe is not configured on the server (STRIPE_SECRET_KEY missing).',
    })
  }

  try {
    const { plan, charityId, charityPercent, userId, userEmail, siteUrl } = req.body ?? {}

    if (!plan || !PLAN_PRICE_CENTS[plan]) {
      return res.status(400).json({ error: 'Invalid plan.' })
    }
    if (!charityId || !userId || !userEmail) {
      return res.status(400).json({ error: 'Missing charityId, userId, or userEmail.' })
    }

    const origin = siteUrl || req.headers.origin || 'http://localhost:5173'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: userEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: PLAN_PRICE_CENTS[plan],
            recurring: { interval: PLAN_INTERVAL[plan] },
            product_data: {
              name: `Digital Heroes — ${plan} subscription`,
            },
          },
          quantity: 1,
        },
      ],
      // Everything the webhook needs to write the subscription row lives in
      // metadata, since Checkout sessions don't carry our app's user/charity
      // ids natively.
      metadata: {
        userId,
        charityId,
        charityPercent: String(charityPercent),
        plan,
      },
      subscription_data: {
        metadata: { userId, charityId, charityPercent: String(charityPercent), plan },
      },
      success_url: `${origin}/dashboard?checkout=success`,
      cancel_url: `${origin}/subscribe?checkout=cancelled`,
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('create-checkout-session error:', err)
    return res.status(500).json({ error: err.message })
  }
}
