/**
 * The monitoring read models (SRS M11 v1.10 §7 #3, #4, #6, #7; BR-M11-08…18, 24, 32, 33, 34): the S2
 * overview, the S3 school detail, the S5 teacher detail and the export rows. Everything is computed per
 * request from the owners' datasets through `./segment.ts` (D11); the only stored input is the flags.
 *
 * Two engagement definitions are replicated as live (BR-M11-09): S2 / S5 count a pupil with ≥ 1 answer
 * (flagged accounts included); S3 excludes the `excluded` accounts. Every S3 card equals its own rows (D9: no observed snapshot value that contradicts the table on the same screen is kept).
 */

import { toIsoMyt } from '@/lib/time'
import { users } from '@/modules/m01-authentication/mock'
import { isFixtureSchoolId, schoolSubscriptions } from '@/modules/m02-users-schools/mock'

import type {
  MonitoringExport,
  MonitoringOverview,
  MonitoringPeriod,
  SchoolDetail,
  SchoolEngagementRow,
  Signal,
  TeacherDetail,
  TeacherEngagementRow,
  WeeklyCellClass,
  WeeklyRow,
} from '../../api/types'
import type { FlagReader } from './flags'
import {
  byName,
  levelLabelOf,
  percent,
  periodOf,
  round1,
  statusOf,
  tahapOf,
  weeksUntil,
} from './rules'
import {
  answerCountsAll,
  answersBySchool,
  answersInWeek,
  correctByUser,
  engagedBySchool,
  lastActivityMs,
  registeredBySchool,
  schoolFact,
  schoolsWithUsers,
  studentsOf,
  teachersBySchool,
  teachersLoggedBySchool,
  teachersOf,
} from './segment'

export interface MonitoringFilters {
  period?: string
  state?: string
  tahap?: string
}

export interface MonitoringScope {
  now: number
  /** A school admin sees only their own school (INFERRED alias scope, build-plan v1.12 R.1.3). */
  scopeSchoolId?: number
}

const iso = (ms: number | undefined): string | null => (ms === undefined ? null : toIsoMyt(ms))

// --- S2 -----------------------------------------------------------------------------------------------

interface Universe {
  period: MonitoringPeriod
  state: string
  tahap: string
  /** Student-table schools within the state / scope (registered ≥ 1), any tahap, table order. */
  rows: SchoolEngagementRow[]
  teacherRows: TeacherEngagementRow[]
  /** "Jumlah Sekolah": schools with ≥ 1 user of any role. */
  schools: number
  loggedBySchool: Map<number, number>
}

/** The fixture school a scoped viewer sees (INFERRED, see `segment.ts`), else undefined. */
const universeExtra = (scope: MonitoringScope): number | undefined =>
  scope.scopeSchoolId !== undefined && isFixtureSchoolId(scope.scopeSchoolId)
    ? scope.scopeSchoolId
    : undefined

