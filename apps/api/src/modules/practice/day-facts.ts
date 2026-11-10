/**
 * Pure helpers behind the M14 day facts (S7-T04 part 14, FR-GM-19.4, ruling R 4).
 */

/**
 * `practice_answers.mode` codes written by games (AnswerLogPort registry, OPT-MODE-SESI): `game` for solo and room
 * games, `battle` for Battle. A game session never counts toward a challenge (FR-GM-19.4). `mode` is NOT NULL
 * since 0188.
 */
export const GAME_ANSWER_MODES = ['game', 'battle'] as const

/**
 * The longest run of consecutive correct answers inside ONE session. `rows` must already be in answer order
 * (answered_at, id). Runs are never joined across sessions and never summed; answers without a session are ignored.
 */
export function longestRunInSession(rows: readonly { sessionId: string | null; isCorrect: boolean }[]): number {
  const current = new Map<string, number>()
  let best = 0
  for (const r of rows) {
    if (r.sessionId === null) continue
    const run = r.isCorrect ? (current.get(r.sessionId) ?? 0) + 1 : 0
    current.set(r.sessionId, run)
    if (run > best) best = run
  }
  return best
}
