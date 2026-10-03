/**
 * The room game engine (SRS M16 v1.6 BR-M16-19/20, PROVISIONAL; every other player is a SIMULATION, D4):
 * pure functions over a room's players and `RoomState`. Only the acting viewer (`humanId`, the host) is
 * awaited; every other player answers by the M05 platform accuracy `p` (BR-M16-08). Dice, boards and bot
 * answers come from named streams `m16:room:<code>:…`, so the same room and actions give the same game.
 *
 * The engine never writes: the `rooms` repository applies the returned players and state.
 */

import type { Prng, PrngRegistry } from '@/mock/determinism'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { questions } from '@/modules/m04-question-bank/mock'

import {
  BENTENG_DAMAGE,
  BENTENG_HP,
  BOARD_FIXED,
  BOARD_SIZE,
  BOARD_STEP,
  CROSSWORD_WORDS,
  KR_ROUNDS,
  MATHRACE_STEPS,
  PF_ROUNDS,
  ROOM_SUBJECTS,
} from '../data/games'
import type { RoomGame, RoomState, RoomSubject } from '../types'
import { M16Error } from './common'
import { gradeOfEnum, keyOf } from './games-common'

export interface EnginePlayer {
  userId: number
  team: number | null
  points: number
  correct: number
  isBot: boolean
}

export interface EngineRoom {
  code: string
  game: RoomGame
  subject: RoomSubject
  gradeLevel: string
}

export interface EngineOut {
  state: RoomState
  players: EnginePlayer[]
  finished: boolean
}

export type RoomAction =
  | { type: 'roll' }
  | { type: 'answer'; questionId: number; optionId: number | null; value: unknown; seconds: number }

interface Ctx {
  room: EngineRoom
  players: EnginePlayer[]
  s: RoomState
  prng: PrngRegistry
  p: number
}

const draw = (c: Ctx): Prng => c.prng.fresh(`m16:room:${c.room.code}:d${String(c.s.draws++)}`)
const human = (c: Ctx): EnginePlayer =>
  c.players.find((x) => x.userId === c.s.humanId) as EnginePlayer
const others = (c: Ctx): EnginePlayer[] => c.players.filter((x) => x.userId !== c.s.humanId)
const key = (pl: EnginePlayer): string => String(pl.userId)
const nextQ = (c: Ctx): number => {
  const id = c.s.qIds[c.s.cursor % c.s.qIds.length] as number
  c.s.cursor += 1
  return id
}
const clampSeconds = (v: number): number => Math.min(15, Math.max(0, Math.floor(v)))

export function emptyState(humanId: number): RoomState {
  return {
    round: 1,
    total: 0,
    qIds: [],
    cursor: 0,
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
    log: [],
  }
}

// --- question pools ------------------------------------------------------------------------------------------

/**
 * Draws up to `n` MCQ ids of the room's subject and level (BR-M16-20), widening to the subject and then to
 * any eligible question when the level has too few; `fits` keeps the questions a game can use.
 */
export function drawPool(
  room: EngineRoom,
  n: number,
  rng: Prng,
  fits: (id: number) => boolean = (id) => keyOf(id) !== null,
): number[] {
  const subjectId = ROOM_SUBJECTS[room.subject]
  const grade = gradeOfEnum(room.gradeLevel)
  const levelId = grade === null ? null : (curriculum.levelForGrade(grade)?.id ?? null)
  const tries = [
    { subjectId, ...(levelId === null ? {} : { educationLevelIds: [levelId] }) },
    { subjectId },
    {},
  ]
  for (const t of tries) {
    const rows = questions.sampleKeyless({ ...t, questionType: 'mcq', eligible: true }, n * 8, rng)
    const ids = rows.map((r) => r.id).filter(fits)
    if (ids.length >= Math.min(n, 3)) return ids.slice(0, n)
  }
  throw new M16Error('CONFLICT', 'Soalan tidak mencukupi.')
}

// --- start ------------------------------------------------------------------------------------------------------

