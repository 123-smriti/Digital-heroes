import { supabase } from './supabaseClient'

export const SCORE_MIN = 1
export const SCORE_MAX = 45
export const MAX_STORED_SCORES = 5

export function validateScore(score) {
  const n = Number(score)
  if (!Number.isInteger(n)) return 'Score must be a whole number.'
  if (n < SCORE_MIN || n > SCORE_MAX) return `Score must be between ${SCORE_MIN} and ${SCORE_MAX}.`
  return null
}

/** Latest 5 scores, most recent first. The DB trigger keeps only 5 rows per user. */
export async function fetchScores(userId) {
  const { data, error } = await supabase
    .from('scores')
    .select('*')
    .eq('user_id', userId)
    .order('played_on', { ascending: false })
  if (error) throw error
  return data
}

/** Adds a new score for a date. Duplicate dates must be edited, not re-added. */
export async function addScore(userId, { score, playedOn }) {
  const validationError = validateScore(score)
  if (validationError) throw new Error(validationError)

  const { data: existing } = await supabase
    .from('scores')
    .select('id')
    .eq('user_id', userId)
    .eq('played_on', playedOn)
    .maybeSingle()

  if (existing) {
    throw new Error('A score is already recorded for that date — edit it instead of adding a new one.')
  }

  const { error } = await supabase
    .from('scores')
    .insert({ user_id: userId, score, played_on: playedOn })
  if (error) throw error
}

export async function updateScore(scoreId, { score, playedOn }) {
  const validationError = validateScore(score)
  if (validationError) throw new Error(validationError)

  const { error } = await supabase
    .from('scores')
    .update({ score, played_on: playedOn })
    .eq('id', scoreId)
  if (error) throw error
}

export async function deleteScore(scoreId) {
  const { error } = await supabase.from('scores').delete().eq('id', scoreId)
  if (error) throw error
}

/** Simple average used to weight algorithmic draws — lower Stableford-adjacent
 *  score volatility is not modelled here; we use mean score as the weighting
 *  signal per PRD §06 ("weighted by score frequency"). */
export function averageScore(scores) {
  if (!scores.length) return null
  return scores.reduce((sum, s) => sum + s.score, 0) / scores.length
}
