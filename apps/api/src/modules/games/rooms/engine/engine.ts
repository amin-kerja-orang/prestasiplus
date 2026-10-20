/**
 * The room game engine (SRS M16 BR-M16-19/20, PROVISIONAL): a PURE port of the mock `room-engine.ts`. Every
 * other player is a SIMULATION (D53(a)): only the acting player (`humanId`, the host) is awaited; bots answer
 * correctly with probability `p` (the platform answer accuracy). Dice, boards and bot answers come from named
 * streams `m16:room:<code>:...`, so the same room and the same actions give the same game. The clock is injected
 * as `nowMs`; the engine never reads the system time, never touches the database and never throws anything but
 * `EngineRefusal`.
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
} from './constants'
import { chance, cmpId, shuffle } from './rng'
import {
  EngineRefusal,
  type EngineOut,
  type EnginePlayer,
  type EngineRoom,
  type PoolQuestion,
  type RoomAction,
  type RoomState,
  type StreamFactory,
} from './types'

interface Ctx {
  room: EngineRoom
  players: EnginePlayer[]
  s: RoomState
  streams: StreamFactory
  p: number
}

const defaultStreams: StreamFactory = (name) => prngStream(name)

const draw = (c: Ctx): Prng => c.streams(`m16:room:${c.room.code}:d${String(c.s.draws++)}`)
const human = (c: Ctx): EnginePlayer =>
  c.players.find((x) => x.userId === c.s.humanId) as EnginePlayer
const others = (c: Ctx): EnginePlayer[] => c.players.filter((x) => x.userId !== c.s.humanId)
const nextQ = (c: Ctx): string => {
  const id = c.s.qIds[c.s.cursor % c.s.qIds.length] as string
  c.s.cursor += 1
  return id
}
const clampSeconds = (v: number): number => Math.min(15, Math.max(0, Math.floor(v)))

export function emptyState(humanId: string): RoomState {
  return {
    round: 1,
    total: 0,
    qIds: [],
    cursor: 0,
    qs: {},
    humanId,
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
  /** The drawn question pool, in draw order (the service draws it through BE-09). */
  pool: PoolQuestion[]
  quizTiles: number
  /** Bot answer probability, 0..1. */
  p: number
  nowMs: number
  streams?: StreamFactory
}

export function startGame(input: StartInput): EngineOut {
  const { room, pool } = input
  const streams = input.streams ?? defaultStreams
  const c: Ctx = {
    room,
    players: input.players.map((x) => ({ ...x })),
    s: emptyState(input.humanId),
    streams,
    p: input.p,
  }
  c.s.qIds = pool.map((q) => q.id)
  for (const q of pool) {
    c.s.qs[q.id] = { text: q.text, options: q.options, keyIndex: q.keyIndex, keyText: q.keyText }
  }
  const key = (pl: EnginePlayer): string => pl.userId
  switch (room.game) {
    case 'papan-bijak': {
      c.s.board = buildBoard(input.quizTiles, streams(`m16:room:${room.code}:board`))
      for (const pl of c.players) c.s.positions[key(pl)] = 1
      c.s.total = BOARD_SIZE
      break
    }
    case 'perang-fakta': {
      c.s.total = pool.length
      c.s.facts = pool.map((q) => factOf(q, draw(c)))
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

function factOf(q: PoolQuestion, rng: Prng): { qId: string; text: string; isTrue: boolean } {
  const options = q.options.map((o) => o.text).filter((t) => t !== '')
  const isTrue = chance(rng, 0.5)
  const wrong = options.filter((t) => t !== q.keyText)
  const shown = isTrue || wrong.length === 0 ? q.keyText : rng.pick(wrong)
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
  action: RoomAction
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
 * Time ran out for the room's clock (BR-M16-20): a Perang Fakta round advances as a no-vote of the acting player;
 * a Teka Silang Kata game ends with the words found so far.
 */
export function applyTimeout(input: TimeoutInput): EngineOut {
  const { room } = input
  const c: Ctx = {
    room,
    players: input.players.map((x) => ({ ...x })),
    s: structuredClone(input.state),
    streams: input.streams ?? defaultStreams,
    p: input.p,
  }
  if (room.game === 'perang-fakta' && c.s.awaiting === 'answer') {
    return stamp(input.state, pfAdvance(c, false), input.roundStartMs)
  }
  if (room.game === 'teka-silang-kata') {
    c.s.winnerId = topWinner(c, (x) => x.points)
    return stamp(input.state, finish(c), input.roundStartMs)
  }
  throw new EngineRefusal('conflict', 'Tiada jam untuk permainan ini.')
}

/** The round clock restarts when the round number changes (and at the start). */
function stamp(prev: RoomState | null, out: EngineOut, startMs: number): EngineOut {
  out.state.roundStartedMs =
    prev && prev.roundStartedMs !== null && prev.round === out.state.round
      ? prev.roundStartedMs
      : startMs
  return out
}

type Answer = Extract<RoomAction, { type: 'answer' }>

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
  return { state: c.s, players: c.players, finished }
}

function finish(c: Ctx): EngineOut {
  c.s.awaiting = null
  c.s.pendingQ = null
  return { state: c.s, players: c.players, finished: true }
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

function pbRun(c: Ctx): EngineOut {
  for (let i = 0; i < 600; i++) {
    if (c.s.winnerId !== null) return pbSettle(c)
    const pl = c.players[c.s.turn % c.players.length] as EnginePlayer
    if (pl.userId === c.s.humanId) {
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
  const pl = human(c)
  if (mcqRight(c, c.s.pendingQ as string, a.optionId)) pl.correct += 1
  else c.s.positions[pl.userId] = c.s.meter[pl.userId] ?? 1
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
  return pfAdvance(c, vote !== null && vote === fact.isTrue)
}

function pfAdvance(c: Ctx, humanRight: boolean): EngineOut {
  const me = human(c)
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
  if (mcqRight(c, c.s.pendingQ as string, a.optionId)) {
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
  if (mcqRight(c, c.s.pendingQ as string, a.optionId)) {
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
    if (pl.userId === c.s.humanId) {
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
  if (mcqRight(c, c.s.pendingQ as string, a.optionId)) {
    const gain = relayScore(clampSeconds(a.seconds))
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
  if (typeof a.value === 'string' && norm(a.value) === norm(word.answer)) {
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