export function startGame(
  room: EngineRoom,
  players: EnginePlayer[],
  humanId: number,
  quizTiles: number,
  prng: PrngRegistry,
  p: number,
): EngineOut {
  const c: Ctx = { room, players: players.map((x) => ({ ...x })), s: emptyState(humanId), prng, p }
  const pool = prng.fresh(`m16:room:${room.code}:pool`)
  switch (room.game) {
    case 'papan-bijak': {
      c.s.qIds = drawPool(room, 40, pool)
      c.s.board = buildBoard(quizTiles, prng.fresh(`m16:room:${room.code}:board`))
      for (const pl of c.players) c.s.positions[key(pl)] = 1
      c.s.total = BOARD_SIZE
      break
    }
    case 'perang-fakta': {
      const ids = drawPool(room, PF_ROUNDS, pool, (id) => keyOf(id) !== null)
      c.s.qIds = ids
      c.s.total = ids.length
      c.s.facts = ids.map((id) => factOf(id, draw(c)))
      c.s.pendingQ = ids[0] as number
      c.s.awaiting = 'answer'
      for (const pl of c.players) c.s.meter[key(pl)] = 0
      break
    }
    case 'benteng-ilmu': {
      c.s.qIds = drawPool(room, 30, pool)
      c.s.total = c.s.qIds.length
      for (const pl of c.players) c.s.meter[key(pl)] = BENTENG_HP
      c.s.pendingQ = nextQ(c)
      c.s.awaiting = 'answer'
      break
    }
    case 'perlumbaan-matematik': {
      c.s.qIds = drawPool(room, 40, pool)
      c.s.total = MATHRACE_STEPS
      for (const pl of c.players) c.s.meter[key(pl)] = 0
      c.s.pendingQ = nextQ(c)
      c.s.awaiting = 'answer'
      break
    }
    case 'kuiz-relay': {
      c.s.qIds = drawPool(room, KR_ROUNDS, pool)
      c.s.total = KR_ROUNDS
      c.s.teamScores = { '1': 0, '2': 0 }
      c.players.forEach((pl, i) => {
        pl.team = (i % 2) + 1
      })
      break
    }
    case 'teka-silang-kata': {
      const short = (id: number): boolean => {
        const k = keyOf(id)
        return k !== null && k.text.trim().length > 0 && k.text.length <= 20
      }
      const ids = drawPool(room, CROSSWORD_WORDS, pool, short)
      c.s.qIds = ids
      c.s.words = ids.map((id) => ({ qId: id, answer: keyOf(id)?.text ?? '' }))
      c.s.total = ids.length
      c.s.pendingQ = ids[0] as number
      c.s.awaiting = 'answer'
      for (const pl of c.players) c.s.meter[key(pl)] = 0
      break
    }
  }
  return run(c)
}

function factOf(id: number, rng: Prng): { qId: number; text: string; isTrue: boolean } {
  const q = questions.get(id)
  const options = (q?.options ?? q?.pkskOptions?.map((o) => o.text) ?? []).filter((t) => t !== '')
  const k = keyOf(id)
  const stem = q?.questionText ?? ''
  const isTrue = rng.chance(0.5)
  const wrong = options.filter((t) => t !== k?.text)
  const shown = isTrue || wrong.length === 0 ? (k?.text ?? '') : rng.pick(wrong)
  return { qId: id, text: `${stem} → ${shown}`, isTrue: isTrue || wrong.length === 0 }
}

