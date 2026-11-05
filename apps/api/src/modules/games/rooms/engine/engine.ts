/**
 * The room game engine (SRS M16 BR-M16-19/20, PROVISIONAL): a PURE port of the mock `room-engine.ts`, keyed by SEAT.
 * `state.humanId` is the seat the room waits for now. Papan Bijak (GAME-02) and Kuiz Relay (GAME-06) are multi-human:
 * every seat that is not a robot is awaited on its own turn, and robots act through the simulated path for their
 * seats only. The simultaneous games are "own part" (Perang Fakta GAME-03, Benteng Ilmu GAME-04, Perlumbaan Matematik
 * GAME-05, Teka Silang Kata GAME-07): they still wait for one acting human (the host) and simulate the other seats,
 * until their own cards build the simultaneous rounds. Bots answer correctly with probability `p` (the platform answer
 * accuracy). Dice, boards and bot answers come from named streams `m16:room:<code>:...`, so the same room and the same
 * actions give the same game. The clock is injected as `nowMs`; the engine never reads the system time, never touches
 * the database and never throws anything but `EngineRefusal`.
 */
import { prngStream, type Prng } from '../../../../db/prng'
import {
  BENTENG_DAMAGE,
  BENTENG_HP,
  BOARD_FIXED,
  BOARD_SIZE,
  BOARD_STEP,
  KR_ROUNDS,
  MATHRACE_STEPS,
  PB_MAX_ROUNDS,
} from './constants'
import { chance, cmpId, shuffle } from './rng'
import {
  EngineRefusal,
  type AnsweredQuestion,
  type EngineOut,
  type EnginePlayer,
  type EngineRoom,
  type PoolQuestion,
  type RoomPlayAction,
  type RoomState,
  type SeatState,
  type StreamFactory,
} from './types'

interface Ctx {
  room: EngineRoom
  players: EnginePlayer[]
  s: RoomState
  streams: StreamFactory
  p: number
  nowMs: number
  answered: AnsweredQuestion[]
}

const defaultStreams: StreamFactory = (name) => prngStream(name)

const draw = (c: Ctx): Prng =>
  c.streams(`m16:room:${c.room.code}:${c.s.seed}:d${String(c.s.draws++)}`)
const human = (c: Ctx): EnginePlayer =>
  c.players.find((x) => x.userId === c.s.humanId) as EnginePlayer
const others = (c: Ctx): EnginePlayer[] => c.players.filter((x) => x.userId !== c.s.humanId)
const nextQ = (c: Ctx): string => {
  const id = c.s.qIds[c.s.cursor % c.s.qIds.length] as string
  c.s.cursor += 1
  return id
}
const clampSeconds = (v: number): number => Math.min(15, Math.max(0, Math.floor(v)))
/** Whole seconds since the current turn began, by the injected clock. */
const ctxSeconds = (c: Ctx): number => (c.nowMs - (c.s.roundStartedMs ?? c.nowMs)) / 1000

const newSeat = (): SeatState => ({ answerCount: 0, answerMs: [], missed: 0, seenMs: null, answeredAt: null })

/** The state of a human seat (created on first use). */
export function seatOf(s: RoomState, id: string): SeatState {
  s.seats ??= {}
  return (s.seats[id] ??= newSeat())
}

/** The turn marker of the question on the table (`youAnswered` compares it with the seat's last answer). */
const markerOf = (s: RoomState, qId: string | null): string => `${String(s.round)}:${String(s.turn)}:${qId ?? ''}`

/** Whether `id` has already answered the question the room awaits now (the waiting state of a simultaneous round). */
export function youAnswered(s: RoomState, id: string): boolean {
  return s.awaiting === 'answer' && s.pendingQ !== null && s.seats?.[id]?.answeredAt === markerOf(s, s.pendingQ)
}

/** The player is polling or acting: absence starts again (3 timeouts "with no poll in between"). Returns whether the state changed. */
export function markSeen(s: RoomState, id: string, nowMs: number, minGapMs: number): boolean {
  const seat = seatOf(s, id)
  if (seat.missed === 0 && seat.seenMs !== null && nowMs - seat.seenMs < minGapMs) return false
  seat.missed = 0
  seat.seenMs = nowMs
  return true
}

