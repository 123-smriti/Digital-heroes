import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, profile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link to="/" className="nav-logo">
          digital<span className="accent-serif">.heroes</span>
        </Link>
        <nav className="nav-links">
          <NavLink to="/charities">Charities</NavLink>
          <NavLink to="/donate">Donate</NavLink>
          <NavLink to="/draws">Draws</NavLink>
          {user ? (
            <>
              <NavLink to={isAdmin ? '/admin' : '/dashboard'}>
                {isAdmin ? 'Admin' : 'Dashboard'}
              </NavLink>
              <span className="nav-name">{profile?.full_name?.split(' ')[0]}</span>
              <button className="btn-ghost" onClick={handleSignOut}>Sign out</button>
            </>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <Link to="/subscribe" className="btn-primary nav-cta">Subscribe</Link>
            </>
          )}
        </nav>
      </div>
      <style>{`
        .nav { border-bottom: 1px solid var(--line); position: sticky; top: 0; background: rgba(11,18,32,0.92); backdrop-filter: blur(6px); z-index: 20; }
        .nav-inner { display: flex; align-items: center; justify-content: space-between; height: 68px; }
        .nav-logo { font-family: var(--font-display); font-weight: 700; font-size: 1.15rem; letter-spacing: -0.01em; }
        .nav-links { display: flex; align-items: center; gap: 22px; font-size: 0.92rem; color: var(--ink-dim); }
        .nav-links a.active { color: var(--ink); }
        .nav-links a:hover { color: var(--ink); }
        .nav-name { color: var(--ink-faint); font-size: 0.85rem; }
        .nav-cta { padding: 0.5em 1.1em; }
        @media (max-width: 640px) { .nav-links { gap: 12px; font-size: 0.82rem; } .nav-name { display: none; } }
      `}</style>
    </header>
  )
}
