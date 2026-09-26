import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import CharitySelector from '../components/CharitySelector'
import { PLAN_PRICE_CENTS, MIN_CHARITY_PERCENT, formatCents, charityContribution } from '../lib/subscriptions'
import { createCheckoutSession } from '../lib/stripe'

export default function Subscribe() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [plan, setPlan] = useState('monthly')
  const [charityId, setCharityId] = useState('')
  const [charityPercent, setCharityPercent] = useState(MIN_CHARITY_PERCENT)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const amount = PLAN_PRICE_CENTS[plan]

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user) {
      navigate('/signup')
      return
    }
    if (!charityId) {
      setError('Choose a charity to back.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      // Redirects to Stripe Checkout. The subscription row itself is only
      // written once Stripe confirms payment, by api/stripe-webhook.js —
      // never trust the client for that.
      const url = await createCheckoutSession({
        plan,
        charityId,
        charityPercent,
        userId: user.id,
        userEmail: user.email,
      })
      window.location.href = url
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div className="container subscribe-page">
      <p className="eyebrow">Subscribe</p>
      <h1>Pick a plan, pick a cause.</h1>

      <form onSubmit={handleSubmit} className="subscribe-grid">
        <div className="card">
          <h3>Plan</h3>
          <div className="plan-options">
            <button type="button" className={`plan-option ${plan === 'monthly' ? 'selected' : ''}`}
              onClick={() => setPlan('monthly')}>
              <strong>Monthly</strong>
              <span>{formatCents(PLAN_PRICE_CENTS.monthly)} / mo</span>
            </button>
            <button type="button" className={`plan-option ${plan === 'yearly' ? 'selected' : ''}`}
              onClick={() => setPlan('yearly')}>
              <strong>Yearly</strong>
              <span>{formatCents(PLAN_PRICE_CENTS.yearly)} / yr</span>
              <span className="plan-save">Save vs. monthly</span>
            </button>
          </div>
        </div>

        <div className="card">
          <h3>Charity</h3>
          <CharitySelector
            value={charityId}
            percent={charityPercent}
            onChange={setCharityId}
            onPercentChange={setCharityPercent}
          />
          <p className="contribution-preview">
            → {formatCents(charityContribution(amount, charityPercent))} of every payment goes to them.
          </p>
        </div>

        {error && <p className="error-text">{error}</p>}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Setting up…' : user ? 'Confirm subscription' : 'Create account to subscribe'}
        </button>
      </form>

      <style>{`
        .subscribe-page { padding: 64px 24px 96px; max-width: 640px; }
        .subscribe-grid { display: flex; flex-direction: column; gap: 20px; margin-top: 28px; }
        .plan-options { display: flex; gap: 14px; }
        .plan-option {
          flex: 1; background: var(--bg-inset); border: 1px solid var(--line); border-radius: var(--radius-sm);
          padding: 16px; display: flex; flex-direction: column; gap: 4px; text-align: left; color: var(--ink);
        }
        .plan-option.selected { border-color: var(--terracotta); }
        .plan-option span { color: var(--ink-dim); font-size: 0.85rem; font-family: var(--font-body); font-weight: 400; }
        .plan-save { color: var(--green-bright) !important; }
        .contribution-preview { font-size: 0.88rem; color: var(--green-bright); margin-top: 12px; }
      `}</style>
    </div>
  )
}
