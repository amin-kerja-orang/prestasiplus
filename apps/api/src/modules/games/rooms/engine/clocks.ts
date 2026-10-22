/**
 * Server clocks of the timed room games (BR-M16-20), resolved lazily and idempotently on read: every Perang Fakta
 * round that is 10 s old or more advances as a no-vote of the acting player (several rounds after a long absence),
 * and a Teka Silang Kata game 5 minutes after its start ends. Same time, same result. Pure: `nowMs` is injected.
 */
import { CROSSWORD_MS, PF_ROUNDS, PF_ROUND_MS } from './constants'
import { applyTimeout } from './engine'
import type { EnginePlayer, EngineRoom, RoomState, StreamFactory } from './types'

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
}

export function resolveClocks(input: ClockInput): ClockOut {
  let state = input.state
  let players = input.players
  let finished = false
  let changed = false
  for (let i = 0; i <= PF_ROUNDS + 1; i++) {
    let due = false
    let nextStart = input.nowMs
    if (input.room.game === 'perang-fakta') {
      const began = state.roundStartedMs ?? input.startedAtMs
      due = input.nowMs - began >= PF_ROUND_MS
      nextStart = began + PF_ROUND_MS
    } else if (input.room.game === 'teka-silang-kata') {
      due = input.nowMs - input.startedAtMs >= CROSSWORD_MS
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
    if (res.finished) {
      finished = true
      break
    }
  }
  return { state, players, finished, changed }
}
