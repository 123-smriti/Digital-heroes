import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchCharity } from '../lib/charities'

export default function CharityDetail() {
  const { id } = useParams()
  const [charity, setCharity] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchCharity(id).then(setCharity).catch((e) => setError(e.message))
  }, [id])

  if (error) return <div className="container detail-page"><p className="error-text">{error}</p></div>
  if (!charity) return <div className="container detail-page"><p>Loading…</p></div>

  return (
    <div className="container detail-page">
      <p className="eyebrow">Charity profile</p>
      <h1>{charity.name}</h1>
      <p className="detail-desc">{charity.description}</p>

      {charity.upcoming_event_name && (
        <div className="card detail-event">
          <p className="eyebrow">Upcoming event</p>
          <h3>{charity.upcoming_event_name}</h3>
          {charity.upcoming_event_date && <p>{charity.upcoming_event_date}</p>}
        </div>
      )}

      <div className="detail-actions">
        <Link to="/subscribe" className="btn-primary">Subscribe and back {charity.name}</Link>
        <Link to={`/donate/${charity.id}`} className="btn-ghost">Donate directly (no subscription)</Link>
      </div>

      <style>{`
        .detail-page { padding: 64px 24px 96px; max-width: 700px; }
        .detail-desc { font-size: 1.05rem; }
        .detail-event { margin: 24px 0 32px; max-width: 400px; }
        .detail-actions { display: flex; gap: 12px; flex-wrap: wrap; }
      `}</style>
    </div>
  )
}
