/**
 * Cross-module reads of M14, made **at call time** through the owners' public mock entries
 * (overview §6.7 "Call-time reads across modules"; D12; SRS M14 v1.7 §6.1, BR-M14-12/16). Nothing
 * here runs at module load, so the M05 ↔ M14 import cycle (M05 BR-31 step 6 calls M14; M14 reads
 * M05) is harmless.
 *
 * ## The M05 contract (F-26 must satisfy it; checked by `__tests__/mock/m05-contract.test.ts`)
 * On the `practice` repository exported by `@/modules/m05-practice/mock`:
 *
 * | Method | Returns |
 * |---|---|
 * | `practice.history(userId, {date?: 'YYYY-MM-DD', modes?: string[]})` | **all** completed sessions matching the filter, unpaged: an array of rows with the DATA-M05-01 fields `id` (string), `mode` (string), `status` (`'completed'`), `correct` (int), `total` (int), `completedAt` (ISO), `timeSpent` (seconds, int) |
 * | `practice.answers(userId, {date: 'YYYY-MM-DD'})` | that local day's answers: an array of rows with `chapterId` (int or null), `subjectId` (int or null), `isCorrect` (boolean), `answeredAt` (ISO) |
 * | `practice.mastery(userId)` | an array of `{subjectId, correct, answered}` (ints) |
 *
 * - **While `practice` is absent** (M05 still the F-01 stub) every read returns an empty list, and
 *   `onSessionCompleted` counts the session it is handed (merged by id).
 * - **Once `practice` exists**, a missing method or a result of an unrecognised shape throws
 *   `RepositoryError('CONTRACT')`: the seam fails loudly instead of silently reading nothing.
 * - M14 also filters defensively: the MYT local date of `completedAt` / `answeredAt`, the requested
 *   modes, and `status === 'completed'` when the field is present.
 *
 * Tests replace the reader with `setPracticeReadsForTests`.
 */

import type { Clock } from '@/lib/time'
import { RepositoryError } from '@/mock/repository'
import { users } from '@/modules/m01-authentication/mock'
import * as m02 from '@/modules/m02-users-schools/mock'
import * as m03 from '@/modules/m03-curriculum/mock'
import * as m05 from '@/modules/m05-practice/mock'
import * as m15 from '@/modules/m15-rewards-shop/mock'

import { localDate } from './rules'

export interface PracticeSessionFact {
  id: string
  mode: string
  correct: number
  total: number
  timeSpent: number
  completedAt: string
}

export interface PracticeAnswerFact {
  subjectId: number | null
  chapterId: number | null
  isCorrect: boolean
  answeredAt: string
}

export interface PracticeMasteryFact {
  subjectId: number
  correct: number
  answered: number
}

export interface PracticeReads {
  sessionsOn(userId: number, date: string): PracticeSessionFact[]
  practiceSessions(userId: number): PracticeSessionFact[]
  answersOn(userId: number, date: string): PracticeAnswerFact[]
  mastery(userId: number): PracticeMasteryFact[]
  /** Test seam only (optional): every completed session, all modes (S18). Default: M05 history. */
  allSessions?(userId: number): PracticeSessionFact[]
  /** Test seam only (optional): the totals of every answer (S18). Default: M05 answers. */
  allAnswers?(userId: number): { total: number; correct: number }
}

/** BR-M14-16 practice modes (the lifetime "kuiz" count). */
const PRACTICE_MODE_LIST = ['random', 'chapter', 'revision'] as const

type Loose = Record<string, unknown>
type Fn = (...args: unknown[]) => unknown

function contract(message: string): RepositoryError {
  return new RepositoryError('CONTRACT', `M14 ← M05 practice contract: ${message}`)
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v)
const isIntOrNull = (v: unknown): v is number | null => v === null || isInt(v)
const isDateText = (v: unknown): v is string =>
  typeof v === 'string' && !Number.isNaN(Date.parse(v))

/** The M05 `practice` repository when F-26 has built it, else null (read at call time). */
function practiceRepo(): Loose | null {
  const repo = Reflect.get(m05, 'practice') as unknown
  return typeof repo === 'object' && repo !== null ? (repo as Loose) : null
}

function method(repo: Loose, name: string): Fn {
  const fn = repo[name]
  if (typeof fn !== 'function') throw contract(`practice.${name} is missing`)
  return fn as Fn
}