/** Notes one answer of a human seat for the answer store; `timedOut` is a wrong answer that is no answer for the pace guard. A robot's is never one. */
function logAnswer(c: Ctx, pl: EnginePlayer, questionId: string, correct: boolean, timedOut: boolean): void {
  if (pl.isBot) return
  const seat = seatOf(c.s, pl.userId)
  const position = seat.answerCount + 1
  seat.answerCount = position
  seat.answeredAt = markerOf(c.s, questionId)
  if (!timedOut) {
    seat.answerMs.push(c.nowMs)
    seat.missed = 0
  }
  c.answered.push({ userId: pl.userId, questionId, position, correct, atMs: c.nowMs })
}

/** An answer with no pick and no value: the client's explicit "time ran out", or the server's. */
const noPick = (a: Answer): boolean => a.optionId === null && a.value === undefined

export function emptyState(humanId: string, seed: string): RoomState {
  return {
    seed,
    round: 1,
    total: 0,
    qIds: [],
    cursor: 0,
    qs: {},
    humanId,
    startHumans: 0,
    seats: {},
    awaiting: null,
    pendingQ: null,
    board: [],
    positions: {},
    meter: {},
    words: [],
    facts: [],
    turn: 0,
    teamScores: {},
    winnerId: null,
    mvpId: null,
    draws: 0,
    roundStartedMs: null,
    log: [],
  }
}

// --- start ------------------------------------------------------------------------------------------------------

export interface StartInput {
  room: EngineRoom
  players: EnginePlayer[]
  humanId: string
  /** The room's secret seed (stored at create). */
  seed: string
  /** The drawn question pool, in draw order (the service draws it through BE-09). */
  pool: PoolQuestion[]
  quizTiles: number
  /** Bot answer probability, 0..1. */
  p: number
  nowMs: number
  streams?: StreamFactory
  /**
   * Secret integer in [0, max) (crypto) for the Perang Fakta truth bit and the shown wrong option; the 32-bit
   * stream hash is not enough for these. Absent: the seeded stream (deterministic tests).
   */
  secretInt?: (max: number) => number
}

export function startGame(input: StartInput): EngineOut {
  const { room, pool } = input
  const streams = input.streams ?? defaultStreams
  const c: Ctx = {
    room,
    players: input.players.map((x) => ({ ...x })),
    s: emptyState(input.humanId, input.seed),
    streams,
    p: input.p,
    nowMs: input.nowMs,
    answered: [],
  }
  c.s.startHumans = c.players.filter((x) => !x.isBot).length
  for (const pl of c.players) if (!pl.isBot) seatOf(c.s, pl.userId).seenMs = input.nowMs
  c.s.qIds = pool.map((q) => q.id)
  for (const q of pool) {
    c.s.qs[q.id] = { text: q.text, options: q.options, keyIndex: q.keyIndex, keyText: q.keyText }
  }
  const key = (pl: EnginePlayer): string => pl.userId
  switch (room.game) {
    case 'papan-bijak': {
      c.s.board = buildBoard(input.quizTiles, streams(`m16:room:${room.code}:${input.seed}:board`))
      for (const pl of c.players) c.s.positions[key(pl)] = 1
      c.s.total = BOARD_SIZE
      break
    }
    case 'perang-fakta': {
      c.s.total = pool.length
      c.s.facts = pool.map((q) => factOf(q, draw(c), input.secretInt))
      c.s.pendingQ = pool[0]?.id ?? null
      c.s.awaiting = 'answer'
      for (const pl of c.players) c.s.meter[key(pl)] = 0
      break
    }
    case 'benteng-ilmu': {
      c.s.total = pool.length
      for (const pl of c.players) c.s.meter[key(pl)] = BENTENG_HP
      c.s.pendingQ = nextQ(c)
      c.s.awaiting = 'answer'
      break
    }
    case 'perlumbaan-matematik': {
      c.s.total = MATHRACE_STEPS
      for (const pl of c.players) c.s.meter[key(pl)] = 0
      c.s.pendingQ = nextQ(c)
      c.s.awaiting = 'answer'
      break
    }
    case 'kuiz-relay': {
      c.s.total = KR_ROUNDS
      c.s.teamScores = { '1': 0, '2': 0 }
      c.players.forEach((pl, i) => {
        pl.team = (i % 2) + 1
      })
      break
    }
    case 'teka-silang-kata': {
      c.s.words = pool.map((q) => ({ qId: q.id, answer: q.keyText }))
      c.s.total = pool.length
      c.s.pendingQ = pool[0]?.id ?? null
      c.s.awaiting = 'answer'
      for (const pl of c.players) c.s.meter[key(pl)] = 0
      break
    }
  }
  return stamp(null, run(c), input.nowMs)
}

