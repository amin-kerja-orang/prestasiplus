import type { GamesRoomGame, GamesRoomSubject } from '@pp/contract'

/** A seat as the engine sees it. */
export interface EnginePlayer {
  /** The key of the seat in the engine state: the decimal string user id, or `robot-<n>` for a robot (no user). */
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
  /** Per-room secret seed (128-bit hex) in every stream name; SERVER ONLY, never in a view. */
  seed: string
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
  /** Questions the acting human answered or timed out on: the `part_ref` position (absent on a room from before FR-GM-00.5). */
  answerCount?: number
  /** When the acting human really answered, in order; a timeout is no answer (the pace guard reads it). */
  answerMs?: number[]
}

/** One bank question the acting human answered or timed out on (FR-GM-00.5); a robot's or a simulated seat's answer is never one. */
export interface AnsweredQuestion {
  questionId: string
  position: number
  correct: boolean
  atMs: number
}

export interface EngineOut {
  state: RoomState
  players: EnginePlayer[]
  finished: boolean
  /** What this step answered, in order; the service writes each through the answer port in the same transaction. */
  answered?: AnsweredQuestion[]
}

/** What the engine plays: a roll or an answer. */
export type RoomPlayAction =
  | { type: 'roll' }
  | { type: 'answer'; questionId: string; optionId: number | null; value: unknown; seconds: number }

/** An action of the room route: a play, or `Keluar` (the room service handles `leave`; the engine never sees it). */
export type RoomAction = RoomPlayAction | { type: 'leave' }

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