function universe(filters: MonitoringFilters, scope: MonitoringScope): Universe {
  const period = periodOf(filters.period)
  const state = filters.state ?? ''
  const tahap = filters.tahap ?? ''
  const wanted = (schoolId: number): boolean =>
    scope.scopeSchoolId === undefined || schoolId === scope.scopeSchoolId
  const stateOk = (s: { state: string }): boolean => state === '' || s.state === state

  const extra = universeExtra(scope)
  const engaged = engagedBySchool(period, scope.now, extra)
  // The raw (unrounded) percentage orders the table and picks the tahap; the row carries it rounded.
  const students: { row: SchoolEngagementRow; raw: number }[] = []
  for (const [schoolId, n] of registeredBySchool(extra)) {
    const fact = schoolFact(schoolId)
    if (n <= 0 || !wanted(schoolId) || !fact || !stateOk(fact)) continue
    const e = engaged.get(schoolId) ?? 0
    const raw = percent(e, n)
    students.push({
      raw,
      row: {
        schoolId,
        name: fact.name,
        code: fact.code,
        state: fact.state,
        registered: n,
        engaged: e,
        pct: round1(raw),
        tahap: tahapOf(raw),
      },
    })
  }
  students.sort((a, b) => b.raw - a.raw || a.row.schoolId - b.row.schoolId)

  const logged = teachersLoggedBySchool(extra)
  const teachers: { row: TeacherEngagementRow; raw: number }[] = []
  for (const [schoolId, n] of teachersBySchool(extra)) {
    const fact = schoolFact(schoolId)
    if (n <= 0 || !wanted(schoolId) || !fact || !stateOk(fact)) continue
    const l = logged.get(schoolId) ?? 0
    const raw = percent(l, n)
    teachers.push({
      raw,
      row: {
        schoolId,
        name: fact.name,
        code: fact.code,
        state: fact.state,
        registered: n,
        loggedIn: l,
        pct: round1(raw),
        tahap: tahapOf(raw),
      },
    })
  }
  teachers.sort((a, b) => b.raw - a.raw || a.row.schoolId - b.row.schoolId)

  const schools = schoolsWithUsers(extra).filter((id) => {
    const fact = schoolFact(id)
    return wanted(id) && fact !== null && stateOk(fact)
  }).length
  return {
    period,
    state,
    tahap,
    rows: students.map((s) => s.row),
    teacherRows: teachers.map((t) => t.row),
    schools,
    loggedBySchool: logged,
  }
}

/** The student table with the `tahap` filter applied (BR-M11-14: tahap filters this table only). */
const studentTable = (u: Universe): SchoolEngagementRow[] =>
  u.tahap === '' ? u.rows : u.rows.filter((r) => r.tahap === u.tahap)

function signalOf(
  r: SchoolEngagementRow,
  kind: Signal['kind'],
  loggedBySchool: Map<number, number>,
): Signal {
  return {
    schoolId: r.schoolId,
    name: r.name,
    kind,
    registered: r.registered,
    engaged: r.engaged,
    pct: r.pct,
    teachersLoggedIn: loggedBySchool.get(r.schoolId) ?? 0,
  }
}

/** BR-M11-16 signals from the student table ignoring `tahap`. */
function signalsOf(u: Universe): MonitoringOverview['signals'] {
  const best: Signal[] = []
  const attention: Signal[] = []
  const suggestions: Signal[] = []
  for (const r of u.rows) {
    if (r.tahap === 'Cemerlang') {
      if (best.length < 3) best.push(signalOf(r, 'best', u.loggedBySchool))
      continue
    }
    if (r.tahap === 'Sederhana') continue
    const kind = r.tahap === 'Rendah' ? 'rendah' : r.tahap === 'Kritikal' ? 'kritikal' : 'tiada'
    const s = signalOf(r, kind, u.loggedBySchool)
    attention.push(s)
    if (r.tahap === 'Kritikal') suggestions.push({ ...s, kind: 'motivasi' })
    else if (r.tahap === 'Tiada Langsung') {
      suggestions.push({ ...s, kind: s.teachersLoggedIn > 0 ? 'handsOn' : 'hubungi' })
    }
  }
  return { best, attention, suggestions }
}

