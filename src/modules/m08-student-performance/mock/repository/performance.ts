/**
 * The S1–S4 read models (SRS M08 v1.11 §4 BR-M08-01…09; §7 #1–#4): computed per request from the
 * owners' datasets (M05 sessions, M10 classes, M01 users) and the headcount port (BR-M08-06: no total
 * is stored). Every unobserved rule is marked INFERRED where it is used.
 */

import { users } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { classrooms, type ClassroomRow } from '@/modules/m10-teacher-class/mock'
import { practice, practiceAnswers } from '@/modules/m05-practice/mock'

import type { ClassCard, LevelClassRow, LevelDetail, SchoolPerformance } from '../../api/types'
import { GPS_CHART } from '../data/observed'
import { headcountRevisionOf } from './headcount'
import {
  headcountReaderGeneration,
  headcountReads,
  isGraded,
  latestAr,
  pairIsOn,
  type HeadcountEntryView,
} from './headcount-port'
import {
  LEVEL_SLUG,
  checkStamp,
  performanceMemo,
  levelStudentIds,
  meanAccuracy,
  studentsOfClasses,
  sumTotals,
  totalsOf,
  answerTotalsOf,
} from './reads'
import {
  GRADES,
  capPercent,
  gpsBand,
  gradeOfPoints,
  gradePoints,
  gradeOfPercent,
  pct,
  round,
  type Grade,
} from './rules'
import { schoolSpmHistoryRepo } from './stores'

/** BR-M08-04 Pencapaian bar: round((9.5 − GPS) ÷ 9.5 × 100)%; 9.5 is the observed scale base. */
const GPS_BAR_BASE = 9.5

const LEVEL_ID: Readonly<Record<'t4' | 't5', number>> = { t4: 10, t5: 11 }
export const LEVEL_NAME: Readonly<Record<'t4' | 't5', string>> = {
  t4: 'Tingkatan 4',
  t5: 'Tingkatan 5',
}

export type Scope = { kind: 'platform' } | { kind: 'school'; schoolId: number }

const inScope = (scope: Scope, studentId: number): boolean =>
  scope.kind === 'platform' || users.get(studentId)?.schoolId === scope.schoolId

function scopedEntries(scope: Scope): HeadcountEntryView[] {
  return headcountReads.entries().filter((e) => inScope(scope, e.studentId))
}

/** BR-M08-01: the grade of an entry = the grade of its latest AR. */
export const entryGrade = (e: HeadcountEntryView): Grade | null => {
  const l = latestAr(e)
  return l === null ? null : gradeOfPercent(l.ar)
}

/** GPS = Σ points ÷ graded entries, 2 decimals (BR-M08-01). */
export function gpsOf(entries: readonly HeadcountEntryView[]): {
  value: number | null
  entries: number
} {
  let points = 0
  let n = 0
  for (const e of entries) {
    const g = entryGrade(e)
    if (g === null) continue
    points += gradePoints(g)
    n++
  }
  return { value: n === 0 ? null : round(points / n, 2), entries: n }
}

/** Classes of a scope (M10): the platform's every class, a school's own (`schoolId`). */
export function classesOf(scope: Scope): ClassroomRow[] {
  return scope.kind === 'platform'
    ? classrooms.list({ kind: 'classroom' })
    : classrooms.list({ kind: 'classroom', schoolId: scope.schoolId })
}

// ---------------------------------------------------------------------------------------------
// Level aggregate (BR-M08-07)
// ---------------------------------------------------------------------------------------------

export interface LevelAggregate {
  code: 't4' | 't5'
  classes: ClassroomRow[]
  studentIds: number[]
  sessions: number
  accuracy: number
  subjects: number
}

/** Kelas / Murid / Sesi (distinct) / Purata Ketepatan (session mean) / subjects of a level in a scope. */
export function levelAggregate(code: 't4' | 't5', scope: Scope): LevelAggregate {
  const slug = LEVEL_SLUG[code]
  const classes = classrooms
    .list({ educationLevel: slug })
    .filter((c) => scope.kind === 'platform' || c.schoolId === scope.schoolId)
  const studentIds = scope.kind === 'platform' ? levelStudentIds(slug) : studentsOfClasses(classes)
  const totals = sumTotals(studentIds, 'all')
  return {
    code,
    classes,
    studentIds,
    sessions: totals.sessions,
    accuracy: meanAccuracy(totals),
    subjects: new Set(classes.map((c) => c.subjectId).filter((s): s is number => s !== null)).size,
  }
}

