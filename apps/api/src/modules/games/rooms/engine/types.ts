import type { GamesRoomGame, GamesRoomSubject } from '@pp/contract'

/** A player as the engine sees them. `userId` is the decimal string id. */
export interface EnginePlayer {
  userId: string
  team: number | null
  points: number
  correct: number
  isBot: boolean
}

export interface EngineRoom {
  code: string
  game: GamesRoomGame
  subject: GamesRoomSubject | string
  gradeLevel: string
}

/**
 * A question inside the state document. `keyIndex` / `keyText` are SERVER ONLY: they never leave the state
 * (the room view builds the keyless question from `text` and `options` only).
 */
export interface StoredQuestion {
  text: string
  options: { id: number; label: 'A' | 'B' | 'C' | 'D'; text: string }[]
  keyIndex: number
  keyText: string
}

/** A pool question handed to `startGame` (the service maps `ServedQuestion` onto it). */
export interface PoolQuestion extends StoredQuestion {
  id: string
}

/** The engine document stored whole in `game_rooms.state` (jsonb). Contains the answer keys: server side only. */
export interface RoomState {
  round: number
  total: number
  /** Question pool ids (decimal strings); the cursor cycles through them. */
  qIds: string[]
  cursor: number
  /** Questions by id (with keys). */
  qs: Record<string, StoredQuestion>
  /** The only acting player (the host). */
  humanId: string
  awaiting: 'roll' | 'answer' | null
  pendingQ: string | null
  board: string[]
  positions: Record<string, number>
  meter: Record<string, number>
  words: { qId: string; answer: string }[]
  facts: { qId: string; text: string; isTrue: boolean }[]
  turn: number
  teamScores: Record<string, number>
  winnerId: string | null
  mvpId: string | null
  /** How many named draw streams have been used (`m16:room:<code>:d<n>`). */
  draws: number
  /** Start of the current round, ms since epoch (injected clock), null before the start. */
  roundStartedMs: number | null
  log: string[]
}

export interface EngineOut {
  state: RoomState
  players: EnginePlayer[]
  finished: boolean
}

export type RoomAction =
  | { type: 'roll' }
  | { type: 'answer'; questionId: string; optionId: number | null; value: unknown; seconds: number }

/** A refusal of the engine; the service maps it to the standard error body. */
export class EngineRefusal extends Error {
  constructor(
    readonly kind: 'conflict' | 'validation',
    message: string,
    readonly field?: string,
  ) {
    super(message)
  }
}

/** Opens the named PRNG stream `name` (default `prngStream`); injectable for tests. */
export type StreamFactory = (name: string) => import('../../../../db/prng').Prng
