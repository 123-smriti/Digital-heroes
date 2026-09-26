import { useState } from 'react'
import AdminUsers from './AdminUsers'
import AdminDraws from './AdminDraws'
import AdminCharities from './AdminCharities'
import AdminWinners from './AdminWinners'
import AdminReports from './AdminReports'

const TABS = [
  { key: 'reports', label: 'Reports', Component: AdminReports },
  { key: 'users', label: 'Users', Component: AdminUsers },
  { key: 'draws', label: 'Draws', Component: AdminDraws },
  { key: 'charities', label: 'Charities', Component: AdminCharities },
  { key: 'winners', label: 'Winners', Component: AdminWinners },
]

export default function AdminDashboard() {
  const [active, setActive] = useState('reports')
  const ActiveComponent = TABS.find((t) => t.key === active)?.Component

  return (
    <div className="container admin-page">
      <p className="eyebrow">Admin</p>
      <h1>Control room</h1>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`tab ${active === t.key ? 'active' : ''}`} onClick={() => setActive(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <ActiveComponent />

      <style>{`.admin-page { padding: 48px 24px 96px; }`}</style>
    </div>
  )
}
