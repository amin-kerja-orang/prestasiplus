/**
 * The M11 named queries (SRS M11 v1.10 §6.5.1), defined only on top of the owners' contracts (D12):
 *
 * | Query | Built on |
 * |---|---|
 * | Q-ANS-SEG(period[, schoolId][, week]) | M05 `practiceAnswers` (facet counts; M05 owns the definition) |
 * | Q-ANS-USER(userId) totals | M05 `practiceAnswers.groupCount('userId')` (one pass, never one query per user) |
 * | Q-M11-T45(state?[, schoolId]) | M01 `users` named query of the same name (grade 10 / 11, non-fixture school) |
 * | Q-M11-TEACHERS(state?[, schoolId]) | M01 `users` named queries Q-M11-TEACHERS / Q-M11-TEACHERS-LOGGED |
 * | Q-M11-ACTIVE(period[, schoolId]) | distinct users of Q-ANS-SEG (`groupCount('userId')`) |
 * | Q-M11-STRUCT(userIds, range) | M05 `practice.structuredAttempts` (report.ts) |
 *
 * M11 stores no count (D11). The distinct-user and per-user figures cost one pass over the school's
 * slice of the log (about 60 ms for the largest school), so they are memoised until the answer log
 * changes (its size is the stamp) and, for the period windows, for one minute of the clock.
 */

import { users, type UserRow } from '@/modules/m01-authentication/mock'
import { isFixtureSchoolId, schools } from '@/modules/m02-users-schools/mock'
import { practice, practiceAnswers } from '@/modules/m05-practice/mock'

import type { MonitoringPeriod } from '../../api/types'
import { periodFromMs } from './rules'

export interface SchoolFact {
  id: number
  name: string
  /** null when the school has no code (shown "-"). */
  code: string | null
  state: string
}

export function schoolFact(id: number): SchoolFact | null {
  const s = schools.get(id)
  if (!s) return null
  return { id: s.id, name: s.name, code: s.code === '' ? null : s.code, state: s.state }
}

// --- memo ---------------------------------------------------------------------------------------------

const memo = new Map<string, unknown>()
let memoStamp = ''

/** The answer log's size: runtime answers change it, so a changed log clears the memo. */
const logStamp = (): string => String(practiceAnswers.count('Q-ANS-ALL'))

function cached<T>(key: string, compute: () => T): T {
  const stamp = logStamp()
  if (stamp !== memoStamp) {
    memo.clear()
    memoStamp = stamp
  }
  if (memo.has(key)) return memo.get(key) as T
  const value = compute()
  memo.set(key, value)
  return value
}

/** Forgets every memoised query (every seed / `mock.reset()`). */
export function resetSegmentCaches(): void {
  memo.clear()
  memoStamp = ''
}

/** Window key of a period: all time never changes; the windows follow the clock by the minute. */
const periodKey = (period: MonitoringPeriod, now: number): string =>
  period === '' ? '' : `${period}@${String(Math.floor(now / 60_000))}`

const numeric = (m: Map<unknown, number>): Map<number, number> => {
  const out = new Map<number, number>()
  for (const [k, v] of m) if (typeof k === 'number') out.set(k, v)
  return out
}

// --- registers (M01 users) -----------------------------------------------------------------------------

/** The T4/T5 pupils of one school (id order; the M01 rows). */
export const studentsOf = (schoolId: number): UserRow[] =>
  users.query('Q-M11-T45', { sort: 'id' }, schoolId).rows

/** The teachers of one school (id order). */
export const teachersOf = (schoolId: number): UserRow[] =>
  users.query('Q-M11-TEACHERS', { sort: 'id' }, schoolId).rows

/**
 * `extra` is a reserved fixture school (900001–900099) that the viewer is scoped to (a school admin of
 * SMK DEMO, the `/admin-sekolah/monitoring` alias, INFERRED): BR-M11-34 keeps the fixture schools out of
 * the platform rollups, but a view scoped to one's own school shows it; its figures are read from the
 * pupils' own answers (the M05 monitoring segment excludes the fixture schools).
 */
function withExtra(
  m: Map<number, number>,
  extra: number | undefined,
  count: () => number,
): Map<number, number> {
  if (extra !== undefined && !m.has(extra)) {
    const n = count()
    if (n > 0) m.set(extra, n)
  }
  return m
}

/** Q-M11-T45: registered T4/T5 pupils per non-fixture school. */
export const registeredBySchool = (extra?: number): Map<number, number> =>
  withExtra(numeric(users.groupCount('Q-M11-T45', 'schoolId')), extra, () =>
    extra === undefined ? 0 : studentsOf(extra).length,
  )

/** Q-M11-TEACHERS: registered teachers per non-fixture school. */
export const teachersBySchool = (extra?: number): Map<number, number> =>
  withExtra(numeric(users.groupCount('Q-M11-TEACHERS', 'schoolId')), extra, () =>
    extra === undefined ? 0 : teachersOf(extra).length,
  )