function factOf(
  q: PoolQuestion,
  rng: Prng,
  secretInt?: (max: number) => number,
): { qId: string; text: string; isTrue: boolean } {
  const options = q.options.map((o) => o.text).filter((t) => t !== '')
  const isTrue = secretInt ? secretInt(2) === 0 : chance(rng, 0.5)
  const wrong = options.filter((t) => t !== q.keyText)
  const pickWrong = (): string =>
    secretInt ? (wrong[secretInt(wrong.length)] as string) : rng.pick(wrong)
  const shown = isTrue || wrong.length === 0 ? q.keyText : pickWrong()
  return { qId: q.id, text: `${q.text} → ${shown}`, isTrue: isTrue || wrong.length === 0 }
}

/** BR-M16-20: tile 1 start, 50 finish, 3 ladders, 3 snakes, 2 bonus, 2 traps, quiz tiles, the rest plain. */
export function buildBoard(quizTiles: number, rng: Prng): string[] {
  const interior = Array.from({ length: BOARD_SIZE - 2 }, (_, i) => i + 2)
  shuffle(interior, rng)
  const board: string[] = Array.from({ length: BOARD_SIZE }, () => 'plain')
  board[0] = 'start'
  board[BOARD_SIZE - 1] = 'finish'
  let at = 0
  const place = (kind: (tile: number) => string, n: number): void => {
    for (let i = 0; i < n; i++) {
      const tile = interior[at++] as number
      board[tile - 1] = kind(tile)
    }
  }
  place(
    (t) => `ladder:${String(Math.min(BOARD_SIZE - 1, t + rng.int(5, 15)))}`,
    BOARD_FIXED.ladders,
  )
  place((t) => `snake:${String(Math.max(2, t - rng.int(5, 15)))}`, BOARD_FIXED.snakes)
  place(() => 'bonus', BOARD_FIXED.bonus)
  place(() => 'trap', BOARD_FIXED.traps)
  place(() => 'quiz', Math.max(0, Math.min(quizTiles, interior.length - at)))
  return board
}

// --- actions -------------------------------------------------------------------------------------------------------

export interface ActionInput {
  room: EngineRoom
  players: EnginePlayer[]
  state: RoomState
  action: RoomPlayAction
  p: number
  nowMs: number
  streams?: StreamFactory
}

export function applyAction(input: ActionInput): EngineOut {
  const { room, action } = input
  const c: Ctx = {
    room,
    players: input.players.map((x) => ({ ...x })),
    s: structuredClone(input.state),
    streams: input.streams ?? defaultStreams,
    p: input.p,
    nowMs: input.nowMs,
    answered: [],
  }
  if (action.type === 'roll') {
    if (room.game !== 'papan-bijak' || c.s.awaiting !== 'roll') {
      throw new EngineRefusal('conflict', 'Bukan giliran anda untuk gulung dadu.')
    }
    return stamp(input.state, pbRoll(c), input.nowMs)
  }
  if (c.s.awaiting !== 'answer' || c.s.pendingQ === null) {
    throw new EngineRefusal('conflict', 'Tiada soalan untuk dijawab.')
  }
  if (action.questionId !== c.s.pendingQ) {
    throw new EngineRefusal('validation', 'Soalan tidak sepadan.', 'questionId')
  }
  let out: EngineOut
  switch (room.game) {
    case 'papan-bijak':
      out = pbAnswer(c, action)
      break
    case 'perang-fakta':
      out = pfAnswer(c, action)
      break
    case 'benteng-ilmu':
      out = bentengAnswer(c, action)
      break
    case 'perlumbaan-matematik':
      out = mathraceAnswer(c, action)
      break
    case 'kuiz-relay':
      out = relayAnswer(c, action)
      break
    case 'teka-silang-kata':
      out = crosswordAnswer(c, action)
      break
  }
  return stamp(input.state, out, input.nowMs)
}

