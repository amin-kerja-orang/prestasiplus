/**
 * Settlement of a finished room (AC10, BR-M16-21/28): the standings changes and one reward report per human. Pure: the
 * caller applies the result once (row lock + `settled_at`).
 */
import type { GamesRoomGame } from '@pp/contract'

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
  correct: number
  total: number
  won: boolean
  /** What decides the reward (48 section 3.4). */
  outcome: 'win' | 'draw' | 'play'
  robotsOnly: boolean
  detail: { rank: number; roomCode: string }
}

export interface Settlement {
  standings: StandingDelta[]
  /** One per human who played and stayed, each from the one reward formula; empty when nothing is settled. */
  reports: Report[]
}

export interface SettleInput {
  code: string
  game: GamesRoomGame
  state: RoomState
  players: EnginePlayer[]
}

/** Papan Bijak and Kuiz Relay play every human seat on its own turn; the other games are "own part" (one acting human). */
export const isMultiHuman = (game: GamesRoomGame): boolean => game === 'papan-bijak' || game === 'kuiz-relay'

/**
 * The humans who played and stayed to the end: every human seat of a multi-human game; the one acting human of an
 * own-part game (GAME-03/04/05/07 simulate the other seats, so those never played). A leaver is no seat any more.
 */
export function playedHumans(game: GamesRoomGame, state: RoomState, players: EnginePlayer[]): EnginePlayer[] {
  const humans = players.filter((p) => !p.isBot)
  return isMultiHuman(game) ? humans : humans.filter((p) => p.userId === state.humanId)
}

/** Humans seated at the start; a room from before R2 counts the human seats it still has. */
export const startedHumans = (state: RoomState, players: EnginePlayer[]): number =>
  state.startHumans ?? players.filter((p) => !p.isBot).length

/**
 * Standings and one report per human (48 GAME-R, FR-GM-R.6). Standings only when 2 or more humans started: a robot-only
 * game or one with a single human changes no standing. Every human who stayed gets jumlah + 1 and their betul and skor;
 * wins go to the winner (Kuiz Relay: the MVP). A leaver was settled when they left and is not in `players`.
 */
export function computeSettlement(input: SettleInput): Settlement {
  const { game, state: st, players: ps } = input
  const played = playedHumans(game, st, ps)
  const winners = new Set<string>()
  let winStanding: string | null = null
  if (game === 'kuiz-relay') {
    if (st.mvpId !== null) {
      winStanding = st.mvpId
      const mvp = ps.find((p) => p.userId === st.mvpId)
      for (const p of ps) if (p.team !== null && p.team === mvp?.team) winners.add(p.userId)
    }
  } else if (st.winnerId !== null) {
    winners.add(st.winnerId)
    winStanding = st.winnerId
  }
  const robotsOnly = startedHumans(st, ps) < 2
  const standings: StandingDelta[] = robotsOnly
    ? []
    : played.map((p) => ({
        userId: p.userId,
        wins: p.userId === winStanding ? 1 : 0,
        jumlah: 1,
        betul: p.correct,
        skor: p.points,
      }))
  const reports = played.map((me): Report => {
    const won = winners.has(me.userId)
    let event = won ? 'win' : 'finish'
    if (game === 'papan-bijak') event = won ? 'win' : 'correct'
    else if (game === 'benteng-ilmu') event = won ? 'win' : 'play'
    else if (game === 'perlumbaan-matematik') event = 'play'
    const drawn = !won && game !== 'kuiz-relay' && st.winnerId === null
    const rank = 1 + ps.filter((p) => (st.meter[p.userId] ?? 0) > (st.meter[me.userId] ?? 0)).length
    return {
      userId: me.userId,
      game: ROOM_TOKENS[game],
      event,
      correct: me.correct,
      total: st.total,
      won,
      outcome: won ? 'win' : drawn ? 'draw' : 'play',
      robotsOnly,
      detail: { rank, roomCode: input.code },
    }
  })
  return { standings, reports }
}
