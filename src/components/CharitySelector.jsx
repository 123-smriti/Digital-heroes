import { useEffect, useState } from 'react'
import { fetchCharities } from '../lib/charities'
import { MIN_CHARITY_PERCENT } from '../lib/subscriptions'

export default function CharitySelector({ value, percent, onChange, onPercentChange }) {
  const [charities, setCharities] = useState([])

  useEffect(() => {
    fetchCharities().then(setCharities).catch(() => {})
  }, [])

  return (
    <div className="charity-selector">
      <div className="field">
        <label htmlFor="charity">Charity you're backing</label>
        <select id="charity" value={value ?? ''} onChange={(e) => onChange(e.target.value)} required>
          <option value="" disabled>Choose a charity</option>
          {charities.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="charity-percent">
          Share of your subscription that goes to them: {percent}%
        </label>
        <input
          id="charity-percent"
          type="range"
          min={MIN_CHARITY_PERCENT}
          max={100}
          step={1}
          value={percent}
          onChange={(e) => onPercentChange(Number(e.target.value))}
        />
        <p className="charity-hint">Minimum {MIN_CHARITY_PERCENT}% — raise it any time.</p>
      </div>
      <style>{`
        .charity-hint { font-size: 0.8rem; color: var(--ink-faint); margin: 6px 0 0; }
        input[type="range"] { accent-color: var(--terracotta); padding: 0; }
      `}</style>
    </div>
  )
}
