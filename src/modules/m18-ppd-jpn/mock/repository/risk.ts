/**
 * The M18 risk read model (SRS M18 v1.8 BR-M18-13/14/15/22, §6.1a, Q-M18-RISK; Amaran Awal).
 *
 * score = 0.4 x A + 0.3 x E + 0.3 x M, one decimal, evaluated at the project clock, never stored
 * (FR-M18-75, D11):
 * - A = 100 - mean practice-session accuracy; 100 without a session but with a `lastActiveAt` or a
 *   mastery record; 50 without session, `lastActiveAt` and mastery (v1.7 "never active");
 * - E = min(100, whole days since `lastActiveAt` x 100 / 30), 100 when null;
 * - M = (10 - mean mastery level) x 10, 100 without mastery records.
 * The whole-day count reproduces the class-1156 anchor (44.7 at the clock, 45.7 one day later).
 *
 * Sources, all through the owners' public entries (D12): M01 users (`lastActiveAt`, name, grade,
 * school), M05 `practice.sessionTotals` (one scan, memoised per log stamp) and `practice.mastery`,
 * M10 `classrooms.enrolmentsOf`, M02 `schools`. Per-school results are memoised per stamp (session
 * count, answer count, pupil count, minute of the clock) so a warm `forSchool` is a map lookup.
 *
 * INFERRED: the mastery ladder thresholds are the M05 BR-20 scale (M05 keeps them private; M14 holds
 * a read-only copy), practice-mode sessions only (BR-M18-23), pupils include inactive users
 * (BR-M18-04), fixture schools 900001-900099 are excluded from district / state scopes (BR-M18-02).
 */

import { clock as appClock } from '@/lib/time'
import { users, type UserRow } from '@/modules/m01-authentication/mock'
import { schools } from '@/modules/m02-users-schools/mock'
import { practice, practiceAnswers } from '@/modules/m05-practice/mock'
import { classrooms } from '@/modules/m10-teacher-class/mock'

import type {
  PupilClassRef,
  PupilRiskRow,
  RiskOptions,
  RiskScope,
  RiskStatus,
  RiskTally,
  Tingkatan,
} from './types'

const DAY = 86_400_000
const FIXTURE_MIN = 900_001
const FIXTURE_MAX = 900_099

/** Correct answers needed for L0 ... L10 (M05 BR-20; L4+ INFERRED there too). */
const MASTERY_THRESHOLDS = [0, 10, 25, 50, 100, 200, 350, 550, 800, 1100, 1500] as const

export function masteryLevelOf(correct: number): number {
  let level = 0
  for (const [i, t] of MASTERY_THRESHOLDS.entries()) if (correct >= t) level = i
  return level
}

const round1 = (n: number): number => Math.round(n * 10) / 10

/** BR-M18-14: Hijau < 40, Kuning 40-59.9, Merah >= 60. */
export function statusOf(score: number): RiskStatus {
  return score < 40 ? 'on_track' : score < 60 ? 'watch' : 'high'
}

export interface RiskInputs {
  /** Mean session accuracy in percent, or null without a completed practice session. */
  accuracy: number | null
  sessions: number
  lastActiveAt: string | null
  /** Mean mastery level, or null without records. */
  masteryMean: number | null
  masteryRecords: number
}

export interface RiskComputed {
  a: number
  e: number
  m: number
  score: number
  status: RiskStatus
  daysSinceActive: number | null
  neverActive: boolean
}

/** BR-M18-13 for one pupil's inputs at `now` (pure; the unit-test surface). */
export function computeRisk(input: RiskInputs, now: number): RiskComputed {
  const activeMs = input.lastActiveAt === null ? null : Date.parse(input.lastActiveAt)
  const hasActivity = activeMs !== null && !Number.isNaN(activeMs)
  const hasMastery = input.masteryRecords > 0 && input.masteryMean !== null
  const hasSession = input.sessions > 0 && input.accuracy !== null
  const neverActive = !hasSession && !hasActivity && !hasMastery

  const a = hasSession ? 100 - (input.accuracy as number) : hasActivity || hasMastery ? 100 : 50
  const daysSinceActive = hasActivity ? Math.max(0, Math.floor((now - activeMs) / DAY)) : null
  const e = daysSinceActive === null ? 100 : Math.min(100, (daysSinceActive * 100) / 30)
  const m = hasMastery ? (10 - (input.masteryMean as number)) * 10 : 100
  const score = round1(0.4 * a + 0.3 * e + 0.3 * m)
  return { a, e, m, score, status: statusOf(score), daysSinceActive, neverActive }
}

// ---------------------------------------------------------------------------------------------
// Memos
// ---------------------------------------------------------------------------------------------

interface SessionFigure {
  accSum: number
  accN: number
  sessions: number
}

let sessionStamp = ''
let sessionMap: Map<number, SessionFigure> | null = null
const schoolMemo = new Map<string, PupilRiskRow[]>()