export interface TimeoutInput {
  room: EngineRoom
  players: EnginePlayer[]
  state: RoomState
  p: number
  /** Start (ms) given to the next round the timeout produces. */
  roundStartMs: number
  streams?: StreamFactory
}

/**
 * Time ran out for the room's clock (FR-GM-00.7): a Perang Fakta round advances as a no-vote of the acting player; a Teka
 * Silang Kata game ends with the words found so far; a Papan Bijak roll rolls itself; any other question is a wrong answer.
 */
export function applyTimeout(input: TimeoutInput): EngineOut {
  const res = timeoutStep(input)
  // The seat the clock ran out on missed its turn: 3 in a row with no poll in between remove it (FR-GM-R.4).
  const actor = input.players.find((x) => x.userId === input.state.humanId)
  if (actor && !actor.isBot) seatOf(res.state, actor.userId).missed += 1
  return res
}

function timeoutStep(input: TimeoutInput): EngineOut {
  const { room } = input
  const c: Ctx = {
    room,
    players: input.players.map((x) => ({ ...x })),
    s: structuredClone(input.state),
    streams: input.streams ?? defaultStreams,
    p: input.p,
    nowMs: input.roundStartMs,
    answered: [],
  }
  if (room.game === 'perang-fakta' && c.s.awaiting === 'answer') {
    return stamp(input.state, pfAdvance(c, false, true), input.roundStartMs)
  }
  if (room.game === 'papan-bijak' && c.s.awaiting === 'roll') {
    return stamp(input.state, pbRoll(c), input.roundStartMs)
  }
  if (c.s.awaiting === 'answer' && c.s.pendingQ !== null && room.game !== 'teka-silang-kata') {
    const noAnswer: Answer = { type: 'answer', questionId: c.s.pendingQ, optionId: null, value: undefined, seconds: 15 }
    const timedOut = room.game === 'papan-bijak' ? pbAnswer(c, noAnswer) : room.game === 'benteng-ilmu' ? bentengAnswer(c, noAnswer) : room.game === 'perlumbaan-matematik' ? mathraceAnswer(c, noAnswer) : relayAnswer(c, noAnswer)
    return stamp(input.state, timedOut, input.roundStartMs)
  }
  if (room.game === 'teka-silang-kata') {
    // AC-GM-07.3: the words not attempted at 300 s are wrong and written as timeouts.
    for (const word of c.s.words.slice(c.s.round - 1)) logAnswer(c, human(c), word.qId, false, true)
    c.s.winnerId = topWinner(c, (x) => x.points)
    return stamp(input.state, finish(c), input.roundStartMs)
  }
  throw new EngineRefusal('conflict', 'Tiada jam untuk permainan ini.')
}

/** The round clock restarts when the round, the Papan Bijak turn or what the room awaits changes (and at the start). */
function stamp(prev: RoomState | null, out: EngineOut, startMs: number): EngineOut {
  const same = prev && prev.round === out.state.round && prev.turn === out.state.turn && prev.awaiting === out.state.awaiting
  out.state.roundStartedMs = same && prev.roundStartedMs !== null ? prev.roundStartedMs : startMs
  return out
}

type Answer = Extract<RoomPlayAction, { type: 'answer' }>

