/**
 * Server clocks of the room games (FR-GM-00.7, ruling 49), resolved idempotently on a poll and by the 5 s sweep: a turn or round whose
 * time ran out times out (several after a long absence), and a Teka Silang Kata game 5 minutes after its start ends. Same
 * time, same result. Pure: `nowMs` is injected.
 */
import type { GamesRoomGame } from '@pp/contract'

import {
  ABSENT_TIMEOUTS,
  BENTENG_ROUND_MS,
  CROSSWORD_MS,
  MATHRACE_ANSWER_MS,
  PB_ANSWER_MS,
  PB_ROLL_MS,
  PF_ROUND_MS,
  RELAY_ANSWER_MS,
  SEEN_GAP_MS,
} from './constants'
import { applyTimeout } from './engine'
import type { AnsweredQuestion, EnginePlayer, EngineRoom, RoomState, StreamFactory } from './types'

export interface ClockInput {
  room: EngineRoom
  players: EnginePlayer[]
  state: RoomState
  /** When the room started (ms). */
  startedAtMs: number
  nowMs: number
  p: number
  /**
   * `games_absent_seconds` in ms (ruling 49). When given, the turn of an absent seat closes early in the fully multi-human
   * games (Papan Bijak, Kuiz Relay): see `absentCloseMs`. Absent: only the full clock closes a turn.
   */
  absentMs?: number
  /**
   * The seat whose own request this is (poll or action). It is here now, so the turn open NOW is never early-closed for it,
   * whatever its stored `last_polled_at` says; turns whose full clock ran out before this request still time out.
   */
  callerSeat?: string
  streams?: StreamFactory
}

export interface ClockOut {
  state: RoomState
  players: EnginePlayer[]
  /** The game ended on the clock. */
  finished: boolean
  /** At least one timeout was applied (the caller must write the state back). */
  changed: boolean
  /** The questions those timeouts wrote off, in order. */
  answered: AnsweredQuestion[]
}

/** Timeouts applied at most by one call; the next poll or sweep goes on from there. */
const MAX_CATCH_UP = 200

/** How long the current turn or round lasts; null when no clock runs (Teka Silang Kata has one clock for the whole game). */
export function turnMs(game: GamesRoomGame, awaiting: RoomState['awaiting']): number | null {
  if (awaiting === null) return null
  switch (game) {
    case 'papan-bijak':
      return awaiting === 'roll' ? PB_ROLL_MS : PB_ANSWER_MS
    case 'perang-fakta':
      return PF_ROUND_MS
    case 'benteng-ilmu':
      return BENTENG_ROUND_MS
    case 'perlumbaan-matematik':
      return MATHRACE_ANSWER_MS
    case 'kuiz-relay':
      return RELAY_ANSWER_MS
    case 'teka-silang-kata':
      return null
  }
}

/**
 * Ruling 49: when the seat on turn has not polled or acted for `games_absent_seconds`, its turn times out at that point
 * instead of at the full clock. The point is the later of the turn's start (a seat already absent when its turn begins is
 * timed out at once) and `last_polled_at` + the absence window (the limit plus the write gap, as presence reads it). A seat
 * that never polled (`last_polled_at` null: a room from before DM-90) counts as present. Null when the rule does not apply:
 * the calling seat itself (it is present on its own request), a robot on turn, or a game whose rounds are the "own part" of GAME-03/04/05/07 (their clocks are shorter
 * than the limit and the other seats are simulated there, so that part owns absence of the simultaneous rounds).
 */
export function absentCloseMs(input: ClockInput, state: RoomState, players: EnginePlayer[], began: number): number | null {
  if (input.absentMs === undefined) return null
  if (input.room.game !== 'papan-bijak' && input.room.game !== 'kuiz-relay') return null
  const actor = players.find((x) => x.userId === state.humanId)
  if (!actor || actor.isBot || actor.userId === input.callerSeat) return null
  if (actor.lastPolledMs === null || actor.lastPolledMs === undefined) return null
  return Math.max(began, actor.lastPolledMs + input.absentMs + SEEN_GAP_MS)
}

export function resolveClocks(input: ClockInput): ClockOut {
  let state = input.state
  let players = input.players
  let finished = false
  let changed = false
  const answered: AnsweredQuestion[] = []
  for (let i = 0; i < MAX_CATCH_UP; i++) {
    // Absence rules on (`absentMs` given): the seat on turn has 3 timeouts, so the service removes it before the clock goes on.
    const on = players.find((x) => x.userId === state.humanId)
    if (input.absentMs !== undefined && on && !on.isBot && (on.consecutiveTimeouts ?? 0) >= ABSENT_TIMEOUTS) break
    let due = false
    let nextStart = input.nowMs
    const ms = turnMs(input.room.game, state.awaiting)
    if (input.room.game === 'teka-silang-kata') {
      due = input.nowMs - input.startedAtMs >= CROSSWORD_MS
      nextStart = input.startedAtMs + CROSSWORD_MS
    } else if (ms !== null) {
      const began = state.roundStartedMs ?? input.startedAtMs
      const early = absentCloseMs(input, state, players, began)
      const end = early === null ? began + ms : Math.min(began + ms, early)
      due = input.nowMs >= end
      nextStart = end
    }
    if (!due) break
    const res = applyTimeout({
      room: input.room,
      players,
      state,
      p: input.p,
      roundStartMs: nextStart,
      ...(input.streams ? { streams: input.streams } : {}),
    })
    state = res.state
    players = res.players
    changed = true
    answered.push(...(res.answered ?? []))
    if (res.finished) {
      finished = true
      break
    }
  }
  return { state, players, finished, changed, answered }
}
