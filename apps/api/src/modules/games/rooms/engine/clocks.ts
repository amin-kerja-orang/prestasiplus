/**
 * Server clocks of the room games (FR-GM-00.7), resolved idempotently on a poll and by the 5 s sweep: a turn or round whose
 * time ran out times out (several after a long absence), and a Teka Silang Kata game 5 minutes after its start ends. Same
 * time, same result. Pure: `nowMs` is injected.
 */
import type { GamesRoomGame } from '@pp/contract'

import {
  BENTENG_ROUND_MS,
  CROSSWORD_MS,
  MATHRACE_ANSWER_MS,
  PB_ANSWER_MS,
  PB_ROLL_MS,
  PF_ROUND_MS,
  RELAY_ANSWER_MS,
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

export function resolveClocks(input: ClockInput): ClockOut {
  let state = input.state
  let players = input.players
  let finished = false
  let changed = false
  const answered: AnsweredQuestion[] = []
  for (let i = 0; i < MAX_CATCH_UP; i++) {
    let due = false
    let nextStart = input.nowMs
    const ms = turnMs(input.room.game, state.awaiting)
    if (input.room.game === 'teka-silang-kata') {
      due = input.nowMs - input.startedAtMs >= CROSSWORD_MS
      nextStart = input.startedAtMs + CROSSWORD_MS
    } else if (ms !== null) {
      const began = state.roundStartedMs ?? input.startedAtMs
      due = input.nowMs - began >= ms
      nextStart = began + ms
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