// ---------------------------------------------------------------------------------------------
// #1 School / platform dashboard
// ---------------------------------------------------------------------------------------------

/**
 * S1_OBSERVED_EMPTY_SUBJECTS: rows 17 and 18 of the observed subject GPS table (discovery M08 §A.2, lines
 * 1078–1079): "Pendidikan Seni Visual" and "Sains Sukan" with "—" and 0 counts after "Perniagaan". DISPLAY
 * CONSTANT under D11 (DV-M08-38): no data rule reproduces them (subjects with any entry give 20 rows,
 * subjects of the T5 classes 26, subjects of configs also fails). Platform scope only; a row is appended
 * only when the subject has no computed row, so real graded entries always win.
 */
export const S1_OBSERVED_EMPTY_SUBJECTS: readonly string[] = [
  'Pendidikan Seni Visual',
  'Sains Sukan',
]

function subjectRows(
  entries: readonly HeadcountEntryView[],
  platform = false,
): SchoolPerformance['subjects'] {
  const by = new Map<number, HeadcountEntryView[]>()
  for (const e of entries) {
    if (!isGraded(e)) continue
    by.set(e.subjectId, [...(by.get(e.subjectId) ?? []), e])
  }
  const rows = [...by.entries()].map(([subjectId, list]) => {
    const gps = gpsOf(list).value as number
    let on = 0
    let below = 0
    let noTarget = 0
    for (const e of list) {
      const l = latestAr(e)
      if (l === null || l.target === null) noTarget++
      else if (pairIsOn(e)) on++
      else below++
    }
    return {
      subjectId,
      name: curriculum.subject(subjectId)?.name ?? `Subjek ${String(subjectId)}`,
      gps,
      grade: gradeOfPoints(gps),
      entries: list.length,
      onTrack: on,
      below,
      noTarget,
      achievementPct: Math.round(((GPS_BAR_BASE - gps) / GPS_BAR_BASE) * 100),
    }
  })
  // BR-M08-04: GPS ascending; the subjects without data come last.
  const out: SchoolPerformance['subjects'] = rows.sort(
    (a, b) => a.gps - b.gps || a.subjectId - b.subjectId,
  )
  if (platform) {
    const have = new Set(out.map((r) => r.subjectId))
    for (const name of S1_OBSERVED_EMPTY_SUBJECTS) {
      const subject = curriculum.subjects().find((x) => x.name === name)
      if (!subject || have.has(subject.id)) continue
      out.push({
        subjectId: subject.id,
        name: subject.name,
        gps: null,
        grade: null,
        entries: 0,
        onTrack: 0,
        below: 0,
        noTarget: 0,
        achievementPct: null,
      })
    }
  }
  return out
}

/** Per-student status of a set of pairs (BR-M08-08 rule 3): on when ≥ 1 pair on, else below when ≥ 1 below. */
export function studentStatuses(entries: readonly HeadcountEntryView[]): {
  on: number
  below: number
} {
  const by = new Map<number, { on: boolean; below: boolean }>()
  for (const e of entries) {
    const s = by.get(e.studentId) ?? { on: false, below: false }
    const l = latestAr(e)
    if (l !== null && l.target !== null) {
      if (l.ar >= l.target) s.on = true
      else s.below = true
    }
    by.set(e.studentId, s)
  }
  let on = 0
  let below = 0
  for (const s of by.values()) {
    if (s.on) on++
    else if (s.below) below++
  }
  return { on, below }
}

