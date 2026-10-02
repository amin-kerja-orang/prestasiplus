/**
 * M14 test hooks (`window.__mock`, dev and e2e builds; SRS M14 v1.8 §6.14, §6.11.6, XR-M15-08).
 * Hook names are global, so they are the ones the SRS names:
 *
 * | Hook | Effect |
 * |---|---|
 * | `setWallet(userId, {syiling?, tokens?, xp?, level?, tierKey?})` | sets fields directly, **no** ledger row (fixtures only) |
 * | `getWallet(userId)` | the summary of #2 |
 * | `ledger(userId, {type?})` | the user's ledger rows, newest first |
 * | `createDraw({title, description?, ticketCostSyiling?, maxTicketsPerStudent?, prizePool?, closesAt, openNow?})` | creates a draw (S10 #43 without the HTTP layer) |
 * | `setStreak(userId, {current, best, lastActivityDate})` | sets the stored streak |
 * | `setTeacherWallet(userId, {balance?, questionsCount?})` | sets the teacher wallet, no ledger row |
 * | `gamificationSession(userId, {mode, correct, total, timeSpentSec, at?})` | one completed session through M05 `mock.addSession` (no answers), then `onSessionCompleted` exactly as M05 BR-31 does |
 * | `gameResult(userId, {game, event, coins?, xp})` | `onGameResult` → `{coinsCredited, xpAdded}` |
 * | `m14LoadFixture(name)` | the fixtures of §6.11.6: `m14-teacher-reward`, `m14-draw-open`, `m14-cash-flow`, `m14-complimentary` |
 *
 * Every hook validates its input and throws a `RangeError` / `TypeError`, so a typo in a test fails
 * at the call. The time is the shared mock clock.
 */

import { toIsoMyt } from '@/lib/time'
import { users } from '@/modules/m01-authentication/mock'

import {
  coinLedgerRepo,
  drawsRepo,
  gamificationRepo,
  streakRepo,
  teacherRewardsRepo,
  teacherWalletRepo,
  tiersRepo,
  walletRepo,
  type DrawInput,
} from '../repository'
import { nowMs } from '../repository/ops'
import { insertSession } from '../repository/reads'
import type { LedgerType } from '../repository/types'

const isCount = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v)
const LEDGER_TYPES: readonly string[] = ['earn', 'spend', 'convert', 'bonus', 'refund']
const MODES: readonly string[] = [
  'random',
  'chapter',
  'revision',
  'mission',
  'remedial',
  'question_set',
  'pksk',
  'past_year',
  'latih_tubi',
  'ramalan',
]

function requireUser(userId: number, what: string): void {
  if (!isInt(userId) || userId < 1)
    throw new RangeError(`${what}: invalid userId ${String(userId)}`)
  if (!users.get(userId)) throw new RangeError(`${what}: unknown user ${String(userId)}`)
}

