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
  /**
   * The seat the room waits for now: the seat whose turn it is (Papan Bijak roll or question, the Kuiz Relay answerer). In
   * the games whose simultaneity is "own part" (Perang Fakta GAME-03, Benteng Ilmu GAME-04, Perlumbaan Matematik GAME-05,
   * Teka Silang Kata GAME-07) it stays the one acting human (the host) and every other seat is still simulated.
   */
  humanId: string
  /** How many humans were seated when the game started: standings need 2 or more (48 GAME-R, FR-GM-R.6). Absent on a room from before R2. */
  startHumans?: number
  /** Per human seat: answers, pace and absence. Robots have none. */
  seats?: Record<string, SeatState>
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

/** What the engine keeps of one human seat (the room state is keyed by seat; a robot seat has none). */
export interface SeatState {
  /** Questions this human answered or timed out on: the `part_ref` position of their answer rows. */
  answerCount: number
  /** When this human really answered, in order; a timeout is no answer (the pace guard reads it). */
  answerMs: number[]
  /** Consecutive timeouts of this seat's own turns, polled or not; an in-time action resets it, a poll does not; 3 remove the seat (FR-GM-R.4, ruling 49). */
  missed: number
  /** When this human last polled or acted (ms); null before the first. Presence for the default win. */
  seenMs: number | null
  /** The turn marker `round:turn:question` of the question this human last answered (`youAnswered`). */
  answeredAt: string | null
}

/** One bank question a human answered or timed out on (FR-GM-00.5); a robot's or a simulated seat's answer is never one. */
export interface AnsweredQuestion {
  /** The human seat that answered (a robot's answer is never one). */
  userId: string
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
