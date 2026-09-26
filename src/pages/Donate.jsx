import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { fetchCharities, fetchCharity } from '../lib/charities'
import { formatCents } from '../lib/subscriptions'

const PRESET_AMOUNTS = [500, 1000, 2500, 5000] // cents

export default function Donate() {
  const { charityId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [charities, setCharities] = useState([])
  const [selectedId, setSelectedId] = useState(charityId ?? '')
  const [amountCents, setAmountCents] = useState(1000)
  const [customAmount, setCustomAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (charityId) {
      fetchCharity(charityId).then((c) => setSelectedId(c.id)).catch(() => {})
    }
    fetchCharities().then(setCharities).catch(() => {})
  }, [charityId])

  const finalAmount = customAmount ? Math.round(Number(customAmount) * 100) : amountCents

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!selectedId) {
      setError('Choose a charity to donate to.')
      return
    }
    if (!finalAmount || finalAmount < 100) {
      setError('Minimum donation is $1.')
      return
    }
    setSubmitting(true)
    try {
      // Real card capture belongs here via Stripe before persisting — same
      // stub pattern as src/lib/subscriptions.js.
      const { error: insertError } = await supabase.from('donations').insert({
        user_id: user?.id ?? null,
        charity_id: selectedId,
        amount_cents: finalAmount,
      })
      if (insertError) throw insertError
      setDone(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    const charity = charities.find((c) => c.id === selectedId)
    return (
      <div className="container donate-page">
        <p className="eyebrow">Thank you</p>
        <h1>{formatCents(finalAmount)} sent{charity ? ` to ${charity.name}` : ''}.</h1>
        <p>This is separate from any subscription — it doesn't affect your draw entries.</p>
        <Link to="/charities" className="btn-ghost">Back to charities</Link>
      </div>
    )
  }

  return (
    <div className="container donate-page">
      <p className="eyebrow">Direct donation</p>
      <h1>Give directly — no subscription needed.</h1>
      <p>This is a one-off donation, independent of the draw and separate from any subscription fee.</p>

      <form onSubmit={handleSubmit} className="card donate-form">
        <div className="field">
          <label htmlFor="charity">Charity</label>
          <select id="charity" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} required>
            <option value="" disabled>Choose a charity</option>
            {charities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Amount</label>
          <div className="amount-options">
            {PRESET_AMOUNTS.map((a) => (
              <button
                type="button"
                key={a}
                className={`amount-option ${!customAmount && amountCents === a ? 'selected' : ''}`}
                onClick={() => { setAmountCents(a); setCustomAmount('') }}
              >
                {formatCents(a)}
              </button>
            ))}
          </div>
          <input
            type="number"
            min="1"
            step="1"
            placeholder="Or enter a custom amount ($)"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            className="custom-amount-input"
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Processing…' : `Donate ${formatCents(finalAmount || 0)}`}
        </button>
        {!user && (
          <p className="guest-note">
            Donating as a guest. <button type="button" className="link-btn" onClick={() => navigate('/signup')}>Create an account</button> to track your giving.
          </p>
        )}
      </form>

      <style>{`
        .donate-page { padding: 64px 24px 96px; max-width: 560px; }
        .donate-form { margin-top: 28px; }
        .amount-options { display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
        .amount-option {
          background: var(--bg-inset); border: 1px solid var(--line); border-radius: var(--radius-sm);
          padding: 0.6em 1em; color: var(--ink);
        }
        .amount-option.selected { border-color: var(--terracotta); color: var(--terracotta-bright); }
        .custom-amount-input { margin-top: 4px; }
        .guest-note { font-size: 0.85rem; color: var(--ink-faint); margin-top: 14px; }
        .link-btn { background: none; border: none; padding: 0; color: var(--green-bright); text-decoration: underline; font-family: inherit; font-size: inherit; cursor: pointer; }
      `}</style>
    </div>
  )
}