/**
 * Owner data stamp of the S1 memo: M05 log (session + answer counts, checked by `checkStamp`, which also
 * clears the memo), M01 pupil / teacher / user counts of the scope, M10 class count + active-class count +
 * active enrolments of the scope's classes, the M08 headcount write revision and the headcount reader generation (re-registered by seeds / tests). No store exposes a
 * version counter publicly, so these are the cheapest changes that cover every public write path.
 * NOT detected: an edit that keeps every count equal (a user moved or renamed, a class renamed or its
 * teacher / subject changed, a student swapped between classes, a direct edit of a stored SPM history
 * row) until the next seed / reset or `resetReadCache()`; the tests that edit owner data call it.
 * Count-preserving-edit limit also covers M01 user renames and M10 class renames / subject changes.
 */
function ownerStamp(scope: Scope): string {
  const classes = classesOf(scope)
  let active = 0
  let members = 0
  for (const c of classes) {
    if (c.isActive) active++
    members += classrooms.memberCount(c.kind, c.classId)
  }
  const people =
    scope.kind === 'platform'
      ? Object.values(users.roleCounts()).join('.')
      : [
          users.countWhere({ role: 'student', schoolId: scope.schoolId }),
          users.countWhere({ role: 'teacher', schoolId: scope.schoolId }),
          users.countWhere({ schoolId: scope.schoolId }),
        ].join('.')
  return [
    classes.length,
    active,
    members,
    people,
    headcountRevisionOf(),
    headcountReaderGeneration(),
  ].join(':')
}

/** S1 read model, memoised per (scope, clock year) and owner data stamp; the result equals `computeSchoolPerformance`. */
export function schoolPerformance(scope: Scope, clockYear: number): SchoolPerformance {
  checkStamp()
  const key = `${scope.kind === 'platform' ? 'platform' : String(scope.schoolId)}|${String(clockYear)}`
  const stamp = ownerStamp(scope)
  const hit = performanceMemo.get(key)
  if (hit && hit.stamp === stamp) return structuredClone(hit.value as SchoolPerformance)
  const value = computeSchoolPerformance(scope, clockYear)
  performanceMemo.set(key, { stamp, value: structuredClone(value) })
  return value
}

function computeSchoolPerformance(scope: Scope, clockYear: number): SchoolPerformance {
  const classes = classesOf(scope).filter((c) => c.isActive)
  const studentRows =
    scope.kind === 'platform'
      ? null
      : users.adminList({ role: 'student', schoolId: scope.schoolId, pageSize: 100_000 }).rows
  const teacherRows =
    scope.kind === 'platform'
      ? null
      : users.adminList({ role: 'teacher', schoolId: scope.schoolId, pageSize: 100_000 }).rows
  const roleCounts = scope.kind === 'platform' ? users.roleCounts() : null
  const studentCount = roleCounts ? roleCounts.student : (studentRows?.length ?? 0)
  const teacherCount = roleCounts ? roleCounts.teacher : (teacherRows?.length ?? 0)

  let sessions: number
  let answered: number
  let accuracy: number
  if (scope.kind === 'platform') {
    sessions = practice.count('Q-SESS-ALL')
    answered = practiceAnswers.count('Q-ANS-ALL')
    accuracy = practice.sessionMeanAccuracy()
  } else {
    const ids = (studentRows ?? []).map((u) => u.id)
    const t = sumTotals(ids, 'all')
    sessions = t.sessions
    answered = ids.reduce((a, id) => a + answerTotalsOf(id).answered, 0)
    accuracy = meanAccuracy(t)
  }

  const entries = scopedEntries(scope)
  const gps = gpsOf(entries)
  const graded = entries.filter(isGraded)
  const counts = new Map<Grade, number>()
  for (const e of graded)
    counts.set(entryGrade(e) as Grade, (counts.get(entryGrade(e) as Grade) ?? 0) + 1)
  const distribution = GRADES.map((grade) => {
    const count = counts.get(grade) ?? 0
    return { grade, count, pct: round(pct(count, graded.length), 1) }
  })

  const history = schoolSpmHistoryRepo.platform()
  const years: SchoolPerformance['trend']['years'] = history.map((r, i) => ({
    year: r.year,
    gps: r.gps,
    band: gpsBand(r.gps),
    candidates: r.candidates,
    source: r.source,
    change: i === 0 ? null : round(r.gps - (history[i - 1] as { gps: number }).gps, 2),
    current: false,
  }))
  if (!years.some((y) => y.year === clockYear)) {
    years.push({
      year: clockYear,
      gps: null,
      band: null,
      candidates: null,
      source: null,
      change: null,
      current: true,
    })
  }

  const levels = (['t4', 't5'] as const).map((code) => {
    const a = levelAggregate(code, scope)
    return {
      code,
      accuracy: round(a.accuracy, 1),
      classes: a.classes.length,
      students: a.studentIds.length,
      sessions: a.sessions,
    }
  })

  return {
    scope: scope.kind,
    header: { classCount: classes.length, studentCount },
    stats: {
      students: studentCount,
      teachers: teacherCount,
      classes: classes.length,
      subjects: new Set(classes.map((c) => c.subjectId).filter((s): s is number => s !== null))
        .size,
      sessions,
      answered,
      accuracy: round(capPercent(accuracy), 1),
    },
    gps: {
      value: gps.value,
      band: gps.value === null ? null : gpsBand(gps.value),
      entries: gps.entries,
    },
    distribution,
    trend: { years, chart: { ...GPS_CHART, subjects: GPS_CHART.subjects.map((s) => ({ ...s })) } },
    subjects: subjectRows(entries, scope.kind === 'platform'),
    levels,
    teachers: teacherCards(scope, entries),
  }
}