/** Whether an MCQ answer is right (a `null` option is a timeout). */
function mcqRight(c: Ctx, qId: string, optionId: number | null): boolean {
  const q = c.s.qs[qId]
  return q !== undefined && optionId !== null && optionId === q.keyIndex
}

/** The Perang Fakta vote: `value` true / false, or `optionId` 0 (Betul) / 1 (Salah). */
function voteOf(a: Answer): boolean | null {
  if (typeof a.value === 'boolean') return a.value
  if (a.optionId === 0) return true
  if (a.optionId === 1) return false
  return null
}

const norm = (t: string): string => t.trim().toLowerCase()

function run(c: Ctx): EngineOut {
  switch (c.room.game) {
    case 'papan-bijak':
      return pbRun(c)
    case 'kuiz-relay':
      return relayRun(c)
    default:
      return out(c)
  }
}

function out(c: Ctx): EngineOut {
  const finished = c.s.awaiting === null && c.s.pendingQ === null
  return { state: c.s, players: c.players, finished, answered: c.answered }
}

function finish(c: Ctx): EngineOut {
  c.s.awaiting = null
  c.s.pendingQ = null
  return { state: c.s, players: c.players, finished: true, answered: c.answered }
}

/** The winner with the highest `of` value; a tie has no winner. */
function topWinner(c: Ctx, of: (pl: EnginePlayer) => number): string | null {
  const sorted = [...c.players].sort((a, b) => of(b) - of(a) || cmpId(a.userId, b.userId))
  const [a, b] = sorted
  if (!a) return null
  if (b && of(b) === of(a)) return null
  return a.userId
}

// --- Papan Bijak -------------------------------------------------------------------------------------------------

function pbMove(c: Ctx, pl: EnginePlayer, dice: number): 'quiz' | 'moved' {
  const k = pl.userId
  const from = c.s.positions[k] ?? 1
  let pos = Math.min(BOARD_SIZE, from + dice)
  if (pos < BOARD_SIZE) {
    const kind = c.s.board[pos - 1] ?? 'plain'
    if (kind.startsWith('ladder:') || kind.startsWith('snake:')) {
      pos = Number(kind.split(':')[1])
    } else if (kind === 'bonus') pos = Math.min(BOARD_SIZE, pos + BOARD_STEP)
    else if (kind === 'trap') pos = Math.max(1, pos - BOARD_STEP)
    else if (kind === 'quiz') {
      c.s.positions[k] = pos
      c.s.meter[k] = from
      return 'quiz'
    }
  }
  c.s.positions[k] = pos
  if (pos >= BOARD_SIZE) c.s.winnerId = pl.userId
  return 'moved'
}

function pbSettle(c: Ctx): EngineOut {
  for (const pl of c.players) {
    pl.points = pl.correct * 10 + (pl.userId === c.s.winnerId ? 50 : 0)
  }
  return finish(c)
}

/** 48 GAME-02: the safety rule: the highest tile wins, equal highest tiles are a draw. */
function pbSafety(c: Ctx): EngineOut {
  c.s.winnerId = topWinner(c, (x) => c.s.positions[x.userId] ?? 1)
  return pbSettle(c)
}

function pbRun(c: Ctx): EngineOut {
  for (let i = 0; i < 600; i++) {
    if (c.s.winnerId !== null) return pbSettle(c)
    if (c.s.turn >= PB_MAX_ROUNDS * c.players.length) return pbSafety(c)
    const pl = c.players[c.s.turn % c.players.length] as EnginePlayer
    if (!pl.isBot) {
      // A human seat: the room waits for this seat's roll (30 s) and nobody else may act.
      c.s.humanId = pl.userId
      c.s.awaiting = 'roll'
      c.s.pendingQ = null
      return out(c)
    }
    const dice = 1 + Math.floor(draw(c).next() * 6)
    const r = pbMove(c, pl, dice)
    if (r === 'quiz') {
      nextQ(c)
      if (draw(c).next() < c.p) pl.correct += 1
      else c.s.positions[pl.userId] = c.s.meter[pl.userId] ?? 1
    }
    if (c.s.winnerId !== null) return pbSettle(c)
    c.s.turn += 1
  }
  return pbSettle(c)
}

