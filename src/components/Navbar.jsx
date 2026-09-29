import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, profile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link to="/" className="nav-logo" onClick={() => setOpen(false)}>
          digital<span className="accent-serif">.heroes</span>
        </Link>

        {/* Mobile-only menu toggle */}
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-label="Toggle menu"
          onClick={() => setOpen((o) => !o)}
        >
          <span className={`hamburger ${open ? 'is-open' : ''}`}>
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>

        {/* Clicking any link/button inside closes the mobile menu */}
        <nav className={`nav-links ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
          <NavLink to="/charities">Charities</NavLink>
          <NavLink to="/donate">Donate</NavLink>
          <NavLink to="/draws">Draws</NavLink>
          {user ? (
            <>
              <NavLink to={isAdmin ? '/admin' : '/dashboard'}>
                {isAdmin ? 'Admin' : 'Dashboard'}
              </NavLink>
              <span className="nav-name">Signed in as {profile?.full_name?.split(' ')[0]}</span>
              <button className="btn-ghost nav-signout" onClick={handleSignOut}>Sign out</button>
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
        .nav-toggle {
          display: none;
          background: none;
          border: none;
          padding: 8px;
          cursor: pointer;
        }
        .hamburger {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 5px;
          width: 22px;
          height: 16px;
        }
        .hamburger span {
          display: block;
          height: 2px;
          width: 100%;
          background: var(--ink);
          border-radius: 2px;
          transition: transform 0.2s ease, opacity 0.2s ease;
        }
        .hamburger.is-open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
        .hamburger.is-open span:nth-child(2) { opacity: 0; }
        .hamburger.is-open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

        @media (max-width: 760px) {
          .nav-toggle { display: inline-block; }
          .nav-links {
            display: none;
            position: absolute; top: 68px; left: 0; right: 0;
            flex-direction: column; align-items: stretch; gap: 0;
            padding: 8px 0 20px;
            background: var(--bg);
            border-bottom: 1px solid var(--line);
            font-size: 1.02rem;
            max-height: calc(100vh - 68px);
            overflow-y: auto;
          }
          .nav-links.open { display: flex; }
          .nav-links a {
            padding: 16px 24px;
            border-bottom: 1px solid var(--line);
          }
          .nav-name {
            padding: 14px 24px 6px;
            font-size: 0.8rem;
          }
          .nav-signout {
            margin: 10px 24px 0;
            width: auto;
            align-self: flex-start;
          }
          .nav-cta {
            margin: 14px 24px 0;
            width: calc(100% - 48px);
            text-align: center;
          }
        }
      `}</style>
    </header>
  )
}