/** FR-M08-20: one card per teacher who owns a class, by name A→Z. */
function teacherCards(
  scope: Scope,
  entries: readonly HeadcountEntryView[],
): SchoolPerformance['teachers'] {
  const byTeacher = new Map<number, ClassroomRow[]>()
  for (const c of classesOf(scope)) {
    if (c.teacherId === null || c.kind !== 'classroom') continue
    byTeacher.set(c.teacherId, [...(byTeacher.get(c.teacherId) ?? []), c])
  }
  const byClass = new Map<string, HeadcountEntryView[]>()
  for (const e of entries) {
    const k = `${e.classroomKind}:${String(e.classroomId)}`
    byClass.set(k, [...(byClass.get(k) ?? []), e])
  }
  const out: SchoolPerformance['teachers'] = []
  for (const [teacherId, own] of byTeacher) {
    const u = users.get(teacherId)
    const ids = studentsOfClasses(own)
    const totals = sumTotals(ids, 'all')
    const hc = own.flatMap((c) => byClass.get(`${c.kind}:${String(c.classId)}`) ?? [])
    const st = hc.length === 0 ? null : studentStatuses(hc)
    out.push({
      userId: teacherId,
      name: u?.name ?? `Guru ${String(teacherId)}`,
      classCount: own.length,
      studentCount: ids.length,
      // INFERRED: the teacher's "Ketepatan" is the session mean over the pupils of the own classes.
      accuracy: round(capPercent(meanAccuracy(totals)), 1),
      onTrack: st ? st.on : null,
      below: st ? st.below : null,
    })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name) || a.userId - b.userId)
}

// ---------------------------------------------------------------------------------------------
// #3 Level detail
// ---------------------------------------------------------------------------------------------

/** BR-M08-09 order key: "Tiada Subjek" first, subject names A–Z, "Kelas Sekolah" last. */
function groupKey(c: ClassroomRow): [number, string] {
  if (c.kind === 'school_class') return [2, '']
  if (c.subjectId === null) return [0, '']
  return [1, curriculum.subject(c.subjectId)?.name ?? '']
}