function arrayOf(value: unknown, what: string): Loose[] {
  if (!Array.isArray(value)) throw contract(`${what} must return an array, got ${typeof value}`)
  for (const row of value) {
    if (typeof row !== 'object' || row === null) throw contract(`${what} returned a non-object row`)
  }
  return value as Loose[]
}

function toSession(r: Loose, what: string): PracticeSessionFact | null {
  const ok =
    (typeof r.id === 'string' || isInt(r.id)) &&
    typeof r.mode === 'string' &&
    isInt(r.correct) &&
    isInt(r.total) &&
    isInt(r.timeSpent) &&
    isDateText(r.completedAt) &&
    (r.status === undefined || typeof r.status === 'string')
  if (!ok) {
    throw contract(
      `${what} row ${JSON.stringify(r).slice(0, 200)} lacks id / mode / correct / total / timeSpent / completedAt`,
    )
  }
  if (r.status !== undefined && r.status !== 'completed') return null
  return {
    id: String(r.id),
    mode: r.mode as string,
    correct: r.correct as number,
    total: r.total as number,
    timeSpent: r.timeSpent as number,
    completedAt: r.completedAt as string,
  }
}

function toAnswer(r: Loose, what: string): PracticeAnswerFact {
  const ok =
    isIntOrNull(r.chapterId) &&
    isIntOrNull(r.subjectId) &&
    typeof r.isCorrect === 'boolean' &&
    isDateText(r.answeredAt)
  if (!ok) {
    throw contract(
      `${what} row ${JSON.stringify(r).slice(0, 200)} lacks chapterId / subjectId / isCorrect / answeredAt`,
    )
  }
  return {
    chapterId: r.chapterId as number | null,
    subjectId: r.subjectId as number | null,
    isCorrect: r.isCorrect as boolean,
    answeredAt: r.answeredAt as string,
  }
}

function history(userId: number, filter: { date?: string; modes?: readonly string[] }) {
  const repo = practiceRepo()
  if (!repo) return []
  const what = `practice.history(${String(userId)}, ${JSON.stringify(filter)})`
  return arrayOf(method(repo, 'history')(userId, { ...filter }), what)
    .map((r) => toSession(r, what))
    .filter((s): s is PracticeSessionFact => s !== null)
    .filter((s) => filter.date === undefined || localDate(s.completedAt) === filter.date)
    .filter((s) => filter.modes === undefined || filter.modes.includes(s.mode))
}

const M05_READS: PracticeReads = {
  sessionsOn: (userId, date) => history(userId, { date }),
  practiceSessions: (userId) => history(userId, { modes: [...PRACTICE_MODE_LIST] }),
  answersOn(userId, date) {
    const repo = practiceRepo()
    if (!repo) return []
    const what = `practice.answers(${String(userId)}, {date: '${date}'})`
    return arrayOf(method(repo, 'answers')(userId, { date }), what)
      .map((r) => toAnswer(r, what))
      .filter((a) => localDate(a.answeredAt) === date)
  },
  mastery(userId) {
    const repo = practiceRepo()
    if (!repo) return []
    const what = `practice.mastery(${String(userId)})`
    return arrayOf(method(repo, 'mastery')(userId), what).map((r) => {
      if (!isInt(r.subjectId) || !isInt(r.correct) || !isInt(r.answered)) {
        throw contract(
          `${what} row ${JSON.stringify(r).slice(0, 200)} lacks subjectId / correct / answered`,
        )
      }
      return { subjectId: r.subjectId, correct: r.correct, answered: r.answered }
    })
  },
}

let override: PracticeReads | null = null

/** Whether the real M05 `practice` repository is present (the contract test's skip condition). */
export function hasPracticeRepository(): boolean {
  return practiceRepo() !== null
}

/** The real M05 reads, bypassing any test override (the contract test). */
export function m05PracticeReads(): PracticeReads {
  return M05_READS
}

/** The M05 reads in effect (the test override when set). */
export function practiceReads(): PracticeReads {
  return override ?? M05_READS
}

/** Test seam: replaces the M05 reads (`null` restores them). */
export function setPracticeReadsForTests(reads: PracticeReads | null): void {
  override = reads
}

/**
 * Every completed session of the user, all modes (S18 "Sesi", M05 S8 `all`), through the M05 read
 * contract; empty while `practice` is absent.
 */
export function allSessions(userId: number): PracticeSessionFact[] {
  const reads = practiceReads()
  return reads.allSessions ? reads.allSessions(userId) : history(userId, {})
}

/**
 * Every answer of the user, with or without a session (S18 "Soalan" / "Ketepatan", the M05 S8
 * `all` definition: admin 119 answers, 46 correct), through the M05 read contract.
 */