const logStamp = (): string =>
  `${String(practice.count('Q-SESS-ALL'))}:${String(practiceAnswers.count('Q-ANS-ALL'))}`

function sessionFigures(): Map<number, SessionFigure> {
  const s = logStamp()
  if (sessionMap === null || s !== sessionStamp) {
    sessionStamp = s
    sessionMap = new Map()
    schoolMemo.clear()
    for (const [id, t] of practice.sessionTotals()) {
      sessionMap.set(id, {
        accSum: t.practice.accSum,
        accN: t.practice.accN,
        sessions: t.practice.sessions,
      })
    }
  }
  return sessionMap
}

/** Forgets every memo (tests that edit owner data call this; a changed log invalidates itself). */
export function resetRiskCache(): void {
  sessionMap = null
  sessionStamp = ''
  schoolMemo.clear()
}

const levelNumber = (slug: string): Tingkatan | null =>
  slug === 'tingkatan-4' ? 4 : slug === 'tingkatan-5' ? 5 : null

function classesOf(userId: number): PupilClassRef[] {
  const out: PupilClassRef[] = []
  for (const e of classrooms.enrolmentsOf(userId)) {
    if (e.status !== 'active') continue
    const c = classrooms.get(e.classroomKind, e.classroomId)
    if (c) out.push({ kind: c.kind, id: c.classId, name: c.name, level: c.educationLevel })
  }
  return out.sort((a, b) => a.id - b.id || a.kind.localeCompare(b.kind))
}

/** A mastery record as far as M18 needs it (BR-M18-10). */
interface MasteryCounter {
  correct: number
}

/**
 * Mastery records of a set of pupils (Q-M18-MASTERY: M05 SubjectMastery).
 *
 * XR-M18-M05-01: M05 exposes no bulk read of the STORED counters, and `practice.mastery(userId)` costs a
 * log scan (~100 ms) for users without stored rows. Until M05 offers `practice.storedMastery(userIds)`
 * (used automatically when present), a set of at most `PROBE_MAX` pupils (a class, a small school) reads
 * `practice.mastery` per pupil (stored rows, else the log aggregates), and a larger set takes the log
 * aggregates from the bulk `practice.subjectTotals` (what M05 returns for users without stored rows).
 * Pupils holding stored rows in a large school are therefore read from the log (owner gap).
 */
const PROBE_MAX = 60

function masteryOf(userIds: readonly number[]): Map<number, MasteryCounter[]> {
  const out = new Map<number, MasteryCounter[]>()
  const stored = Reflect.get(practice, 'storedMastery') as
    ((ids: readonly number[]) => Map<number, MasteryCounter[]>) | undefined
  if (typeof stored === 'function') {
    const got = stored.call(practice, userIds)
    for (const id of userIds) out.set(id, got.get(id) ?? [])
    return out
  }
  if (userIds.length <= PROBE_MAX) {
    for (const id of userIds) out.set(id, practice.mastery(id))
    return out
  }
  const totals = practice.subjectTotals(userIds)
  for (const id of userIds) out.set(id, totals.get(id) ?? [])
  return out
}

function riskRowOf(
  u: UserRow,
  now: number,
  figures: Map<number, SessionFigure>,
  records: readonly MasteryCounter[],
): PupilRiskRow {
  const f = figures.get(u.id)
  const accuracy = f && f.accN > 0 ? (f.accSum / f.accN) * 100 : null
  const levels = records.map((r) => masteryLevelOf(r.correct))
  const masteryMean = levels.length === 0 ? null : levels.reduce((x, y) => x + y, 0) / levels.length
  const c = computeRisk(
    {
      accuracy,
      sessions: f?.sessions ?? 0,
      lastActiveAt: u.lastActiveAt,
      masteryMean,
      masteryRecords: levels.length,
    },
    now,
  )
  const classes = classesOf(u.id)
  const tset = new Set<Tingkatan>()
  for (const k of classes) {
    const t = levelNumber(k.level)
    if (t !== null) tset.add(t)
  }
  return {
    userId: u.id,
    name: u.name,
    schoolId: u.schoolId as number,
    grade: u.grade,
    isActive: u.isActive,
    score: c.score,
    status: c.status,
    accuracy,
    sessions: f?.sessions ?? 0,
    lastActiveAt: u.lastActiveAt,
    daysSinceActive: c.daysSinceActive,
    masteryMean,
    masteryRecords: levels.length,
    a: c.a,
    e: c.e,
    m: c.m,
    neverActive: c.neverActive,
    classes,
    classTingkatan: [...tset].sort(),
  }
}

/** BR-M18-22 order: score descending, then class, then name, then id. */
function byRisk(a: PupilRiskRow, b: PupilRiskRow): number {
  return (
    b.score - a.score ||
    (a.classes[0]?.name ?? '￿').localeCompare(b.classes[0]?.name ?? '￿') ||
    a.name.localeCompare(b.name) ||
    a.userId - b.userId
  )
}

