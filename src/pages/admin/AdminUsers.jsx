import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { formatCents } from '../../lib/subscriptions'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*, subscription:subscriptions(status, plan, amount_cents)')
      .order('created_at', { ascending: false })
    setUsers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toggleRole = async (u) => {
    const newRole = u.role === 'admin' ? 'subscriber' : 'admin'
    await supabase.from('profiles').update({ role: newRole }).eq('id', u.id)
    load()
  }

  const setSubStatus = async (u, status) => {
    const sub = Array.isArray(u.subscription) ? u.subscription[0] : u.subscription
    if (!sub) return
    await supabase.from('subscriptions').update({ status }).eq('user_id', u.id)
    load()
  }

  const filtered = users.filter((u) =>
    `${u.full_name} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <input
        type="search"
        placeholder="Search users by name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ maxWidth: 320, marginBottom: 20 }}
      />
      {loading ? (
        <p>Loading…</p>
      ) : (
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Plan</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const sub = Array.isArray(u.subscription) ? u.subscription[0] : u.subscription
              return (
                <tr key={u.id}>
                  <td>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td><span className="tag">{u.role}</span></td>
                  <td>{sub ? `${sub.plan} (${formatCents(sub.amount_cents)})` : '—'}</td>
                  <td>
                    {sub ? (
                      <select value={sub.status} onChange={(e) => setSubStatus(u, e.target.value)}>
                        <option value="active">active</option>
                        <option value="inactive">inactive</option>
                        <option value="cancelled">cancelled</option>
                        <option value="lapsed">lapsed</option>
                      </select>
                    ) : '—'}
                  </td>
                  <td>
                    <button className="btn-ghost btn-sm" onClick={() => toggleRole(u)}>
                      {u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <style>{`.btn-sm { padding: 0.35em 0.8em; font-size: 0.78rem; }`}</style>
    </div>
  )
}
