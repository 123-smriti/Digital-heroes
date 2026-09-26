import { supabase } from './supabaseClient'

export const POOL_SHARE = {
  five: 0.4,
  four: 0.35,
  three: 0.25,
}

export const NUMBER_POOL_SIZE = 49 // numbers 1–49, five drawn per month
export const NUMBERS_DRAWN = 5

/** Splits the total collected prize pool into the three tiers (PRD §07). */
export function splitPool(totalCents, rolloverCents = 0) {
  const five = Math.round(totalCents * POOL_SHARE.five) + rolloverCents
  const four = Math.round(totalCents * POOL_SHARE.four)
  const three = totalCents - Math.round(totalCents * POOL_SHARE.five) - four
  return { five, four, three }
}

/** Draws 5 unique numbers at random from 1..NUMBER_POOL_SIZE. */
export function drawRandomNumbers() {
  const pool = Array.from({ length: NUMBER_POOL_SIZE }, (_, i) => i + 1)
  const result = []
  for (let i = 0; i < NUMBERS_DRAWN; i++) {
    const idx = Math.floor(Math.random() * pool.length)
    result.push(pool.splice(idx, 1)[0])
  }
  return result.sort((a, b) => a - b)
}

/**
 * Algorithmic draw: weights each candidate number by how often it appears
 * across subscribers' recent score digits (a deterministic-ish, auditable
 * stand-in for "weighted by score frequency" per PRD §06). Falls back to a
 * uniform weighting for numbers no one's scores touch.
 */
export function drawAlgorithmicNumbers(scoreFrequencyMap) {
  const weights = Array.from({ length: NUMBER_POOL_SIZE }, (_, i) => {
    const n = i + 1
    return 1 + (scoreFrequencyMap?.[n] ?? 0)
  })

  const chosen = new Set()
  while (chosen.size < NUMBERS_DRAWN) {
    const totalWeight = weights.reduce((sum, w, i) => sum + (chosen.has(i + 1) ? 0 : w), 0)
    let r = Math.random() * totalWeight
    for (let i = 0; i < weights.length; i++) {
      const n = i + 1
      if (chosen.has(n)) continue
      r -= weights[i]
      if (r <= 0) {
        chosen.add(n)
        break
      }
    }
  }
  return [...chosen].sort((a, b) => a - b)
}

/** Builds a frequency map of last-digit-of-score occurrences mapped onto 1–49,
 *  used as the algorithmic draw's weighting signal. */
export function buildScoreFrequencyMap(allRecentScores) {
  const map = {}
  for (const { score } of allRecentScores) {
    // Spread each score's influence across a small neighbourhood so no
    // single number dominates the pool.
    for (let offset = 0; offset < NUMBER_POOL_SIZE; offset += 7) {
      const n = ((score + offset) % NUMBER_POOL_SIZE) + 1
      map[n] = (map[n] ?? 0) + 1
    }
  }
  return map
}

/** Counts how many of a user's picked numbers match the winning combination. */
export function countMatches(userNumbers, winningNumbers) {
  const winSet = new Set(winningNumbers)
  return userNumbers.filter((n) => winSet.has(n)).length
}

export function matchCountToTier(count) {
  if (count >= 5) return '5_number'
  if (count === 4) return '4_number'
  if (count === 3) return '3_number'
  return null
}

/**
 * Runs a full draw simulation for a given month: pulls active subscribers,
 * their entries, generates winning numbers, computes pool split and per-tier
 * winners. Does not write anything — used for the admin "simulate before
 * publish" step (PRD §06).
 */
export async function simulateDraw({ drawId, mode }) {
  const { data: draw, error: drawError } = await supabase
    .from('draws')
    .select('*')
    .eq('id', drawId)
    .single()
  if (drawError) throw drawError

  const { data: entries, error: entriesError } = await supabase
    .from('draw_entries')
    .select('user_id, numbers')
    .eq('draw_id', drawId)
  if (entriesError) throw entriesError

  let winningNumbers
  if (mode === 'algorithmic') {
    const { data: recentScores } = await supabase.from('scores').select('score')
    winningNumbers = drawAlgorithmicNumbers(buildScoreFrequencyMap(recentScores ?? []))
  } else {
    winningNumbers = drawRandomNumbers()
  }

  const pool = splitPool(draw.total_prize_pool_cents, draw.jackpot_rollover_cents)

  const winnersByTier = { five: [], four: [], three: [] }
  for (const entry of entries) {
    const matches = countMatches(entry.numbers, winningNumbers)
    if (matches >= 5) winnersByTier.five.push(entry.user_id)
    else if (matches === 4) winnersByTier.four.push(entry.user_id)
    else if (matches === 3) winnersByTier.three.push(entry.user_id)
  }

  const perWinnerAmount = (tierPoolCents, winnerList) =>
    winnerList.length ? Math.floor(tierPoolCents / winnerList.length) : 0

  return {
    winningNumbers,
    pool,
    winnersByTier,
    payouts: {
      five: perWinnerAmount(pool.five, winnersByTier.five),
      four: perWinnerAmount(pool.four, winnersByTier.four),
      three: perWinnerAmount(pool.three, winnersByTier.three),
    },
    jackpotRollsOver: winnersByTier.five.length === 0,
  }
}

/** Persists a simulated draw as published: writes winning numbers, updates
 *  draw state, and inserts winner rows (PRD §06 "publish results"). */
export async function publishDraw({ drawId, simulation, adminId }) {
  const { error: drawUpdateError } = await supabase
    .from('draws')
    .update({
      state: 'published',
      winning_numbers: simulation.winningNumbers,
      pool_5_cents: simulation.pool.five,
      pool_4_cents: simulation.pool.four,
      pool_3_cents: simulation.pool.three,
      published_at: new Date().toISOString(),
      created_by: adminId,
    })
    .eq('id', drawId)
  if (drawUpdateError) throw drawUpdateError

  const winnerRows = []
  for (const [tierKey, userIds] of Object.entries(simulation.winnersByTier)) {
    const tier = { five: '5_number', four: '4_number', three: '3_number' }[tierKey]
    const amount = simulation.payouts[tierKey]
    for (const userId of userIds) {
      winnerRows.push({ draw_id: drawId, user_id: userId, tier, amount_cents: amount })
    }
  }

  if (winnerRows.length) {
    const { error: winnersError } = await supabase.from('winners').insert(winnerRows)
    if (winnersError) throw winnersError
  }
}