const nowOf = (options?: RiskOptions): number => options?.now ?? appClock.now()

/** Every pupil of a school with the risk inputs (all levels), in BR-M18-22 order. */
function schoolPupils(schoolId: number, now: number): PupilRiskRow[] {
  const figures = sessionFigures()
  const count = users.countWhere({ role: 'student', schoolId })
  const key = `${String(schoolId)}:${String(count)}:${String(Math.floor(now / 60_000))}`
  const hit = schoolMemo.get(key)
  if (hit) return hit
  for (const k of [...schoolMemo.keys()])
    if (k.startsWith(`${String(schoolId)}:`)) schoolMemo.delete(k)
  const pupils = users.adminList({ role: 'student', schoolId, page: 1, pageSize: 100_000 }).rows
  const mastery = masteryOf(pupils.map((u) => u.id))
  const rows = pupils.map((u) => riskRowOf(u, now, figures, mastery.get(u.id) ?? [])).sort(byRisk)
  schoolMemo.set(key, rows)
  return rows
}

function tally(rows: readonly PupilRiskRow[]): RiskTally {
  const out: RiskTally = { total: rows.length, onTrack: 0, watch: 0, high: 0 }
  for (const r of rows) {
    if (r.status === 'on_track') out.onTrack++
    else if (r.status === 'watch') out.watch++
    else out.high++
  }
  return out
}

const filterLevel = (rows: PupilRiskRow[], t: Tingkatan | undefined): PupilRiskRow[] =>
  t === undefined ? rows : rows.filter((r) => r.classTingkatan.includes(t))

/** Schools of a scope that hold pupils (fixtures excluded, BR-M18-02). */
export function schoolIdsOfScope(scope: RiskScope): number[] {
  if (scope.kind === 'school') return [scope.schoolId]
  const out: number[] = []
  for (const id of users.schoolsWithUsers({ excludeFixtures: true })) {
    if (id >= FIXTURE_MIN && id <= FIXTURE_MAX) continue
    const s = schools.get(id)
    if (!s || s.state !== scope.state) continue
    if (scope.kind === 'district' && s.district !== scope.district) continue
    out.push(id)
  }
  return out
}

const sharedForSchool = (schoolId: number, options?: RiskOptions): PupilRiskRow[] =>
  filterLevel(schoolPupils(schoolId, nowOf(options)), options?.tingkatan)

function pupilsForScope(scope: RiskScope, options?: RiskOptions): PupilRiskRow[] {
  if (scope.kind === 'school') return [...sharedForSchool(scope.schoolId, options)]
  const rows: PupilRiskRow[] = []
  for (const id of schoolIdsOfScope(scope)) rows.push(...sharedForSchool(id, options))
  return rows.sort(byRisk)
}

function pupilsForClass(classId: number, options?: RiskOptions): PupilRiskRow[] {
  const cls = classrooms.get('classroom', classId)
  if (!cls) return []
  const now = nowOf(options)
  const figures = sessionFigures()
  const members = classrooms
    .memberIds(cls.kind, cls.classId)
    .map((id) => users.get(id))
    .filter((u): u is UserRow => u !== undefined && u.role === 'student')
  const mastery = masteryOf(members.map((u) => u.id))
  return members
    .map((u) => ({
      ...riskRowOf(u, now, figures, mastery.get(u.id) ?? []),
      schoolId: u.schoolId ?? cls.schoolId ?? 0,
    }))
    .sort(byRisk)
}

/** The public risk read model (plain functions: safe to destructure). */
export const risk = {
  /** BR-M18-13 for one set of inputs (see `computeRisk`). */
  compute: computeRisk,

  /** The pupils of a school, score descending (BR-M18-22); `tingkatan` keeps class members of that level. */
  pupilsForSchool: (schoolId: number, options?: RiskOptions): PupilRiskRow[] => [
    ...sharedForSchool(schoolId, options),
  ],

  /**
   * Q-M18-RISK(schoolId): `{total, onTrack, watch, high}` (Selamat / Berhati / Berisiko on M27 S0).
   * Identical numbers on M27 S0 and S4 / M18 S22: both call this one function.
   */
  forSchool: (schoolId: number, options?: RiskOptions): RiskTally =>
    tally(sharedForSchool(schoolId, options)),

  /** The pupils of a classroom (M10 class id), score descending. */
  pupilsForClass,

  forClass: (classId: number, options?: RiskOptions): RiskTally =>
    tally(pupilsForClass(classId, options)),

  /** The pupils of a school / district / state scope, score descending. */
  pupilsForScope,

  forScope: (scope: RiskScope, options?: RiskOptions): RiskTally =>
    tally(pupilsForScope(scope, options)),

  /** Drops the memos (after tests edit owner data). */
  resetCache: resetRiskCache,
}

export type RiskRepository = typeof risk
