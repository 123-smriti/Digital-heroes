import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { formatCents } from '../../lib/subscriptions'

export default function AdminWinners() {
  const { user } = useAuth()
  const [winners, setWinners] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('winners')
      .select('*, profile:profiles(full_name, email), draw:draws(draw_month)')
      .order('created_at', { ascending: false })
    setWinners(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const verify = async (w, approve) => {
    await supabase
      .from('winners')
      .update({ verified: approve, verified_by: user.id, verified_at: new Date().toISOString() })
      .eq('id', w.id)
    load()
  }

  const markPaid = async (w) => {
    await supabase
      .from('winners')
      .update({ payout_status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', w.id)
    load()
  }

  if (loading) return <p>Loading…</p>

  return (
    <table>
      <thead>
        <tr><th>Winner</th><th>Draw</th><th>Tier</th><th>Amount</th><th>Proof</th><th>Verified</th><th>Payout</th><th></th></tr>
      </thead>
      <tbody>
        {winners.map((w) => (
          <tr key={w.id}>
            <td>{w.profile?.full_name}</td>
            <td>{w.draw?.draw_month}</td>
            <td>{w.tier.replace('_', '-')}</td>
            <td>{formatCents(w.amount_cents)}</td>
            <td>
              {w.proof_url ? (
                <a href={w.proof_url} target="_blank" rel="noreferrer">View</a>
              ) : (
                <span style={{ color: 'var(--ink-faint)' }}>Not uploaded</span>
              )}
            </td>
            <td>
              {w.verified ? (
                <span className="tag tag-active">Verified</span>
              ) : (
                <div className="verify-actions">
                  <button className="btn-ghost btn-sm" onClick={() => verify(w, true)}>Approve</button>
                  <button className="btn-danger btn-sm" onClick={() => verify(w, false)}>Reject</button>
                </div>
              )}
            </td>
            <td><span className={`tag ${w.payout_status === 'paid' ? 'tag-active' : 'tag-pending'}`}>{w.payout_status}</span></td>
            <td>
              {w.verified && w.payout_status !== 'paid' && (
                <button className="btn-primary btn-sm" onClick={() => markPaid(w)}>Mark paid</button>
              )}
            </td>
          </tr>
        ))}
        <style>{`
          .verify-actions { display: flex; gap: 6px; }
          .btn-sm { padding: 0.35em 0.8em; font-size: 0.78rem; }
        `}</style>
      </tbody>
    </table>
  )
}
