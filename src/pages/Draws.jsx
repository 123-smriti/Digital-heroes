import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatCents } from '../lib/subscriptions'

export default function Draws() {
  const [draws, setDraws] = useState([])

  useEffect(() => {
    supabase
      .from('draws')
      .select('*')
      .eq('state', 'published')
      .order('draw_month', { ascending: false })
      .then(({ data }) => setDraws(data ?? []))
  }, [])

  return (
    <div className="container draws-page">
      <p className="eyebrow">How it works</p>
      <h1>Monthly draws</h1>
      <p>
        Every active subscriber gets a set of numbers entered into that month's draw. Match
        3, 4 or all 5 against the winning combination to take a share of that tier's pool.
        Unclaimed jackpots roll into next month.
      </p>

      <h2 className="past-heading">Past results</h2>
      {draws.length === 0 ? (
        <p>No draws have been published yet — check back after the next monthly cycle.</p>
      ) : (
        <div className="draw-list">
          {draws.map((d) => (
            <div key={d.id} className="card draw-card">
              <div className="draw-card-top">
                <h3>{d.draw_month}</h3>
                <span className="tag tag-active">{d.mode}</span>
              </div>
              <div className="draw-numbers">
                {d.winning_numbers.map((n) => (
                  <span key={n} className="draw-ball">{n}</span>
                ))}
              </div>
              <p className="draw-pool">Total pool: {formatCents(d.total_prize_pool_cents)}</p>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .draws-page { padding: 64px 24px 96px; max-width: 760px; }
        .past-heading { margin-top: 48px; }
        .draw-list { display: flex; flex-direction: column; gap: 16px; }
        .draw-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .draw-numbers { display: flex; gap: 8px; margin-bottom: 10px; }
        .draw-ball {
          width: 36px; height: 36px; border-radius: 50%;
          background: var(--bg-inset); border: 1px solid var(--line);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display); font-weight: 600; font-size: 0.85rem;
        }
        .draw-pool { color: var(--ink-faint); font-size: 0.85rem; margin: 0; }
      `}</style>
    </div>
  )
}