export function levelDetail(code: 't4' | 't5', scope: Scope): LevelDetail {
  const agg = levelAggregate(code, scope)
  const levelId = LEVEL_ID[code]
  const entries = scopedEntries(scope).filter((e) => e.levelId === levelId)
  const pairs = entries.filter((e) => e.classroomKind === 'classroom')
  let on = 0
  let below = 0
  for (const e of entries) {
    // BR-M08-07: every pair counts; without a target or an AR it is Below (no "Tiada Data" bucket).
    if (pairIsOn(e)) on++
    else below++
  }

  const byClass = new Map<string, HeadcountEntryView[]>()
  for (const e of pairs) {
    const k = String(e.classroomId)
    byClass.set(k, [...(byClass.get(k) ?? []), e])
  }

  const classRows: LevelClassRow[] = [...agg.classes]
    .sort((a, b) => {
      const [ga, na] = groupKey(a)
      const [gb, nb] = groupKey(b)
      return (
        ga - gb || na.localeCompare(nb) || a.name.localeCompare(b.name) || a.classId - b.classId
      )
    })
    .map((c) => {
      const ids = classrooms.memberIds(c.kind, c.classId)
      const t = sumTotals(ids, 'all')
      const st =
        c.kind === 'classroom'
          ? studentStatuses(byClass.get(String(c.classId)) ?? [])
          : { on: 0, below: 0 }
      const teacher = c.teacherId === null ? null : (users.get(c.teacherId)?.name ?? null)
      return {
        classId: c.classId,
        kind: c.kind,
        name: c.name,
        subject:
          c.kind === 'school_class'
            ? 'Kelas Sekolah'
            : c.subjectId === null
              ? 'Tiada Subjek'
              : (curriculum.subject(c.subjectId)?.name ?? 'Tiada Subjek'),
        teacher,
        students: ids.length,
        sessions: t.sessions,
        // BR-M08-09: the class rows are per answer (Σ correct ÷ Σ questions of the sessions).
        accuracy: round(capPercent(pct(t.correct, t.questions)), 1),
        onTrack: st.on,
        below: st.below,
        href: c.kind === 'classroom' ? `/prestasi/kelas/${String(c.classId)}` : null,
      }
    })

  // Murid Terbaik: ≥ 3 sessions, mean session accuracy descending, ties by user id (BR-M08-07).
  const top = agg.studentIds
    .map((id) => ({ id, t: totalsOf(id).all }))
    .filter((x) => x.t.sessions >= 3)
    .map((x) => ({ ...x, acc: meanAccuracy(x.t) }))
    .sort((a, b) => b.acc - a.acc || a.id - b.id)
    .slice(0, 10)
    .map((x) => ({
      userId: x.id,
      name: users.get(x.id)?.name ?? `Murid ${String(x.id)}`,
      sessions: x.t.sessions,
      answered: x.t.questions,
      accuracy: round(capPercent(x.acc), 1),
    }))

  // Murid Berisiko: Below pairs with a target and an AR, gap ascending, then config, then user (≤ 15).
  const risk = entries
    .flatMap((e) => {
      const l = latestAr(e)
      if (l === null || l.target === null || l.ar >= l.target) return []
      return [{ e, l, gap: l.ar - l.target }]
    })
    .sort((a, b) => a.gap - b.gap || a.e.configId - b.e.configId || a.e.studentId - b.e.studentId)
    .slice(0, 15)
    .map(({ e, l, gap }) => ({
      userId: e.studentId,
      name: users.get(e.studentId)?.name ?? `Murid ${String(e.studentId)}`,
      className: classrooms.get(e.classroomKind, e.classroomId)?.name ?? '',
      checkpoint: l.n,
      ar: l.ar,
      target: l.target as number,
      gap: round(gap, 1),
    }))

  const stats = { on, below }
  return {
    code,
    name: LEVEL_NAME[code],
    classes: agg.classes.length,
    students: agg.studentIds.length,
    subjects: agg.subjects,
    accuracy: round(capPercent(agg.accuracy), 1),
    sessions: agg.sessions,
    onTrack: stats.on,
    below: stats.below,
    onTrackPct: Math.round(pct(stats.on, stats.on + stats.below)),
    classRows,
    topStudents: top,
    atRisk: risk,
  }
}

// ---------------------------------------------------------------------------------------------
// #4 / #10 class cards
// ---------------------------------------------------------------------------------------------

export function classCard(c: ClassroomRow, subjectName: string | null, color: string): ClassCard {
  return {
    id: c.classId,
    name: c.name,
    subjectName,
    color,
    students: classrooms.memberCount(c.kind, c.classId),
    year: c.academicYear,
    joinCode: c.joinCode,
    isActive: c.isActive,
  }
}
