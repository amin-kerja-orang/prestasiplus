/**
 * Pure builders of what a player may see of the engine state. The answer keys (`keyIndex`, `keyText`), the pool
 * ids, the cursor, the pending question id, the crossword answers and the Perang Fakta truth values are never
 * copied: the question is rebuilt from `text` and `options` only.
 */
import type { GamesKeylessQuestion, GamesRoomGame } from '@pp/contract'

import { CROSSWORD_MS, PF_ROUND_MS } from './constants'
import type { RoomState } from './types'

/** The keyless question awaiting an answer, or undefined. */
export function questionView(
  game: GamesRoomGame,
  status: string,
  st: RoomState | null,
): GamesKeylessQuestion | undefined {
  if (status !== 'playing' || !st || st.pendingQ === null) return undefined
  if (game === 'perang-fakta') {
    const fact = st.facts[st.round - 1]
    if (!fact) return undefined
    return {
      id: fact.qId,
      text: fact.text,
      options: [
        { id: 0, label: 'A', text: 'Betul' },
        { id: 1, label: 'B', text: 'Salah' },
      ],
    }
  }
  const q = st.qs[st.pendingQ]
  if (!q) return undefined
  const options = q.options.map((o) => ({ id: o.id, label: o.label, text: o.text }))
  return { id: st.pendingQ, text: q.text, options: game === 'teka-silang-kata' ? [] : options }
}

/** Server-derived seconds left (relative, so the client needs no shared clock). */
export function clocksOf(
  game: GamesRoomGame,
  status: string,
  st: RoomState,
  startedAtMs: number | null,
  nowMs: number,
): { roundSecondsLeft?: number; secondsLeft?: number } {
  if (status !== 'playing') return {}
  if (game === 'perang-fakta') {
    const began = st.roundStartedMs ?? startedAtMs ?? nowMs
    return { roundSecondsLeft: Math.max(0, Math.ceil((PF_ROUND_MS - (nowMs - began)) / 1000)) }
  }
  if (game === 'teka-silang-kata') {
    const began = startedAtMs ?? nowMs
    return { secondsLeft: Math.max(0, Math.ceil((CROSSWORD_MS - (nowMs - began)) / 1000)) }
  }
  return {}
}

export interface PublicState {
  awaiting: 'roll' | 'answer' | null
  round: number
  total: number
  humanId: string
  board?: string[]
  positions?: Record<string, number>
  meter?: Record<string, number>
  teamScores?: Record<string, number>
  log: string[]
  roundSecondsLeft?: number
  secondsLeft?: number
}

export function stateView(
  game: GamesRoomGame,
  status: string,
  st: RoomState,
  startedAtMs: number | null,
  nowMs: number,
): PublicState {
  return {
    awaiting: st.awaiting,
    round: st.round,
    total: st.total,
    humanId: st.humanId,
    ...(game === 'papan-bijak' ? { board: st.board, positions: st.positions } : {}),
    ...(['benteng-ilmu', 'perlumbaan-matematik', 'teka-silang-kata'].includes(game)
      ? { meter: st.meter }
      : {}),
    ...(game === 'kuiz-relay' ? { teamScores: st.teamScores } : {}),
    log: st.log,
    ...clocksOf(game, status, st, startedAtMs, nowMs),
  }
}