/** BR-M16-20: tile 1 start, 50 finish, 3 ladders, 3 snakes, 2 bonus, 2 traps, quiz tiles, the rest plain. */
export function buildBoard(quizTiles: number, rng: Prng): string[] {
  const interior = Array.from({ length: BOARD_SIZE - 2 }, (_, i) => i + 2)
  rng.shuffle(interior)
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

export function applyAction(
  room: EngineRoom,
  players: EnginePlayer[],
  state: RoomState,
  action: RoomAction,
  prng: PrngRegistry,
  p: number,
): EngineOut {
  const c: Ctx = {
    room,
    players: players.map((x) => ({ ...x })),
    s: structuredClone(state),
    prng,
    p,
  }
  if (action.type === 'roll') {
    if (room.game !== 'papan-bijak' || c.s.awaiting !== 'roll') {
      throw new M16Error('CONFLICT', 'Bukan giliran anda untuk gulung dadu.')
    }
    return pbRoll(c)
  }
  if (c.s.awaiting !== 'answer' || c.s.pendingQ === null) {
    throw new M16Error('CONFLICT', 'Tiada soalan untuk dijawab.')
  }
  if (action.questionId !== c.s.pendingQ) {
    throw new M16Error('VALIDATION_ERROR', 'Soalan tidak sepadan.', 'questionId')
  }
  switch (room.game) {
    case 'papan-bijak':
      return pbAnswer(c, action)
    case 'perang-fakta':
      return pfAnswer(c, action)
    case 'benteng-ilmu':
      return bentengAnswer(c, action)
    case 'perlumbaan-matematik':
      return mathraceAnswer(c, action)
    case 'kuiz-relay':
      return relayAnswer(c, action)
    case 'teka-silang-kata':
      return crosswordAnswer(c, action)
  }
}

type Answer = Extract<RoomAction, { type: 'answer' }>

/** Whether an MCQ answer is right (a `null` option is a timeout). */
function mcqRight(qId: number, optionId: number | null): boolean {
  const k = keyOf(qId)
  return k !== null && optionId !== null && optionId === k.index
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
function topWinner(c: Ctx, of: (pl: EnginePlayer) => number): number | null {
  const sorted = [...c.players].sort((a, b) => of(b) - of(a) || a.userId - b.userId)
  const [a, b] = sorted
  if (!a) return null
  if (b && of(b) === of(a)) return null
  return a.userId
}

// --- Papan Bijak -------------------------------------------------------------------------------------------------

function pbMove(c: Ctx, pl: EnginePlayer, dice: number): 'quiz' | 'moved' {
  const k = key(pl)
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
      else c.s.positions[key(pl)] = c.s.meter[key(pl)] ?? 1
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
  if (mcqRight(c.s.pendingQ as number, a.optionId)) pl.correct += 1
  else c.s.positions[key(pl)] = c.s.meter[key(pl)] ?? 1
  c.s.pendingQ = null
  c.s.awaiting = null
  c.s.turn += 1
  return pbRun(c)
}

// --- Perang Fakta ---------------------------------------------------------------------------------------------------

function pfAnswer(c: Ctx, a: Answer): EngineOut {
  const vote = voteOf(a)
  if (vote === null) throw new M16Error('VALIDATION_ERROR', 'Jawapan tidak sah.', 'value')
  const fact = c.s.facts[c.s.round - 1] as { isTrue: boolean }
  const me = human(c)
  if (vote === fact.isTrue) {
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
  c.s.pendingQ = (c.s.facts[c.s.round - 1] as { qId: number }).qId
  return out(c)
}

// --- Benteng Ilmu ----------------------------------------------------------------------------------------------------

function bentengAnswer(c: Ctx, a: Answer): EngineOut {
  const me = human(c)
  const foe = others(c)[0] as EnginePlayer
  if (mcqRight(c.s.pendingQ as number, a.optionId)) {
    me.correct += 1
    me.points += 10
    c.s.meter[key(foe)] = (c.s.meter[key(foe)] ?? BENTENG_HP) - BENTENG_DAMAGE
  } else c.s.meter[key(me)] = (c.s.meter[key(me)] ?? BENTENG_HP) - BENTENG_DAMAGE
  const dead = (pl: EnginePlayer): boolean => (c.s.meter[key(pl)] ?? 0) <= 0
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
    c.s.meter[key(me)] = (c.s.meter[key(me)] ?? BENTENG_HP) - BENTENG_DAMAGE
  } else c.s.meter[key(foe)] = (c.s.meter[key(foe)] ?? BENTENG_HP) - BENTENG_DAMAGE
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
  if (mcqRight(c.s.pendingQ as number, a.optionId)) {
    me.correct += 1
    c.s.meter[key(me)] = (c.s.meter[key(me)] ?? 0) + 1
  }
  if ((c.s.meter[key(me)] ?? 0) >= MATHRACE_STEPS) {
    c.s.winnerId = me.userId
    return mathraceEnd(c)
  }
  for (const bot of others(c)) {
    if (draw(c).next() < c.p) {
      bot.correct += 1
      c.s.meter[key(bot)] = (c.s.meter[key(bot)] ?? 0) + 1
      if ((c.s.meter[key(bot)] ?? 0) >= MATHRACE_STEPS) {
        c.s.winnerId = bot.userId
        return mathraceEnd(c)
      }
    }
  }
  c.s.round += 1
  if (c.s.round > 200) {
    c.s.winnerId = topWinner(c, (x) => c.s.meter[key(x)] ?? 0)
    return mathraceEnd(c)
  }
  c.s.pendingQ = nextQ(c)
  return out(c)
}

function mathraceEnd(c: Ctx): EngineOut {
  for (const pl of c.players) pl.points = c.s.meter[key(pl)] ?? 0
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
    const qId = c.s.qIds[(c.s.round - 1) % c.s.qIds.length] as number
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
  if (mcqRight(c.s.pendingQ as number, a.optionId)) {
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
    .sort((x, y) => y.points - x.points || x.userId - y.userId)[0]
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
    c.s.meter[key(me)] = (c.s.meter[key(me)] ?? 0) + 1
  }
  for (const bot of others(c)) {
    if (draw(c).next() < c.p) {
      bot.correct += 1
      bot.points += 1
      c.s.meter[key(bot)] = (c.s.meter[key(bot)] ?? 0) + 1
    }
  }
  c.s.round += 1
  if (c.s.round > c.s.total) {
    c.s.winnerId = topWinner(c, (x) => x.points)
    return finish(c)
  }
  c.s.pendingQ = (c.s.words[c.s.round - 1] as { qId: number }).qId
  return out(c)
}