/** Q-M11-TEACHERS-LOGGED: teachers with `lastLoginAt` per non-fixture school. */
export const teachersLoggedBySchool = (extra?: number): Map<number, number> =>
  withExtra(numeric(users.groupCount('Q-M11-TEACHERS-LOGGED', 'schoolId')), extra, () =>
    extra === undefined ? 0 : teachersOf(extra).filter((t) => t.lastLoginAt !== null).length,
  )

/** "Jumlah Sekolah" (BR-M11-08): schools with ≥ 1 registered user of any role, fixtures excluded. */
export function schoolsWithUsers(extra?: number): number[] {
  const ids = users.schoolsWithUsers({ excludeFixtures: true })
  if (extra !== undefined && !ids.includes(extra) && users.countWhere({ schoolId: extra }) > 0) {
    ids.push(extra)
  }
  return ids
}

// --- answers (M05 Q-ANS-SEG) -----------------------------------------------------------------------------

/** A fixture school's answering pupils in the period (read from their own answers). */
function fixtureAnswers(
  schoolId: number,
  period: MonitoringPeriod,
  now: number,
): Map<number, number> {
  const from = periodFromMs(period, now)
  const out = new Map<number, number>()
  for (const p of studentsOf(schoolId)) {
    const n = practice.answers(p.id).filter((a) => from === null || a.answeredAtMs >= from).length
    if (n > 0) out.set(p.id, n)
  }
  return out
}

/** Q-M11-ACTIVE: the answering pupils of a school in the period, with their answer counts. */
export function engagedUsers(
  period: MonitoringPeriod,
  schoolId: number,
  now: number,
): Map<number, number> {
  if (isFixtureSchoolId(schoolId)) return fixtureAnswers(schoolId, period, now)
  return cached(`active:${periodKey(period, now)}:${String(schoolId)}`, () =>
    numeric(practiceAnswers.groupCount('Q-ANS-SEG', 'userId', period, schoolId)),
  )
}

/** Q-ANS-SEG(period) per school. */
export function answersBySchool(
  period: MonitoringPeriod,
  now: number,
  extra?: number,
): Map<number, number> {
  const base = cached(`ans:${periodKey(period, now)}`, () =>
    numeric(practiceAnswers.groupCount('Q-ANS-SEG', 'schoolId', period)),
  )
  if (extra === undefined || base.has(extra)) return base
  const out = new Map(base)
  const total = [...engagedUsers(period, extra, now).values()].reduce((a, b) => a + b, 0)
  if (total > 0) out.set(extra, total)
  return out
}

/** Q-ANS-SEG('', schoolId, week) per school: the weekly cells (BR-M11-15). */
export function answersInWeek(week: number): Map<number, number> {
  return cached(`week:${String(week)}`, () =>
    numeric(practiceAnswers.groupCount('Q-ANS-SEG', 'schoolId', '', undefined, week)),
  )
}

/** Q-M11-ACTIVE per school (distinct pupils with ≥ 1 answer in the period). */
export function engagedBySchool(
  period: MonitoringPeriod,
  now: number,
  extra?: number,
): Map<number, number> {
  const out = new Map<number, number>()
  for (const [schoolId, answers] of answersBySchool(period, now, extra)) {
    if (answers > 0) out.set(schoolId, engagedUsers(period, schoolId, now).size)
  }
  return out
}

// --- per user (M05 Q-ANS-USER / Q-ANS-USER-CORRECT, one pass) ---------------------------------------------

/** Q-ANS-USER totals: answers per user over the whole log (every school, fixtures included). */
export const answerCountsAll = (): Map<number, number> =>
  cached('answers-all', () => numeric(practiceAnswers.groupCount('Q-ANS-ALL', 'userId')))

/** Correct answers per user over the whole log (Q-ANS-CORRECT grouped by user). */
export const correctByUser = (): Map<number, number> =>
  cached('correct', () => numeric(practiceAnswers.groupCount('Q-ANS-CORRECT', 'userId')))

/** Users holding answers without a session (Q-ANS-NOSESSION): their last activity is read exactly. */
const sessionlessUsers = (): Set<number> =>
  cached(
    'nosession',
    () => new Set(numeric(practiceAnswers.groupCount('Q-ANS-NOSESSION', 'userId')).keys()),
  )

/**
 * The time of each user's latest answer (epoch ms). A session's answers end at its `completedAt`
 * (M05 §6.14.1, anchors included), so one scan of the sessions (`practice.sessionTotals`) gives it;
 * a user with sessionless answers (8880's pupils 3201–3215, runtime answers) is read from the answers.
 */
export function lastActivityMs(userIds: readonly number[]): Map<number, number> {
  const out = new Map<number, number>()
  if (userIds.length === 0) return out
  const sessionless = sessionlessUsers()
  const exact = userIds.filter((id) => sessionless.has(id))
  const rest = userIds.filter((id) => !sessionless.has(id))
  for (const [id, t] of practice.sessionTotals(rest)) {
    if (t.all.lastAtMs > 0) out.set(id, t.all.lastAtMs)
  }
  for (const id of exact) {
    let last = out.get(id) ?? 0
    for (const a of practice.answers(id)) last = Math.max(last, a.answeredAtMs)
    for (const s of practice.history(id)) last = Math.max(last, s.completedAtMs)
    if (last > 0) out.set(id, last)
  }
  return out
}
