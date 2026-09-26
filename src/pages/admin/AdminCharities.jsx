import { useEffect, useState } from 'react'
import { fetchCharities, createCharity, updateCharity, deleteCharity } from '../../lib/charities'

const emptyForm = { name: '', description: '', image_url: '', is_featured: false, upcoming_event_name: '', upcoming_event_date: '' }

export default function AdminCharities() {
  const [charities, setCharities] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState(null)

  const load = () => fetchCharities().then(setCharities).catch((e) => setError(e.message))

  useEffect(() => { load() }, [])

  const resetForm = () => { setForm(emptyForm); setEditingId(null) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      const payload = {
        ...form,
        upcoming_event_name: form.upcoming_event_name || null,
        upcoming_event_date: form.upcoming_event_date || null,
      }
      if (editingId) await updateCharity(editingId, payload)
      else await createCharity(payload)
      resetForm()
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  const handleEdit = (c) => {
    setEditingId(c.id)
    setForm({
      name: c.name,
      description: c.description,
      image_url: c.image_url ?? '',
      is_featured: c.is_featured,
      upcoming_event_name: c.upcoming_event_name ?? '',
      upcoming_event_date: c.upcoming_event_date ?? '',
    })
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this charity?')) return
    await deleteCharity(id)
    load()
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="card charity-form">
        <h3>{editingId ? 'Edit charity' : 'Add charity'}</h3>
        <div className="field">
          <label>Name</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea required rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="field">
          <label>Image URL</label>
          <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Upcoming event name</label>
            <input value={form.upcoming_event_name} onChange={(e) => setForm({ ...form, upcoming_event_name: e.target.value })} />
          </div>
          <div className="field">
            <label>Upcoming event date</label>
            <input type="date" value={form.upcoming_event_date} onChange={(e) => setForm({ ...form, upcoming_event_date: e.target.value })} />
          </div>
        </div>
        <label className="checkbox-field">
          <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} />
          Feature on homepage
        </label>
        {error && <p className="error-text">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="btn-primary">{editingId ? 'Save changes' : 'Add charity'}</button>
          {editingId && <button type="button" className="btn-ghost" onClick={resetForm}>Cancel</button>}
        </div>
      </form>

      <table>
        <thead><tr><th>Name</th><th>Featured</th><th></th></tr></thead>
        <tbody>
          {charities.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.is_featured ? 'Yes' : ''}</td>
              <td className="row-actions">
                <button className="btn-ghost btn-sm" onClick={() => handleEdit(c)}>Edit</button>
                <button className="btn-danger btn-sm" onClick={() => handleDelete(c.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <style>{`
        .charity-form { margin-bottom: 28px; max-width: 560px; }
        .checkbox-field { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
        .checkbox-field input { width: auto; }
        .form-actions { display: flex; gap: 10px; }
        .row-actions { display: flex; gap: 8px; }
        .btn-sm { padding: 0.35em 0.8em; font-size: 0.78rem; }
      `}</style>
    </div>
  )
}