function pbRoll(c: Ctx): EngineOut {
  const pl = human(c)
  const dice = 1 + Math.floor(draw(c).next() * 6)
  c.s.log.push(`roll:${String(dice)}`)
  if (pbMove(c, pl, dice) === 'quiz') {
    c.s.pendingQ = nextQ(c)
    c.s.awaiting = 'answer'
    return out(c)
  }
  c.s.awaiting = null
  if (c.s.winnerId === null) c.s.turn += 1
  return pbRun(c)
}

function pbAnswer(c: Ctx, a: Answer): EngineOut {
  const me = human(c)

  const right = mcqRight(c, c.s.pendingQ as string, a.optionId)
  logAnswer(c, me, c.s.pendingQ as string, right, noPick(a))
  if (right) me.correct += 1
  else c.s.positions[me.userId] = c.s.meter[me.userId] ?? 1
  c.s.pendingQ = null
  c.s.awaiting = null
  c.s.turn += 1
  return pbRun(c)
}

// --- Perang Fakta ---------------------------------------------------------------------------------------------------

/**
 * A vote of the acting player. `optionId: null` with no `value` is a timeout (the 10 s of the round ran out): the
 * player scores 0 and the bots still draw (BR-M16-20).
 */
function pfAnswer(c: Ctx, a: Answer): EngineOut {
  const vote = voteOf(a)
  const timeout = vote === null && a.optionId === null && a.value === undefined
  if (vote === null && !timeout) {
    throw new EngineRefusal('validation', 'Jawapan tidak sah.', 'value')
  }
  const fact = c.s.facts[c.s.round - 1] as { isTrue: boolean }
  return pfAdvance(c, vote !== null && vote === fact.isTrue, timeout)
}

function pfAdvance(c: Ctx, humanRight: boolean, timedOut: boolean): EngineOut {
  const me = human(c)
  logAnswer(c, me, c.s.pendingQ as string, humanRight, timedOut)
  if (humanRight) {
    me.correct += 1
    me.points += 1
  }
  for (const bot of others(c)) {
    if (draw(c).next() < c.p) {
      bot.correct += 1
      bot.points += 1
    }
  }
  c.s.round += 1
  if (c.s.round > c.s.total) {
    c.s.winnerId = topWinner(c, (x) => x.points)
    return finish(c)
  }
  c.s.pendingQ = (c.s.facts[c.s.round - 1] as { qId: string }).qId
  return out(c)
}

// --- Benteng Ilmu ----------------------------------------------------------------------------------------------------

function bentengAnswer(c: Ctx, a: Answer): EngineOut {
  const me = human(c)
  const foe = others(c)[0] as EnginePlayer
  const hp = (pl: EnginePlayer): number => c.s.meter[pl.userId] ?? BENTENG_HP
  const right = mcqRight(c, c.s.pendingQ as string, a.optionId)
  logAnswer(c, me, c.s.pendingQ as string, right, noPick(a))
  if (right) {
    me.correct += 1
    me.points += 10
    c.s.meter[foe.userId] = hp(foe) - BENTENG_DAMAGE
  } else c.s.meter[me.userId] = hp(me) - BENTENG_DAMAGE
  const dead = (pl: EnginePlayer): boolean => (c.s.meter[pl.userId] ?? 0) <= 0
  if (dead(foe)) {
    c.s.winnerId = me.userId
    return finish(c)
  }
  if (dead(me)) {
    c.s.winnerId = foe.userId
    return finish(c)
  }
  // The simulated opponent's turn.
  if (draw(c).next() < c.p) {
    foe.correct += 1
    foe.points += 10
    c.s.meter[me.userId] = hp(me) - BENTENG_DAMAGE
  } else c.s.meter[foe.userId] = hp(foe) - BENTENG_DAMAGE
  if (dead(me)) {
    c.s.winnerId = foe.userId
    return finish(c)
  }
  if (dead(foe)) {
    c.s.winnerId = me.userId
    return finish(c)
  }
  c.s.round += 1
  c.s.pendingQ = nextQ(c)
  return out(c)
}

