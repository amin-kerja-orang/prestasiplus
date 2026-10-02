/**
 * #1 S1 teacher report (SRS M11 v1.10 §6.4 TeacherReport; BR-M11-01…07, FR-M11-10…25).
 *
 * Population (BR-M11-01, DV-M11-01): the distinct pupils actively enrolled in the viewer's own active
 * classes (M10 `classrooms`), or in the selected own class; the admin has no class and so an empty
 * population. Activities (BR-M11-04): completed M05 sessions by `completedAt` (Q-SESS-USER, mode → type),
 * structured attempts by `submittedAt` (Q-M11-STRUCT), and the M16 battle / game counters through the
 * port (`./ports.ts`, 0 until M16 registers). Scores (BR-M11-05) are Σ correct ÷ Σ questions.
 */

import { users, type UserRow } from '@/modules/m01-authentication/mock'
import { classrooms, type ClassroomRow } from '@/modules/m10-teacher-class/mock'
import { practice, type SessionRow } from '@/modules/m05-practice/mock'

import type {
  ReportClassOption,
  StudentLite,
  TeacherReport,
  TeacherReportActivityTypes,
  TeacherReportScoreTypes,
} from '../../api/types'
import { m16Reads } from './ports'
import { byName, DAY_MS, ddmm, mytDayStart, percent, rangeOf } from './rules'

export type ReportType = 'kuiz' | 'latihTubi' | 'trackingA'

/** BR-M11-04 / §6.6 mode → S1 type (M05 `pksk` per v1.12 BR-35; M10 modes per v1.8). */
const TYPE_OF_MODE: Readonly<Record<string, ReportType>> = {
  random: 'kuiz',
  chapter: 'kuiz',
  revision: 'kuiz',
  past_year: 'kuiz',
  mission: 'kuiz',
  remedial: 'kuiz',
  question_set: 'kuiz',
  pksk: 'kuiz',
  latih_tubi: 'latihTubi',
  ramalan: 'trackingA',
}

export interface Viewer {
  id: number
  role: string
}

/** The viewer's own active classes (BR-M11-01; the admin has none). */
export function ownClasses(viewer: Viewer): ClassroomRow[] {
  if (viewer.role !== 'teacher') return []
  return classrooms.forTeacher(viewer.id).filter((c) => c.kind === 'classroom' && c.isActive)
}

export const classOptions = (own: readonly ClassroomRow[]): ReportClassOption[] =>
  own.map((c) => ({ id: c.classId, name: c.name }))

/**
 * The pupils of an S1 / S6 scope. A `classroomId` that is not an own class is ignored on S1 (the
 * "Semua Kelas" population) and gives an empty scope on S6 (FR-M11-79): `ignoreUnknown` selects which.
 */
export function populationOf(
  viewer: Viewer,
  own: readonly ClassroomRow[],
  classroomId: number | undefined,
  ignoreUnknown: boolean,
): { classroomId: number | null; ids: number[] } {
  if (own.length === 0) return { classroomId: null, ids: [] }
  if (classroomId !== undefined) {
    const mine = own.find((c) => c.classId === classroomId)
    if (mine)
      return { classroomId: mine.classId, ids: classrooms.memberIds('classroom', mine.classId) }
    if (!ignoreUnknown) return { classroomId: null, ids: [] }
  }
  return { classroomId: null, ids: classrooms.teacherStudentIds(viewer.id) }
}

const lite = (u: UserRow): StudentLite => ({
  id: u.id,
  name: u.name,
  email: u.email,
  avatarUrl: u.avatarUrl,
  neverLoggedIn: u.lastLoginAt === null,
})

const emptyTypes = (): TeacherReportActivityTypes => ({
  kuiz: 0,
  struktur: 0,
  latihTubi: 0,
  trackingA: 0,
  battle: 0,
  permainan: 0,
})

interface UserFacts {
  user: UserRow
  sessions: ReturnType<typeof practice.history>
  structured: number[]
}