/** BR-M11-15 weekly tracking over the student-table schools (state filter only). */
function weeklyOf(u: Universe, weeks: { k: number }[], now: number): WeeklyRow[] {
  const totals = answersBySchool('', now)
  const perWeek = weeks.map((w) => answersInWeek(w.k))
  const ordered = [...u.rows].sort((a, b) => {
    const ta = totals.get(a.schoolId) ?? 0
    const tb = totals.get(b.schoolId) ?? 0
    if (ta > 0 !== tb > 0) return ta > 0 ? -1 : 1
    return tb - ta || a.schoolId - b.schoolId
  })
  return ordered.map((r) => {
    const counts = perWeek.map((m) => m.get(r.schoolId) ?? 0)
    let bestIdx = -1
    counts.forEach((c, i) => {
      if (c > 0 && (bestIdx < 0 || c > (counts[bestIdx] as number))) bestIdx = i
    })
    const cells = counts.map((count, i) => {
      const prev = i > 0 ? (counts[i - 1] as number) : null
      let cls: WeeklyCellClass
      if (count === 0) cls = 'zero'
      else if (prev === null) cls = 'first'
      else if (count > prev) cls = 'up'
      else if (count < prev) cls = 'down'
      else cls = 'first'
      return { k: (weeks[i] as { k: number }).k, count, cls, best: i === bestIdx }
    })
    const last = counts[counts.length - 1] ?? 0
    const before = counts[counts.length - 2] ?? 0
    return {
      schoolId: r.schoolId,
      name: r.name,
      code: r.code,
      cells,
      trend: last > before ? 'up' : last < before ? 'down' : 'same',
      best:
        bestIdx >= 0
          ? { k: (weeks[bestIdx] as { k: number }).k, count: counts[bestIdx] as number }
          : null,
    }
  })
}

/** #3 S2 overview. */
export function monitoringOverview(
  filters: MonitoringFilters,
  scope: MonitoringScope,
): MonitoringOverview {
  const u = universe(filters, scope)
  const answers = answersBySchool(u.period, scope.now, universeExtra(scope))
  const students = u.rows.reduce((a, r) => a + r.registered, 0)
  const engaged = u.rows.reduce((a, r) => a + r.engaged, 0)
  const answered = u.rows.reduce((a, r) => a + (answers.get(r.schoolId) ?? 0), 0)
  const teachers = u.teacherRows.reduce((a, r) => a + r.registered, 0)
  const loggedIn = u.teacherRows.reduce((a, r) => a + r.loggedIn, 0)
  const weeks = weeksUntil(scope.now)
  return {
    filters: { period: u.period, state: u.state, tahap: u.tahap },
    kpi: {
      schools: u.schools,
      students,
      engaged,
      engagementPct: round1(percent(engaged, students)),
      answers: answered,
      avgPerStudent: engaged === 0 ? 0 : round1(answered / engaged),
      teachers,
      teachersLoggedIn: loggedIn,
      teacherPct: round1(percent(loggedIn, teachers)),
    },
    studentRows: studentTable(u),
    teacherRows: u.teacherRows,
    weeks,
    weekly: weeklyOf(u, weeks, scope.now),
    signals: signalsOf(u),
  }
}

/** #7 export rows (PROPOSED): the student table of the filters. */
export function monitoringExport(
  format: 'pdf' | 'csv',
  filters: MonitoringFilters,
  scope: MonitoringScope,
): MonitoringExport {
  const u = universe(filters, scope)
  return { filename: `monitoring-penglibatan.${format}`, rows: studentTable(u) }
}

// --- S3 -----------------------------------------------------------------------------------------------

const SUBSCRIPTION_STATUSES = ['active', 'cancelled', 'expired'] as const

/** BR-M11-33: the subscription with the latest `endsAt`; `grace` and others are not shown (UNVERIFIED). */
function subscriptionOf(schoolId: number): SchoolDetail['subscription'] {
  let latest: ReturnType<typeof schoolSubscriptions.forSchool>[number] | null = null
  for (const r of schoolSubscriptions.forSchool(schoolId)) {
    if (latest === null || r.endsAt > latest.endsAt) latest = r
  }
  if (!latest) return null
  const status = SUBSCRIPTION_STATUSES.find((s) => s === latest?.status)
  return status ? { status, endsAt: latest.endsAt } : null
}