// --- Perlumbaan Matematik ----------------------------------------------------------------------------------------

function mathraceAnswer(c: Ctx, a: Answer): EngineOut {
  const me = human(c)
  const right = mcqRight(c, c.s.pendingQ as string, a.optionId)
  logAnswer(c, me, c.s.pendingQ as string, right, noPick(a))
  if (right) {
    me.correct += 1
    c.s.meter[me.userId] = (c.s.meter[me.userId] ?? 0) + 1
  }
  if ((c.s.meter[me.userId] ?? 0) >= MATHRACE_STEPS) {
    c.s.winnerId = me.userId
    return mathraceEnd(c)
  }
  for (const bot of others(c)) {
    if (draw(c).next() < c.p) {
      bot.correct += 1
      c.s.meter[bot.userId] = (c.s.meter[bot.userId] ?? 0) + 1
      if ((c.s.meter[bot.userId] ?? 0) >= MATHRACE_STEPS) {
        c.s.winnerId = bot.userId
        return mathraceEnd(c)
      }
    }
  }
  c.s.round += 1
  if (c.s.round > 200) {
    c.s.winnerId = topWinner(c, (x) => c.s.meter[x.userId] ?? 0)
    return mathraceEnd(c)
  }
  c.s.pendingQ = nextQ(c)
  return out(c)
}

function mathraceEnd(c: Ctx): EngineOut {
  for (const pl of c.players) pl.points = c.s.meter[pl.userId] ?? 0
  return finish(c)
}

// --- Kuiz Relay -------------------------------------------------------------------------------------------------------

function relayScore(seconds: number): number {
  return 10 + Math.max(0, 10 - seconds)
}

function relayRun(c: Ctx): EngineOut {
  for (let i = 0; i < 100; i++) {
    if (c.s.round > c.s.total) return relayEnd(c)
    const pl = c.players[(c.s.round - 1) % c.players.length] as EnginePlayer
    const qId = c.s.qIds[(c.s.round - 1) % c.s.qIds.length] as string
    if (!pl.isBot) {
      // A human seat: the room waits for this seat's answer (15 s).
      c.s.humanId = pl.userId
      c.s.pendingQ = qId
      c.s.awaiting = 'answer'
      return out(c)
    }
    const rng = draw(c)
    const seconds = clampSeconds(2 + 10 * rng.next())
    if (rng.next() < c.p) {
      const gain = relayScore(seconds)
      pl.correct += 1
      pl.points += gain
      c.s.teamScores[String(pl.team)] = (c.s.teamScores[String(pl.team)] ?? 0) + gain
    }
    c.s.round += 1
  }
  return relayEnd(c)
}

function relayAnswer(c: Ctx, a: Answer): EngineOut {
  const me = human(c)
  const right = mcqRight(c, c.s.pendingQ as string, a.optionId)
  logAnswer(c, me, c.s.pendingQ as string, right, noPick(a))
  if (right) {
    // 48 GAME-06: whole seconds used by the SERVER clock since the turn began; the client's `seconds` is not trusted.
    const gain = relayScore(clampSeconds(ctxSeconds(c)))
    me.correct += 1
    me.points += gain
    c.s.teamScores[String(me.team)] = (c.s.teamScores[String(me.team)] ?? 0) + gain
  }
  c.s.round += 1
  c.s.pendingQ = null
  c.s.awaiting = null
  return relayRun(c)
}

function relayEnd(c: Ctx): EngineOut {
  const t1 = c.s.teamScores['1'] ?? 0
  const t2 = c.s.teamScores['2'] ?? 0
  const team = t2 > t1 ? 2 : 1
  const mvp = c.players
    .filter((x) => x.team === team)
    .sort((x, y) => y.points - x.points || cmpId(x.userId, y.userId))[0]
  c.s.mvpId = mvp?.userId ?? null
  return finish(c)
}

// --- Teka Silang Kata ---------------------------------------------------------------------------------------------------

