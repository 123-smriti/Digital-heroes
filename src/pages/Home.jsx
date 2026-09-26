import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { fetchFeaturedCharity } from '../lib/charities'

export default function Home() {
  const [charity, setCharity] = useState(null)

  useEffect(() => {
    fetchFeaturedCharity().then(setCharity).catch(() => {})
  }, [])

  return (
    <div className="home">
      <section className="hero container">
        <p className="eyebrow">A round of golf, a chance to win, a cause that gets paid either way</p>
        <h1>
          Play your round.<br />
          <span className="accent-serif">Back a cause.</span><br />
          Win in between.
        </h1>
        <p className="hero-copy">
          Log your last five scores, get entered into a monthly draw funded by every
          subscriber on the platform, and send a real share of your fee to a charity
          you pick — win or lose.
        </p>
        <div className="hero-actions">
          <Link to="/subscribe" className="btn-primary">Start subscribing</Link>
          <Link to="/charities" className="btn-ghost">See the charities</Link>
        </div>
      </section>

      <section className="steps container">
        <div className="step">
          <span className="step-num">1</span>
          <h3>Log your scores</h3>
          <p>Enter your last five Stableford rounds. Each new one bumps the oldest.</p>
        </div>
        <div className="step">
          <span className="step-num">2</span>
          <h3>Pick a charity</h3>
          <p>At least 10% of your subscription goes straight to a cause you choose.</p>
        </div>
        <div className="step">
          <span className="step-num">3</span>
          <h3>Enter the draw</h3>
          <p>Every active subscriber is in the monthly pool — three ways to match, three ways to win.</p>
        </div>
      </section>

      {charity && (
        <section className="spotlight container">
          <div className="card spotlight-card">
            <p className="eyebrow">This month's featured charity</p>
            <h2>{charity.name}</h2>
            <p>{charity.description}</p>
            {charity.upcoming_event_name && (
              <p className="spotlight-event">
                Upcoming: {charity.upcoming_event_name}
                {charity.upcoming_event_date ? ` — ${charity.upcoming_event_date}` : ''}
              </p>
            )}
            <Link to={`/charities/${charity.id}`} className="btn-ghost">View charity</Link>
          </div>
        </section>
      )}

      <section className="pool container">
        <h2>Where the prize pool goes</h2>
        <div className="grid-3">
          <div className="card pool-card">
            <span className="pool-pct">40%</span>
            <h3>5-number match</h3>
            <p>The jackpot tier. Unclaimed pots roll into next month.</p>
          </div>
          <div className="card pool-card">
            <span className="pool-pct">35%</span>
            <h3>4-number match</h3>
            <p>Split evenly among everyone who lands four.</p>
          </div>
          <div className="card pool-card">
            <span className="pool-pct">25%</span>
            <h3>3-number match</h3>
            <p>The most common win — still real money, every month.</p>
          </div>
        </div>
      </section>

      <style>{`
        .hero { padding: 96px 24px 72px; max-width: 780px; }
        .hero-copy { font-size: 1.08rem; margin-top: 18px; }
        .hero-actions { display: flex; gap: 14px; margin-top: 30px; }
        .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; padding: 40px 24px 80px; border-top: 1px solid var(--line); }
        .step-num { font-family: var(--font-serif); font-style: italic; font-size: 1.8rem; color: var(--terracotta-bright); display: block; margin-bottom: 10px; }
        .spotlight { padding-bottom: 80px; }
        .spotlight-card { max-width: 640px; }
        .spotlight-event { color: var(--ink-dim); font-size: 0.9rem; }
        .pool { padding-bottom: 96px; }
        .pool-card { text-align: left; }
        .pool-pct { font-family: var(--font-display); font-size: 2.2rem; font-weight: 700; color: var(--green-bright); display: block; margin-bottom: 8px; }
        @media (max-width: 760px) { .steps { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  )
}