function requireObject(value: unknown, what: string, shape: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${what}: expected ${shape}`)
  }
  return value as Record<string, unknown>
}

function dateOf(value: unknown, what: string): string {
  const ms =
    typeof value === 'string' || typeof value === 'number' ? new Date(value).getTime() : Number.NaN
  if (!Number.isFinite(ms)) throw new RangeError(`${what}: invalid time ${String(value)}`)
  return toIsoMyt(ms)
}

/** `mock.setWallet` (§6.14): direct fields, no ledger row. Returns the summary. */
export function setWallet(
  userId: number,
  fields: { syiling?: number; tokens?: number; xp?: number; level?: number; tierKey?: string },
) {
  requireUser(userId, 'setWallet')
  const f = requireObject(fields, 'setWallet', '{syiling?, tokens?, xp?, level?, tierKey?}')
  for (const key of ['syiling', 'xp'] as const) {
    if (f[key] !== undefined && !isCount(f[key])) {
      throw new RangeError(`setWallet: ${key} must be a non-negative integer`)
    }
  }
  if (f.tokens !== undefined && !isInt(f.tokens)) {
    throw new RangeError('setWallet: tokens must be an integer')
  }
  if (f.level !== undefined && (!isInt(f.level) || f.level < 1)) {
    throw new RangeError('setWallet: level must be an integer ≥ 1')
  }
  if (f.tierKey !== undefined) {
    if (typeof f.tierKey !== 'string' || !tiersRepo.list().some((t) => t.tierName === f.tierKey)) {
      throw new RangeError(`setWallet: unknown tier ${JSON.stringify(f.tierKey)}`)
    }
  }
  walletRepo.setFields(userId, fields)
  return walletRepo.summary(userId)
}

/** `mock.getWallet` (§6.14): the summary of #2. */
export function getWallet(userId: number) {
  requireUser(userId, 'getWallet')
  return walletRepo.summary(userId)
}

/** `mock.ledger` (§6.14): the user's rows, newest first (`type` narrows to one type). */
export function ledger(userId: number, options: { type?: LedgerType } = {}) {
  requireUser(userId, 'ledger')
  const o = requireObject(options, 'ledger', '{type?}')
  if (o.type !== undefined && (typeof o.type !== 'string' || !LEDGER_TYPES.includes(o.type))) {
    throw new RangeError(`ledger: unknown type ${JSON.stringify(o.type)}`)
  }
  return coinLedgerRepo.forUser(userId, o.type as LedgerType | undefined)
}

/** `mock.createDraw` (§6.14, XR-M15-08): returns the draw. */
export function createDraw(input: DrawInput & { closesAt: string }) {
  const d = requireObject(input, 'createDraw', '{title, closesAt, …}')
  if (typeof d.title !== 'string' || d.title.trim() === '') {
    throw new TypeError('createDraw: title is required')
  }
  if (typeof d.closesAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.closesAt)) {
    throw new RangeError('createDraw: closesAt must be YYYY-MM-DD')
  }
  for (const key of ['ticketCostSyiling', 'maxTicketsPerStudent'] as const) {
    const v = d[key]
    if (v !== undefined && (!isInt(v) || v < 1)) {
      throw new RangeError(`createDraw: ${key} must be an integer ≥ 1`)
    }
  }
  return drawsRepo.create(input)
}

/** `mock.setStreak` (§6.14). Returns `streak.get`. */
export function setStreak(
  userId: number,
  s: { current: number; best: number; lastActivityDate: string | null },
) {
  requireUser(userId, 'setStreak')
  const o = requireObject(s, 'setStreak', '{current, best, lastActivityDate}')
  if (!isCount(o.current) || !isCount(o.best) || o.best < o.current) {
    throw new RangeError('setStreak: need integers with 0 ≤ current ≤ best')
  }
  if (
    o.lastActivityDate !== null &&
    (typeof o.lastActivityDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.lastActivityDate))
  ) {
    throw new RangeError('setStreak: lastActivityDate must be YYYY-MM-DD or null')
  }
  streakRepo.set(userId, s)
  return streakRepo.get(userId)
}

/** `mock.setTeacherWallet` (§6.14): no ledger row. */
export function setTeacherWallet(
  userId: number,
  fields: { balance?: number; questionsCount?: number },
) {
  requireUser(userId, 'setTeacherWallet')
  const f = requireObject(fields, 'setTeacherWallet', '{balance?, questionsCount?}')
  for (const key of ['balance', 'questionsCount'] as const) {
    if (f[key] !== undefined && !isCount(f[key])) {
      throw new RangeError(`setTeacherWallet: ${key} must be a non-negative integer`)
    }
  }
  return teacherWalletRepo.setFields(userId, fields)
}

/**
 * `mock.gamificationSession` (§6.14, SQ-M14-05): inserts one completed session without answers
 * (M05 `mock.addSession`) and credits it as BR-31 does (10 points per correct answer, M05 BR-09).
 */
export function gamificationSession(
  userId: number,
  input: {
    mode: string
    correct: number
    total: number
    timeSpentSec: number
    at?: string | number
  },
) {
  requireUser(userId, 'gamificationSession')
  const s = requireObject(input, 'gamificationSession', '{mode, correct, total, timeSpentSec, at?}')
  if (typeof s.mode !== 'string' || !MODES.includes(s.mode)) {
    throw new RangeError(`gamificationSession: unknown mode ${String(s.mode)}`)
  }
  if (!isCount(s.correct) || !isCount(s.total) || s.correct > s.total) {
    throw new RangeError('gamificationSession: need integers with 0 ≤ correct ≤ total')
  }
  if (!isCount(s.timeSpentSec)) throw new RangeError('gamificationSession: invalid timeSpentSec')
  const at = dateOf(s.at ?? nowMs(), 'gamificationSession')
  const sessionId = insertSession(userId, {
    mode: s.mode,
    correct: s.correct,
    total: s.total,
    timeSpentSec: s.timeSpentSec,
    at,
  })
  const result = gamificationRepo.onSessionCompleted({
    userId,
    sessionId,
    mode: s.mode,
    correct: s.correct,
    total: s.total,
    timeSpent: s.timeSpentSec,
    completedAt: at,
    pointsEarned: 10 * s.correct,
  })
  return { sessionId, ...result }
}

/** `mock.gameResult` (§6.14, BR-M14-21): `{coinsCredited, xpAdded}`. */
export function gameResult(
  userId: number,
  input: { game: string; event: string; coins?: number; xp: number },
) {
  requireUser(userId, 'gameResult')
  const g = requireObject(input, 'gameResult', '{game, event, coins?, xp}')
  if (
    typeof g.game !== 'string' ||
    g.game === '' ||
    typeof g.event !== 'string' ||
    g.event === ''
  ) {
    throw new TypeError('gameResult: game and event are required')
  }
  if (!isCount(g.xp) || (g.coins !== undefined && !isCount(g.coins))) {
    throw new RangeError('gameResult: xp and coins must be non-negative integers')
  }
  return gamificationRepo.onGameResult(userId, input)
}

/** The fixtures of §6.11.6 (unobserved states; never in the default seed). */
const FIXTURES = [
  'm14-teacher-reward',
  'm14-draw-open',
  'm14-cash-flow',
  'm14-complimentary',
] as const
type FixtureName = (typeof FIXTURES)[number]

/**
 * `m14LoadFixture(name)` (§6.11.6): `m14-teacher-reward` adds the teacher reward 1001 "Baucar Buku
 * RM20"; `m14-draw-open` creates the open draw "Cabutan Demo"; `m14-cash-flow` and
 * `m14-complimentary` add nothing (the first is created at runtime by AC-29.3; the second is the M02
 * fixture 5901 logged in with `setUser`).
 */
export function m14LoadFixture(name: FixtureName) {
  if (!FIXTURES.includes(name)) {
    throw new RangeError(`m14LoadFixture: unknown fixture ${String(name)}`)
  }
  switch (name) {
    case 'm14-teacher-reward':
      return teacherRewardsRepo.createFixture({
        id: 1001,
        name: 'Baucar Buku RM20',
        category: 'voucher',
        costCoins: 200,
        stock: 5,
        maxPerUser: 1,
        maxPerMonth: null,
        description: '',
        imageUrl: null,
        isActive: true,
        createdAt: toIsoMyt(nowMs()),
      })
    case 'm14-draw-open':
      return drawsRepo.create({
        title: 'Cabutan Demo',
        description: '',
        ticketCostSyiling: 50,
        maxTicketsPerStudent: 10,
        prizePool: [{ label: 'Hadiah Demo', valueSen: 1000, qty: 1 }],
        closesAt: '2026-09-30',
        openNow: true,
      })
    default:
      return null
  }
}

export const m14Hooks = {
  setWallet,
  getWallet,
  ledger,
  createDraw,
  setStreak,
  setTeacherWallet,
  gamificationSession,
  gameResult,
  m14LoadFixture,
}