function crosswordAnswer(c: Ctx, a: Answer): EngineOut {
  const me = human(c)
  const word = c.s.words[c.s.round - 1] as { answer: string }
  const right = typeof a.value === 'string' && norm(a.value) === norm(word.answer)
  logAnswer(c, me, c.s.pendingQ as string, right, noPick(a))
  if (right) {
    me.correct += 1
    me.points += 1
    c.s.meter[me.userId] = (c.s.meter[me.userId] ?? 0) + 1
  }
  for (const bot of others(c)) {
    if (draw(c).next() < c.p) {
      bot.correct += 1
      bot.points += 1
      c.s.meter[bot.userId] = (c.s.meter[bot.userId] ?? 0) + 1
    }
  }
  c.s.round += 1
  if (c.s.round > c.s.total) {
    c.s.winnerId = topWinner(c, (x) => x.points)
    return finish(c)
  }
  c.s.pendingQ = (c.s.words[c.s.round - 1] as { qId: string }).qId
  return out(c)
}

// --- a seat changes hands -----------------------------------------------------------------------------------------------

export interface HandOverInput {
  room: EngineRoom
  /** The seats after the change: the leaver's seat is now a robot. */
  players: EnginePlayer[]
  state: RoomState
  /** Old seat key to new seat key, for every seat whose key changed (the leaver's, and the robots renumbered). */
  remap: Record<string, string>
  /** The old seat key of the human who left. */
  leaver: string
  p: number
  nowMs: number
  streams?: StreamFactory
}

const mapKeys = <T>(rec: Record<string, T>, m: (k: string) => string): Record<string, T> =>
  Object.fromEntries(Object.entries(rec).map(([k, v]) => [m(k), v]))

/**
 * A human left a game in play and a robot took the seat (ruling 50, while 2 or more humans remain). The state is re-keyed
 * to the new seat keys; when the room was waiting for the leaver, the robot plays that turn at once (Papan Bijak,
 * Kuiz Relay) or the acting seat passes to the next human (the own-part games, which wait for one human).
 */
export function handOverSeat(input: HandOverInput): EngineOut {
  const m = (k: string): string => input.remap[k] ?? k
  const c: Ctx = {
    room: input.room,
    players: input.players.map((x) => ({ ...x })),
    s: structuredClone(input.state),
    streams: input.streams ?? defaultStreams,
    p: input.p,
    nowMs: input.nowMs,
    answered: [],
  }
  const s = c.s
  s.positions = mapKeys(s.positions, m)
  s.meter = mapKeys(s.meter, m)
  if (s.seats) s.seats = Object.fromEntries(Object.entries(s.seats).filter(([k]) => k !== input.leaver))
  s.humanId = m(s.humanId)
  if (s.winnerId !== null) s.winnerId = m(s.winnerId)
  if (s.mvpId !== null) s.mvpId = m(s.mvpId)
  if (input.state.humanId !== input.leaver) return { state: s, players: c.players, finished: false, answered: [] }
  const game = input.room.game
  if (game !== 'papan-bijak' && game !== 'kuiz-relay') {
    // Own part (GAME-03/04/05/07): the one acting seat passes to the next human.
    const next = c.players.find((x) => !x.isBot)
    if (next) s.humanId = next.userId
    return { state: s, players: c.players, finished: false, answered: [] }
  }
  let res: EngineOut
  if (game === 'kuiz-relay') {
    s.awaiting = null
    s.pendingQ = null
    res = relayRun(c)
  } else if (s.awaiting === 'answer') {
    // The leaver stood on a quiz tile: the robot answers it with the platform accuracy.
    const pl = human(c)
    if (draw(c).next() < c.p) pl.correct += 1
    else s.positions[pl.userId] = s.meter[pl.userId] ?? 1
    s.pendingQ = null
    s.awaiting = null
    s.turn += 1
    res = pbRun(c)
  } else {
    s.awaiting = null
    s.pendingQ = null
    res = pbRun(c)
  }
  return stamp(input.state, res, input.nowMs)
}
