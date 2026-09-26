import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  fetchScores,
  addScore,
  updateScore,
  deleteScore,
  MAX_STORED_SCORES,
} from '../lib/scores'

const todayStr = () => new Date().toISOString().slice(0, 10)

export default function ScoreEntry() {
  const { user } = useAuth()
  const [scores, setScores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ score: '', playedOn: todayStr() })
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      setScores(await fetchScores(user.id))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetForm = () => {
    setForm({ score: '', playedOn: todayStr() })
    setEditingId(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      if (editingId) {
        await updateScore(editingId, { score: Number(form.score), playedOn: form.playedOn })
      } else {
        await addScore(user.id, { score: Number(form.score), playedOn: form.playedOn })
      }
      resetForm()
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (s) => {
    setEditingId(s.id)
    setForm({ score: String(s.score), playedOn: s.played_on })
  }

  const handleDelete = async (id) => {
    try {
      await deleteScore(id)
      if (editingId === id) resetForm()
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="score-entry">
      <form onSubmit={handleSubmit} className="score-form">
        <div className="field">
          <label htmlFor="score">Score (Stableford, 1–45)</label>
          <input
            id="score"
            type="number"
            min={1}
            max={45}
            required
            value={form.score}
            onChange={(e) => setForm({ ...form, score: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="played_on">Date played</label>
          <input
            id="played_on"
            type="date"
            required
            max={todayStr()}
            value={form.playedOn}
            onChange={(e) => setForm({ ...form, playedOn: e.target.value })}
          />
        </div>
        <div className="score-form-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Update score' : 'Add score'}
          </button>
          {editingId && (
            <button type="button" className="btn-ghost" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>
      {error && <p className="error-text">{error}</p>}

      <p className="score-hint">
        Only your latest {MAX_STORED_SCORES} rounds are kept — a new entry replaces the oldest.
      </p>

      {loading ? (
        <p>Loading scores…</p>
      ) : scores.length === 0 ? (
        <p>No rounds logged yet — add your first score above.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Date</th><th>Score</th><th></th></tr>
          </thead>
          <tbody>
            {scores.map((s) => (
              <tr key={s.id}>
                <td>{s.played_on}</td>
                <td>{s.score}</td>
                <td className="row-actions">
                  <button className="btn-ghost btn-sm" onClick={() => handleEdit(s)}>Edit</button>
                  <button className="btn-danger btn-sm" onClick={() => handleDelete(s.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <style>{`
        .score-form { display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 4px; }
        .score-form .field { margin-bottom: 0; min-width: 160px; }
        .score-form-actions { display: flex; gap: 10px; padding-bottom: 2px; }
        .score-hint { font-size: 0.85rem; color: var(--ink-faint); margin: 4px 0 18px; }
        .row-actions { display: flex; gap: 8px; }
        .btn-sm { padding: 0.4em 0.8em; font-size: 0.8rem; }
      `}</style>
    </div>
  )
}
