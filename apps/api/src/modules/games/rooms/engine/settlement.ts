/**
 * Settlement of a finished room (AC10, BR-M16-21/28): the standings changes and the one reward report of the acting
 * human. Pure: the caller applies the result once (row lock + `settled_at`).
 */
import type { GamesRoomGame } from '@pp/contract'

import { ROOM_COINS } from './constants'
import type { EnginePlayer, RoomState } from './types'

/** M14 game tokens (as BE-23 `gameRow` expects them). */
export const ROOM_TOKENS: Record<GamesRoomGame, string> = {
  'papan-bijak': 'papan_bijak',
  'perang-fakta': 'perang_fakta',
  'benteng-ilmu': 'benteng_ilmu',
  'perlumbaan-matematik': 'mathrace',
  'kuiz-relay': 'kuiz_relay',
  'teka-silang-kata': 'teka_silang_kata',
}

export interface StandingDelta {
  userId: string
  wins: number
  jumlah: number
  betul: number
  skor: number
}

export interface Report {
  userId: string
  game: string
  event: string
  /** Fixed coins; undefined for Papan Bijak (the service computes them from the tier rates). */
  coins?: number
  correct: number
  total: number
  won: boolean
  detail: { rank: number; roomCode: string }
}

export interface Settlement {
  standings: StandingDelta[]
  report: Report | null
}

export interface SettleInput {
  code: string
  game: GamesRoomGame
  state: RoomState
  players: EnginePlayer[]
}

export function computeSettlement(input: SettleInput): Settlement {
  const { game, state: st, players: ps } = input
  const humans = ps.filter((p) => !p.isBot)
  const deltas = new Map<string, StandingDelta>()
  const delta = (userId: string): StandingDelta => {
    let d = deltas.get(userId)
    if (!d) {
      d = { userId, wins: 0, jumlah: 0, betul: 0, skor: 0 }
      deltas.set(userId, d)
    }
    return d
  }
  const winners = new Set<string>()
  if (game === 'kuiz-relay') {
    if (st.mvpId !== null) {
      delta(st.mvpId).wins += 1
      const mvp = ps.find((p) => p.userId === st.mvpId)
      for (const p of ps) if (p.team !== null && p.team === mvp?.team) winners.add(p.userId)
    }
  } else if (st.winnerId !== null) {
    winners.add(st.winnerId)
    delta(st.winnerId).wins += 1
  }
  if (game === 'papan-bijak') {
    for (const p of ps) {
      const d = delta(p.userId)
      d.jumlah += 1
      d.betul += p.correct
      d.skor += p.points
    }
  }
  // Only the acting human earns a standing (AC10). Bots never do, and neither does a joined human: the engine
  // simulates every non-host player, so their wins and Papan Bijak figures were never played. The service also
  // drops is_test players.
  const botIds = new Set(ps.filter((p) => p.isBot).map((p) => p.userId))
  const standings = [...deltas.values()].filter((d) => d.userId === st.humanId && !botIds.has(d.userId))

  const me = humans.find((p) => p.userId === st.humanId)
  if (!me) return { standings, report: null }
  const won = winners.has(me.userId)
  let coins: number | undefined = 0
  let event = won ? 'win' : 'finish'
  if (game === 'papan-bijak') {
    coins = undefined
    event = won ? 'win' : 'correct'
  } else if (game === 'benteng-ilmu') {
    coins = won ? ROOM_COINS.bentengWin : ROOM_COINS.bentengPlay
    event = won ? 'win' : 'play'
  } else if (game === 'perang-fakta') coins = won ? ROOM_COINS.perangFaktaWin : 0
  else if (game === 'perlumbaan-matematik') {
    coins = ROOM_COINS.mathracePlay
    event = 'play'
  }
  const rank = 1 + ps.filter((p) => (st.meter[p.userId] ?? 0) > (st.meter[me.userId] ?? 0)).length
  return {
    standings,
    report: {
      userId: me.userId,
      game: ROOM_TOKENS[game],
      event,
      ...(coins === undefined ? {} : { coins }),
      correct: me.correct,
      total: st.total,
      won,
      detail: { rank, roomCode: input.code },
    },
  }
}