/** #1: the S1 figures for `viewer`. `now` is the clock (epoch ms). */
export function teacherReport(
  viewer: Viewer,
  query: { range?: number; classroomId?: number },
  now: number,
): TeacherReport {
  const range = rangeOf(query.range)
  const own = ownClasses(viewer)
  const pop = populationOf(viewer, own, query.classroomId, true)
  const people = users
    .getMany(pop.ids)
    .filter((u) => u.role === 'student')
    .sort(byName)
  const ids = people.map((u) => u.id)
  const from = mytDayStart(now) - (range - 1) * DAY_MS

  const facts: UserFacts[] = people.map((user) => ({
    user,
    sessions: practice.history(user.id),
    structured: practice
      .structuredAttempts(user.id)
      .map((s) => Date.parse(s.submittedAt))
      .filter((t) => t >= from && t <= now),
  }))

  const byType = emptyTypes()
  const sums: Record<ReportType, { c: number; n: number }> = {
    kuiz: { c: 0, n: 0 },
    latihTubi: { c: 0, n: 0 },
    trackingA: { c: 0, n: 0 },
  }
  const perDay = new Map<number, number>()
  const perUser = new Map<number, number>()
  const bump = (day: number, userId: number) => {
    perDay.set(day, (perDay.get(day) ?? 0) + 1)
    perUser.set(userId, (perUser.get(userId) ?? 0) + 1)
  }
  const inRange = (s: Pick<SessionRow, 'completedAtMs'>) =>
    s.completedAtMs >= from && s.completedAtMs <= now
  for (const f of facts) {
    for (const s of f.sessions) {
      if (!inRange(s)) continue
      const type = TYPE_OF_MODE[s.mode] ?? 'kuiz'
      byType[type]++
      sums[type].c += s.correctCount
      sums[type].n += s.questionCount
      bump(mytDayStart(s.completedAtMs), f.user.id)
    }
    for (const t of f.structured) {
      byType.struktur++
      bump(mytDayStart(t), f.user.id)
    }
  }

  // M16 (port): battles and games of the population, in total and per day / per user.
  // One per-user call per window (the M16 port contract), summed here.
  const window = { from, to: now + 1 }
  const battleMap = m16Reads.battles.countFor(ids, window)
  const gameMap = m16Reads.gameResults.countFor(ids, window)
  const battles = { count: 0, correct: 0, answered: 0 }
  for (const id of ids) {
    const b = battleMap.get(id)
    const g = gameMap.get(id)
    if (b) {
      battles.count += b.count
      battles.correct += b.correct
      battles.answered += b.answered
    }
    const n = (b?.count ?? 0) + (g?.count ?? 0)
    if (n > 0) perUser.set(id, (perUser.get(id) ?? 0) + n)
    byType.permainan += g?.count ?? 0
  }
  byType.battle = battles.count
  if (ids.length > 0 && battles.count + byType.permainan > 0) {
    for (let d = 0; d < range; d++) {
      const day = mytDayStart(now) - d * DAY_MS
      const dayWindow = { from: Math.max(day, from), to: Math.min(day + DAY_MS, now + 1) }
      let n = 0
      for (const v of m16Reads.battles.countFor(ids, dayWindow).values()) n += v.count
      for (const v of m16Reads.gameResults.countFor(ids, dayWindow).values()) n += v.count
      if (n > 0) perDay.set(day, (perDay.get(day) ?? 0) + n)
    }
  }

  const rate = (c: number, n: number): number | null => (n > 0 ? Math.round(percent(c, n)) : null)
  const scoreByType: TeacherReportScoreTypes = {
    kuiz: rate(sums.kuiz.c, sums.kuiz.n),
    struktur: null,
    latihTubi: rate(sums.latihTubi.c, sums.latihTubi.n),
    trackingA: rate(sums.trackingA.c, sums.trackingA.n),
    battle: rate(battles.correct, battles.answered),
  }
  const scoreC = sums.kuiz.c + sums.latihTubi.c + sums.trackingA.c + battles.correct
  const scoreN = sums.kuiz.n + sums.latihTubi.n + sums.trackingA.n + battles.answered

  const trend: TeacherReport['trend'] = []
  for (let d = range - 1; d >= 0; d--) {
    const day = mytDayStart(now) - d * DAY_MS
    trend.push({ date: ddmm(day), count: perDay.get(day) ?? 0 })
  }

  const practised = (f: UserFacts) => f.sessions.length > 0
  const neverPractised = facts.filter((f) => !practised(f)).map((f) => lite(f.user))
  return {
    range,
    classroomId: pop.classroomId,
    options: { classes: classOptions(own) },
    population: {
      total: people.length,
      loggedIn: people.filter((u) => u.lastLoginAt !== null).length,
      practised: facts.filter(practised).length,
    },
    activity: {
      total: Object.values(byType).reduce((a, b) => a + b, 0),
      byType,
    },
    score: { overall: rate(scoreC, scoreN), byType: scoreByType },
    trend,
    notLoggedIn: people.filter((u) => u.lastLoginAt === null).map(lite),
    notPractised: neverPractised.slice(0, 10),
    notPractisedAll: neverPractised,
    mostActive: people
      .map((u) => ({ ...lite(u), activities: perUser.get(u.id) ?? 0 }))
      .filter((u) => u.activities > 0)
      .sort((a, b) => b.activities - a.activities || byName(a, b))
      .slice(0, 10),
  }
}
