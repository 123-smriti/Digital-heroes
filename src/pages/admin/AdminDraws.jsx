import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { simulateDraw, publishDraw } from '../../lib/draws'
import { formatCents } from '../../lib/subscriptions'

const currentMonthStr = () => new Date().toISOString().slice(0, 7) + '-01'

export default function AdminDraws() {
  const { user } = useAuth()
  const [draws, setDraws] = useState([])
  const [mode, setMode] = useState('random')
  const [poolCents, setPoolCents] = useState(500000)
  const [creating, setCreating] = useState(false)
  const [simResult, setSimResult] = useState(null)
  const [simDrawId, setSimDrawId] = useState(null)
  const [error, setError] = useState(null)

  const load = async () => {
    const { data } = await supabase.from('draws').select('*').order('draw_month', { ascending: false })
    setDraws(data ?? [])
  }

  useEffect(() => { load() }, [])

  const handleCreateDraw = async (e) => {
    e.preventDefault()
    setError(null)
    setCreating(true)
    try {
      const { count } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

      // Carry forward an unclaimed jackpot: find the most recent published
      // draw, and if nobody hit a 5-number match, roll its 5-tier pool
      // (plus whatever it had already rolled in) into this new draw.
      let jackpotRolloverCents = 0
      const { data: lastDraw } = await supabase
        .from('draws')
        .select('id, pool_5_cents, jackpot_rollover_cents')
        .eq('state', 'published')
        .order('draw_month', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lastDraw) {
        const { count: fiveMatchWinners } = await supabase
          .from('winners')
          .select('*', { count: 'exact', head: true })
          .eq('draw_id', lastDraw.id)
          .eq('tier', '5_number')
        if (!fiveMatchWinners) {
          jackpotRolloverCents = (lastDraw.pool_5_cents ?? 0) + (lastDraw.jackpot_rollover_cents ?? 0)
        }
      }

      const { error } = await supabase.from('draws').insert({
        draw_month: currentMonthStr(),
        mode,
        total_prize_pool_cents: poolCents,
        active_subscriber_count: count ?? 0,
        jackpot_rollover_cents: jackpotRolloverCents,
        created_by: user.id,
      })
      if (error) throw error
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  const handleSimulate = async (drawId, drawMode) => {
    setError(null)
    try {
      const result = await simulateDraw({ drawId, mode: drawMode })
      setSimResult(result)
      setSimDrawId(drawId)
    } catch (e) {
      setError(e.message)
    }
  }

  const handlePublish = async () => {
    if (!simResult || !simDrawId) return
    try {
      await publishDraw({ drawId: simDrawId, simulation: simResult, adminId: user.id })
      setSimResult(null)
      setSimDrawId(null)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div>
      <form onSubmit={handleCreateDraw} className="card new-draw-form">
        <h3>Create this month's draw</h3>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="mode">Draw logic</label>
            <select id="mode" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="random">Random</option>
              <option value="algorithmic">Algorithmic (weighted by score frequency)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="pool">Total prize pool (cents)</label>
            <input id="pool" type="number" min={0} value={poolCents}
              onChange={(e) => setPoolCents(Number(e.target.value))} />
          </div>
        </div>
        <button type="submit" className="btn-primary" disabled={creating}>
          {creating ? 'Creating…' : 'Create draft draw'}
        </button>
      </form>
      {error && <p className="error-text">{error}</p>}

      {simResult && (
        <div className="card sim-card">
          <h3>Simulation result</h3>
          <p>Winning numbers: <strong>{simResult.winningNumbers.join(', ')}</strong></p>
          <table>
            <thead><tr><th>Tier</th><th>Winners</th><th>Payout each</th></tr></thead>
            <tbody>
              <tr><td>5-match</td><td>{simResult.winnersByTier.five.length}</td><td>{formatCents(simResult.payouts.five)}</td></tr>
              <tr><td>4-match</td><td>{simResult.winnersByTier.four.length}</td><td>{formatCents(simResult.payouts.four)}</td></tr>
              <tr><td>3-match</td><td>{simResult.winnersByTier.three.length}</td><td>{formatCents(simResult.payouts.three)}</td></tr>
            </tbody>
          </table>
          {simResult.jackpotRollsOver && <p className="tag tag-pending">Jackpot rolls over — no 5-match winner</p>}
          <div className="sim-actions">
            <button className="btn-primary" onClick={handlePublish}>Publish results</button>
            <button className="btn-ghost" onClick={() => { setSimResult(null); setSimDrawId(null) }}>Discard</button>
          </div>
        </div>
      )}

      <h3 className="draws-heading">All draws</h3>
      <table>
        <thead><tr><th>Month</th><th>Mode</th><th>State</th><th>Pool</th><th>Rollover in</th><th></th></tr></thead>
        <tbody>
          {draws.map((d) => (
            <tr key={d.id}>
              <td>{d.draw_month}</td>
              <td>{d.mode}</td>
              <td><span className={`tag ${d.state === 'published' ? 'tag-active' : 'tag-pending'}`}>{d.state}</span></td>
              <td>{formatCents(d.total_prize_pool_cents)}</td>
              <td>{d.jackpot_rollover_cents ? formatCents(d.jackpot_rollover_cents) : '—'}</td>
              <td>
                {d.state !== 'published' && (
                  <button className="btn-ghost btn-sm" onClick={() => handleSimulate(d.id, d.mode)}>Simulate</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <style>{`
        .new-draw-form { margin-bottom: 24px; }
        .new-draw-form h3 { margin-bottom: 16px; }
        .sim-card { margin-bottom: 32px; }
        .sim-actions { display: flex; gap: 10px; margin-top: 16px; }
        .draws-heading { margin-top: 8px; }
        .btn-sm { padding: 0.35em 0.8em; font-size: 0.78rem; }
      `}</style>
    </div>
  )
}