export function allAnswers(userId: number): { total: number; correct: number } {
  const reads = practiceReads()
  if (reads.allAnswers) return reads.allAnswers(userId)
  const repo = practiceRepo()
  if (!repo) return { total: 0, correct: 0 }
  const rows = arrayOf(
    method(repo, 'answers')(userId, {}),
    `practice.answers(${String(userId)}, {})`,
  )
  let correct = 0
  for (const r of rows) if (r.isCorrect === true) correct++
  return { total: rows.length, correct }
}

/**
 * Test hook `gamificationSession` (§6.14): inserts one completed session without answers through
 * the M05 hook `mock.addSession` (`practice.addSession`) and returns its id. Falls back to a
 * synthetic id while M05 is absent, so the hook works before F-26 (M14-only tests).
 */
export function insertSession(
  userId: number,
  s: { mode: string; correct: number; total: number; timeSpentSec: number; at: string },
): string {
  const repo = practiceRepo()
  const add = repo?.addSession
  if (typeof add === 'function') {
    const row = (add as Fn).call(repo, userId, s) as { id?: unknown } | undefined
    if (row && (typeof row.id === 'string' || typeof row.id === 'number')) return String(row.id)
    throw contract('practice.addSession must return the stored session with an id')
  }
  hookSessionSeq += 1
  return `m14-hook-${String(hookSessionSeq)}`
}

let hookSessionSeq = 0

/** M03 subject names and order (S11 / S18 mastery), read at call time; ids when M03 is absent. */
export function subjectNames(): { name(id: number): string; order(id: number): number } {
  const repo = Reflect.get(m03, 'curriculum') as unknown as Loose | undefined
  const subject = repo?.subject
  const ids = repo?.subjectIds
  const order = new Map<number, number>()
  const names = new Map<number, string>()
  try {
    if (typeof ids === 'function') {
      ;((ids as Fn).call(repo) as number[]).forEach((id, i) => order.set(id, i))
    }
  } catch {
    /* M03 is not booted (an M14-only test): ids order, names by id */
  }
  return {
    name(id) {
      const cached = names.get(id)
      if (cached !== undefined) return cached
      let name = `Subjek ${String(id)}`
      try {
        const s =
          typeof subject === 'function'
            ? ((subject as Fn).call(repo, id) as { name?: unknown } | undefined)
            : undefined
        if (typeof s?.name === 'string') name = s.name
      } catch {
        /* M03 is not booted */
      }
      names.set(id, name)
      return name
    },
    order: (id) => order.get(id) ?? Number.MAX_SAFE_INTEGER,
  }
}

/** M15 `mysteryBox.openingsCount(userId)` (Q-M15-OPENINGS-COUNT), 0 until M15 exists. */
export function mysteryOpenings(userId: number): number {
  return m15.mysteryBox.openingsCount(userId)
}

/** The M01 user row (role, complimentary flag, school), or undefined. */
export function userOf(userId: number) {
  return users.get(userId)
}

/**
 * M02 `coinsEnabled` (DATA-M02-09, BR-18), read at call time: M02's
 * `complimentary.coinsEnabled(userId)` when M02 exposes it.
 *
 * XR (M14 → M02, raised by the Delivery Lead): M02 does not expose the per-student toggle (#20)
 * through a repository yet. Until it does, the fallback is: complimentary students are coins OFF
 * (all 90 seeded with `coinsEnabled = false`, M02 §6.15 B), everyone else ON.
 */
export function coinsEnabled(userId: number): boolean {
  const repo = Reflect.get(m02, 'complimentary') as Loose | undefined
  const fn = repo?.coinsEnabled
  if (typeof fn === 'function') {
    const value = (fn as Fn)(userId)
    if (typeof value === 'boolean') return value
  }
  return userOf(userId)?.isComplimentary !== true
}

/** Role `teacher` or `admin` (BR-M14-24, BR-M14-28). */
export function hasTeacherRole(userId: number): boolean {
  const role = userOf(userId)?.role
  return role === 'teacher' || role === 'admin'
}

let boundClock: Clock | null = null

/** Bound by the M14 seed (every boot and reset). */
export function bindM14Clock(clock: Clock): void {
  boundClock = clock
}

/** Now (epoch ms) of the runtime being served. */
export function m14Now(): number {
  if (!boundClock) throw new Error('M14: not booted (no clock bound)')
  return boundClock.now()
}