/** #4 S3 school detail; null for an unknown school (a fixture school is known, BR-M11-34). */
export function schoolDetail(flags: FlagReader, schoolId: number): SchoolDetail | null {
  const fact = schoolFact(schoolId)
  if (!fact) return null
  const pupils = studentsOf(schoolId)
  const counts = answerCountsAll()
  const last = lastActivityMs(pupils.filter((p) => (counts.get(p.id) ?? 0) > 0).map((p) => p.id))

  const students = pupils
    .map((p) => {
      const answers = counts.get(p.id) ?? 0
      const flag = flags.level(p.id)
      return {
        id: p.id,
        name: p.name,
        email: p.email,
        level: levelLabelOf(p.grade),
        answers,
        status: statusOf(answers, p.lastLoginAt),
        engaged: answers > 0 && flag !== 'excluded',
        flag,
        lastLoginAt: p.lastLoginAt,
        lastActivityAt: iso(last.get(p.id)),
      }
    })
    .sort((a, b) => a.level.localeCompare(b.level) || byName(a, b))

  const teacherRows = teachersOf(schoolId)
    .map((t) => ({
      id: t.id,
      name: t.name,
      email: t.email,
      loggedIn: t.lastLoginAt !== null,
      lastLoginAt: t.lastLoginAt,
      createdAt: t.createdAt,
    }))
    .sort(byName)

  const fc = flags.bySchool().get(schoolId) ?? { review: 0, excluded: 0 }
  const engaged = students.filter((s) => s.engaged).length
  const answers = students.reduce((a, s) => a + s.answers, 0)
  const loggedIn = teacherRows.filter((t) => t.loggedIn).length
  const p = percent(engaged, students.length)
  return {
    school: { id: fact.id, name: fact.name, code: fact.code, state: fact.state },
    subscription: subscriptionOf(schoolId),
    warning: fc.review + fc.excluded > 0 ? { review: fc.review, excluded: fc.excluded } : null,
    tahap: tahapOf(p),
    pct: round1(p),
    cards: {
      students: students.length,
      engaged,
      answers,
      teachers: teacherRows.length,
      teachersLoggedIn: loggedIn,
    },
    flags: { review: fc.review, excluded: fc.excluded },
    students,
    teachers: teacherRows,
  }
}

// --- S5 -----------------------------------------------------------------------------------------------

/**
 * #6 S5 teacher detail. The person is loaded by `userId` without checking the school (BR-M11-29, live);
 * the pupil list is the whole school of the URL (BR-M11-24). Null for an unknown school or a user who is
 * not a teacher.
 */
export function teacherDetail(schoolId: number, userId: number): TeacherDetail | null {
  const fact = schoolFact(schoolId)
  const teacher = users.get(userId)
  if (!fact || !teacher || teacher.role !== 'teacher') return null
  const counts = answerCountsAll()
  const correct = correctByUser()
  const rows = studentsOf(schoolId)
    .map((p) => {
      const answers = counts.get(p.id) ?? 0
      return {
        id: p.id,
        name: p.name,
        level: levelLabelOf(p.grade),
        answers,
        raw: answers > 0 ? percent(correct.get(p.id) ?? 0, answers) : null,
        status: statusOf(answers, p.lastLoginAt),
        never: p.lastLoginAt === null,
      }
    })
    .sort(byName)
  const engaged = rows.filter((r) => r.answers > 0).length
  return {
    school: { id: fact.id, name: fact.name },
    teacher: {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      lastLoginAt: teacher.lastLoginAt,
    },
    cards: {
      students: rows.length,
      engaged,
      pct: round1(percent(engaged, rows.length)),
      needAttention: rows.filter((r) => r.answers === 0).length,
    },
    students: rows.map((r) => ({
      id: r.id,
      name: r.name,
      level: r.level,
      answers: r.answers,
      accuracy: r.raw === null ? null : round1(r.raw),
      status: r.status,
    })),
    suggestions: {
      neverLoggedIn: rows.filter((r) => r.never).length,
      lowAccuracy: rows.filter((r) => r.raw !== null && r.raw < 50).length,
      answered: engaged,
    },
  }
}
