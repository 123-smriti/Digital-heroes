import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../../lib/supabaseClient'
import { formatCents } from '../../lib/subscriptions'

export default function AdminReports() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    const load = async () => {
      const [{ count: totalUsers }, subs, donationRows, draws] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('amount_cents, charity_percent, status'),
        supabase.from('donations').select('amount_cents'),
        supabase.from('draws').select('draw_month, total_prize_pool_cents, state').order('draw_month'),
      ])

      const activeSubs = (subs.data ?? []).filter((s) => s.status === 'active')
      const totalPrizePool = activeSubs.reduce((sum, s) => sum + s.amount_cents, 0)
      const charityFromSubs = activeSubs.reduce(
        (sum, s) => sum + Math.round((s.amount_cents * s.charity_percent) / 100),
        0
      )
      const directDonations = (donationRows.data ?? []).reduce((sum, d) => sum + d.amount_cents, 0)

      setStats({
        totalUsers: totalUsers ?? 0,
        activeSubscribers: activeSubs.length,
        totalPrizePool,
        charityTotal: charityFromSubs + directDonations,
        drawChart: (draws.data ?? []).map((d) => ({
          month: d.draw_month,
          pool: d.total_prize_pool_cents / 100,
        })),
      })
    }
    load()
  }, [])

  if (!stats) return <p>Loading reports…</p>

  return (
    <div>
      <div className="grid-3 stat-grid">
        <div className="card stat-card">
          <span className="stat-label">Total users</span>
          <span className="stat-value">{stats.totalUsers}</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Active subscribers</span>
          <span className="stat-value">{stats.activeSubscribers}</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Charity contributions (total)</span>
          <span className="stat-value">{formatCents(stats.charityTotal)}</span>
        </div>
      </div>

      <div className="card chart-card">
        <h3>Prize pool by month</h3>
        {stats.drawChart.length === 0 ? (
          <p>No draws recorded yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.drawChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#253248" />
              <XAxis dataKey="month" stroke="#a9b2c3" fontSize={12} />
              <YAxis stroke="#a9b2c3" fontSize={12} />
              <Tooltip contentStyle={{ background: '#121b2e', border: '1px solid #253248' }} />
              <Bar dataKey="pool" fill="#c9803f" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <style>{`
        .stat-grid { margin-bottom: 24px; }
        .stat-card { display: flex; flex-direction: column; gap: 8px; }
        .stat-label { font-size: 0.82rem; color: var(--ink-faint); }
        .stat-value { font-family: var(--font-display); font-size: 1.8rem; font-weight: 700; }
      `}</style>
    </div>
  )
}
