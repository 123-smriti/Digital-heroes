import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import ScoreEntry from '../components/ScoreEntry'
import { fetchMySubscription, formatCents, charityContribution, cancelSubscription } from '../lib/subscriptions'
import { uploadWinnerProof } from '../lib/storage'

const TABS = ['Overview', 'Scores', 'Charity', 'Winnings']

export default function Dashboard() {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState('Overview')
  const [subscription, setSubscription] = useState(null)
  const [entries, setEntries] = useState([])
  const [winners, setWinners] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const [sub, entryRows, winnerRows] = await Promise.all([
      fetchMySubscription(user.id),
      supabase.from('draw_entries').select('*, draw:draws(draw_month, state)').eq('user_id', user.id),
      supabase.from('winners').select('*, draw:draws(draw_month)').eq('user_id', user.id),
    ])
    setSubscription(sub)
    setEntries(entryRows.data ?? [])
    setWinners(winnerRows.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  const handleCancel = async () => {
    if (!subscription) return
    if (!confirm('Cancel your subscription? You will keep access until the current period ends.')) return
    await cancelSubscription(subscription)
    load()
  }

  const totalWon = winners.reduce((sum, w) => sum + w.amount_cents, 0)
  const upcomingEntries = entries.filter((e) => e.draw?.state !== 'published')
  const isActiveSubscriber = subscription?.status === 'active'

  const handleProofUpload = async (winnerId, file) => {
    if (!file) return
    try {
      await uploadWinnerProof(winnerId, file)
      load()
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div className="container dashboard-page">
      <p className="eyebrow">Your dashboard</p>
      <h1>Hey {profile?.full_name?.split(' ')[0] ?? 'there'}.</h1>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Loading your data…</p>
      ) : (
        <>
          {tab === 'Overview' && (
            <div className="grid-2">
              <div className="card">
                <h3>Subscription</h3>
                {subscription ? (
                  <>
                    <p>
                      <span className={`tag ${subscription.status === 'active' ? 'tag-active' : 'tag-pending'}`}>
                        {subscription.status}
                      </span>
                    </p>
                    <p>Plan: {subscription.plan}</p>
                    <p>Renews: {subscription.renews_at ? new Date(subscription.renews_at).toLocaleDateString() : '—'}</p>
                    {subscription.status === 'active' && (
                      <button className="btn-ghost btn-sm" onClick={handleCancel}>Cancel subscription</button>
                    )}
                  </>
                ) : (
                  <>
                    <p>You're not subscribed yet.</p>
                    <Link to="/subscribe" className="btn-primary btn-sm">Subscribe</Link>
                  </>
                )}
              </div>
              <div className="card">
                <h3>Participation</h3>
                <p>{entries.length} draw{entries.length === 1 ? '' : 's'} entered</p>
                <p>{upcomingEntries.length} upcoming</p>
              </div>
            </div>
          )}

          {tab === 'Scores' && (
            isActiveSubscriber ? (
              <div className="card">
                <h3>Your last 5 rounds</h3>
                <ScoreEntry />
              </div>
            ) : (
              <SubscriberGate />
            )
          )}

          {tab === 'Charity' && (
            isActiveSubscriber ? (
              <div className="card">
                <h3>Charity you're backing</h3>
                {subscription?.charity ? (
                  <>
                    <p>{subscription.charity.name}</p>
                    <p>{subscription.charity_percent}% of your subscription — {formatCents(charityContribution(subscription.amount_cents, subscription.charity_percent))} per cycle.</p>
                    <Link to={`/charities/${subscription.charity.id}`} className="btn-ghost btn-sm">View charity</Link>
                  </>
                ) : (
                  <p>No charity selected yet — subscribe to pick one.</p>
                )}
              </div>
            ) : (
              <SubscriberGate />
            )
          )}

          {tab === 'Winnings' && (
            isActiveSubscriber ? (
              <div className="card">
                <h3>Total won: {formatCents(totalWon)}</h3>
              {winners.length === 0 ? (
                <p>No wins yet — stay in the draw.</p>
              ) : (
                <table>
                  <thead><tr><th>Draw</th><th>Tier</th><th>Amount</th><th>Proof</th><th>Status</th></tr></thead>
                  <tbody>
                    {winners.map((w) => (
                      <tr key={w.id}>
                        <td>{w.draw?.draw_month}</td>
                        <td>{w.tier.replace('_', '-')}</td>
                        <td>{formatCents(w.amount_cents)}</td>
                        <td>
                          {w.proof_url ? (
                            <span className="tag tag-active">Uploaded</span>
                          ) : (
                            <label className="upload-label">
                              Upload screenshot
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={(e) => handleProofUpload(w.id, e.target.files?.[0])}
                              />
                            </label>
                          )}
                        </td>
                        <td><span className={`tag ${w.payout_status === 'paid' ? 'tag-active' : 'tag-pending'}`}>{w.payout_status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              </div>
            ) : (
              <SubscriberGate />
            )
          )}
        </>
      )}

      <style>{`
        .dashboard-page { padding: 48px 24px 96px; }
        .btn-sm { padding: 0.4em 0.9em; font-size: 0.82rem; margin-top: 6px; }
        .upload-label { color: var(--terracotta-bright); font-size: 0.85rem; cursor: pointer; text-decoration: underline; }
      `}</style>
    </div>
  )
}

function SubscriberGate() {
  return (
    <div className="card gate-card">
      <h3>Subscribers only</h3>
      <p>This section unlocks once you have an active subscription.</p>
      <Link to="/subscribe" className="btn-primary btn-sm">Subscribe now</Link>
      <style>{`.gate-card { text-align: left; }`}</style>
    </div>
  )
}
