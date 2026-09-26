import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCharities } from '../lib/charities'

export default function Charities() {
  const [charities, setCharities] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => {
      fetchCharities({ search }).then(setCharities).finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [search])

  return (
    <div className="container charities-page">
      <p className="eyebrow">Directory</p>
      <h1>Charities on the platform</h1>
      <p>Every subscriber backs one of these — pick the cause you want your fee supporting.</p>

      <input
        type="search"
        placeholder="Search charities…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="charity-search"
      />

      {loading ? (
        <p>Loading…</p>
      ) : charities.length === 0 ? (
        <p>No charities match "{search}".</p>
      ) : (
        <div className="grid-3 charity-grid">
          {charities.map((c) => (
            <Link key={c.id} to={`/charities/${c.id}`} className="card charity-card">
              {c.is_featured && <span className="tag tag-active">Featured</span>}
              <h3>{c.name}</h3>
              <p>{c.description}</p>
            </Link>
          ))}
        </div>
      )}

      <style>{`
        .charities-page { padding: 64px 24px 96px; }
        .charity-search { max-width: 360px; margin: 28px 0 32px; }
        .charity-card { display: block; }
        .charity-card:hover { border-color: var(--ink-faint); }
        .charity-card .tag { margin-bottom: 10px; }
      `}</style>
    </div>
  )
}
