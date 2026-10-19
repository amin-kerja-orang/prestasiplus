/**
 * Builders of the Command Center pages S4–S7 (SRS M17 v1.12 §7 #6–#9, FR-M17-48…55, BR-M17-14,
 * BR-M17-15, BR-M17-27, BR-M17-30). Each builder returns `null` for an id that does not exist or that
 * the viewer's scope does not reach (the handler answers 404, FR-M17-07, FR-M17-60).
 *
 * Reads only: users (M01), schools (M02), subjects and chapters (M03), classes and teacher profiles
 * (M10), practice (M05), streak (M14), headcount (M08) and the F-33 `moodCheckins` store (M17,
 * provisional, owner M26).
 */

import { DAY_MS, formatDateKey, formatDayMonth, weekRange } from '@/lib/time'
import { users, type UserRow } from '@/modules/m01-authentication/mock'
import { schools } from '@/modules/m02-users-schools/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { practice } from '@/modules/m05-practice/mock'
import { headcount } from '@/modules/m08-student-performance/mock'
import { classrooms, teacherProfiles, type ClassroomRow } from '@/modules/m10-teacher-class/mock'
import { streak } from '@/modules/m14-gamification/mock'

import type {
  CcClass,
  CcClassRef,
  CcHeadcountRow,
  CcRef,
  CcSchool,
  CcSchoolTeacher,
  CcStudent,
  CcSubjectRow,
  CcTeacher,
  CcWeek,
} from '../../api/command-center-types'
import { moodCheckinsRepo } from '../repository/provisional-mood'
import {
  activeWithin30d,
  lastActivityMs,
  lastAnswerOf,
  levelLabel,
  memberIdsOf,
  percent,
  round1,
  studentsOf,
  sumTally,
  tallyOf,
  teachersOf,
} from './command-center-drill-data'
import { activeClassesAt, effectiveSchoolId, type DrillScope } from './command-center-drill-scope'

/** Code and label of mixed free practice (BR-M17-15, DV-M17-21). */
export const FREE_PRACTICE = { code: 'UMUM', label: 'Latihan Bebas' } as const

const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name)

export function schoolRef(schoolId: number | null): CcRef | null {
  if (schoolId === null) return null
  const school = schools.get(schoolId)
  return school ? { id: school.id, name: school.name } : null
}

function userRef(userId: number | null): CcRef | null {
  if (userId === null) return null
  const user = users.get(userId)
  return user ? { id: user.id, name: user.name } : null
}

export const classRef = (cls: ClassroomRow): CcClassRef => ({
  id: cls.classId,
  name: cls.name,
  level: levelLabel(cls.educationLevel),
})

// --- #6 S4 -------------------------------------------------------------------------------------

export function buildSchool(schoolId: number, scope: DrillScope, now: number): CcSchool | null {
  const school = schoolRef(schoolId)
  if (!school || !scope.mayOpenSchool(schoolId)) return null

  // Cards (FR-M17-49): "Jumlah Pelajar" counts every student, the other three are over P. An admin and a
  // school admin see the whole school; a teacher only the active members of the own classes at this
  // school (FR-M17-60 read literally: the reference server has no teacher drill-down scope, so nothing
  // else defines it; CommandCenterController.php:41-49 scopes only the school admin's board).
  let students = studentsOf(schoolId)
  if (scope.teacherId !== null) {
    students = users
      .getMany(memberIdsOf(scope.ownClasses.filter((c) => effectiveSchoolId(c) === schoolId)))
      .filter((u) => u.role === 'student')
  }
  const pupils = students.filter((u) => u.isActive).map((u) => u.id)
  const tally = tallyOf(pupils)
  const total = sumTally(pupils, tally)
  const cards = {
    students: students.length,
    active: pupils.filter((id) => tally.has(id)).length,
    answers: total.answers,
    accuracy: round1(percent(total.correct, total.answers)),
  }

  // Teachers, then the owners of the school's classes who are not among them (DV-M17-22).
  const classes = activeClassesAt(schoolId)
  const classesOf = new Map<number, ClassroomRow[]>()
  for (const c of classes) {
    if (c.teacherId === null) continue
    const list = classesOf.get(c.teacherId)
    if (list) list.push(c)
    else classesOf.set(c.teacherId, [c])
  }
  const teachers = teachersOf(schoolId)
  const listed = new Set(teachers.map((t) => t.id))
  const ownerOnly = [...classesOf.keys()]
    .filter((id) => !listed.has(id))
    .map((id) => users.get(id))
    .filter((u): u is UserRow => u !== undefined)

  const rows: { user: UserRow; ownerOnly: boolean }[] = [
    ...teachers.map((user) => ({ user, ownerOnly: false })).sort((a, b) => byName(a.user, b.user)),
    ...ownerOnly.map((user) => ({ user, ownerOnly: true })).sort((a, b) => byName(a.user, b.user)),
  ]
  const shown = scope.teacherId === null ? rows : rows.filter((r) => r.user.id === scope.teacherId)

  const members = new Map(
    shown.map((r) => [r.user.id, memberIdsOf(classesOf.get(r.user.id) ?? [])]),
  )
  const last = lastActivityMs([...new Set([...members.values()].flat())])
  const teacherRows: CcSchoolTeacher[] = shown.map(({ user, ownerOnly: only }) => {
    const ids = members.get(user.id) ?? []
    return {
      userId: user.id,
      name: user.name,
      subjectText: teacherProfiles.forUser(user.id)?.subject?.trim() || null,
      classes: classesOf.get(user.id)?.length ?? 0,
      students: ids.length,
      active30d: activeWithin30d(ids, last, now),
      ownerOnly: only,
    }
  })
  return { school, cards, teachers: teacherRows }
}

// --- #7 S5 -------------------------------------------------------------------------------------

export function buildTeacher(
  schoolId: number,
  userId: number,
  scope: DrillScope,
  now: number,
): CcTeacher | null {
  const school = schoolRef(schoolId)
  const user = users.get(userId)
  if (!school || !user || !scope.mayOpenTeacher(schoolId, userId)) return null
  const classes = activeClassesAt(schoolId)
    .filter((c) => c.teacherId === userId)
    .sort((a, b) => a.classId - b.classId)
  // The teacher belongs to the page when employed at the school or owning a class there.
  if (!(user.role === 'teacher' && user.schoolId === schoolId) && classes.length === 0) return null

  const members = new Map(classes.map((c) => [c.classId, classrooms.memberIds(c.kind, c.classId)]))
  const all = [...new Set([...members.values()].flat())]
  const tally = tallyOf(all)
  const last = lastActivityMs(all)
  return {
    school,
    teacher: { id: user.id, name: user.name },
    classes: classes.map((c) => {
      const ids = members.get(c.classId) ?? []
      const sum = sumTally(ids, tally)
      return {
        id: c.classId,
        name: c.name,
        level: levelLabel(c.educationLevel),
        students: ids.length,
        active30d: activeWithin30d(ids, last, now),
        answers: sum.answers,
        accuracy: round1(percent(sum.correct, sum.answers)),
      }
    }),
  }
}

// --- #8 S6 -------------------------------------------------------------------------------------

export function buildClass(classId: number, scope: DrillScope, now: number): CcClass | null {
  const cls = classrooms.get('classroom', classId)
  if (!cls || !scope.mayOpenClass(cls) || cls.teacherId === null) return null
  const teacher = userRef(cls.teacherId)
  if (!teacher) return null

  const weekAgo = now - 7 * DAY_MS
  const ids = classrooms.memberIds(cls.kind, cls.classId)
  const tally = tallyOf(ids)
  const last = lastAnswerOf(ids)
  const students = ids
    .map((userId) => {
      const t = tally.get(userId)
      const at = last.get(userId)
      return {
        userId,
        name: users.get(userId)?.name ?? '',
        answers: t?.answers ?? 0,
        accuracy: t ? round1(percent(t.correct, t.answers)) : 0,
        // "Terakhir Aktif" is the latest `answeredAt`, not a session time.
        lastActiveAt: at?.iso ?? null,
        status:
          at !== undefined && at.ms >= weekAgo && at.ms <= now
            ? ('aktif' as const)
            : ('tidak_aktif' as const),
        mood: moodCheckinsRepo.latestForUser(userId)?.mood ?? null,
      }
    })
    .sort((x, y) => y.answers - x.answers || x.userId - y.userId)
  return { school: schoolRef(effectiveSchoolId(cls)), teacher, class: classRef(cls), students }
}

// --- #9 S7 -------------------------------------------------------------------------------------

/** The pupil's first active teacher-created class the viewer may open (INFERRED, FR-M17-53). */
function firstClass(userId: number, scope: DrillScope): ClassroomRow | null {
  const found: { joinedAt: string; cls: ClassroomRow }[] = []
  for (const e of classrooms.enrolmentsOf(userId)) {
    if (e.status !== 'active' || e.classroomKind !== 'classroom') continue
    const cls = classrooms.get('classroom', e.classroomId)
    if (cls?.isActive && scope.mayOpenClass(cls)) found.push({ joinedAt: e.joinedAt, cls })
  }
  found.sort((a, b) => a.joinedAt.localeCompare(b.joinedAt) || a.cls.classId - b.cls.classId)
  return found[0]?.cls ?? null
}

/** `{code, label}` of a session subject; `null` (mixed free practice) is `UMUM` (BR-M17-15). */
export function subjectOf(subjectId: number | null): { code: string; label: string } {
  if (subjectId === null) return FREE_PRACTICE
  const subject = curriculum.subject(subjectId)
  return subject ? { code: subject.code, label: subject.name } : FREE_PRACTICE
}

const PASS_GRADES = new Set(['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C'])
export const isPass = (grade: string | null): boolean => grade !== null && PASS_GRADES.has(grade)

export function buildStudent(userId: number, scope: DrillScope, now: number): CcStudent | null {
  const user = users.get(userId)
  if (!user || user.role !== 'student' || !scope.mayOpenStudent(userId)) return null

  const cls = firstClass(userId, scope)
  const answers = practice.answers(userId)
  const total = answers.length
  let correct = 0
  const days = new Set<string>()
  const recentDays = new Set<string>()
  const from56 = now - 56 * DAY_MS
  for (const a of answers) {
    if (a.isCorrect) correct++
    const day = formatDateKey(a.answeredAtMs)
    days.add(day)
    if (a.answeredAtMs >= from56 && a.answeredAtMs <= now) recentDays.add(day)
  }

  // "Pecahan Subjek": by the subject of the answer's session; a sessionless answer is free practice.
  const sessionSubject = new Map<string, number | null>()
  for (const s of practice.history(userId)) sessionSubject.set(s.id, s.subjectId)
  const bySubject = new Map<string, CcSubjectRow>()
  for (const a of answers) {
    let subjectId: number | null = null
    if (a.sessionId !== null) {
      subjectId = sessionSubject.has(a.sessionId)
        ? (sessionSubject.get(a.sessionId) ?? null)
        : (practice.session(a.sessionId)?.subjectId ?? null)
    }
    const { code, label } = subjectOf(subjectId)
    const row = bySubject.get(code) ?? { code, label, correct: 0, total: 0, pct: 0 }
    row.total++
    if (a.isCorrect) row.correct++
    bySubject.set(code, row)
  }
  const subjects = [...bySubject.values()]
    .map((r) => ({ ...r, pct: round1(percent(r.correct, r.total)) }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))

  // "Aktiviti Mingguan (8 Minggu)": the 8 Monday-based weeks ending with the current one.
  const monday = weekRange(now).start
  const weeks: CcWeek[] = []
  for (let k = 7; k >= 0; k--) {
    const start = monday - k * 7 * DAY_MS
    const end = start + 7 * DAY_MS
    let count = 0
    for (const a of answers) if (a.answeredAtMs >= start && a.answeredAtMs < end) count++
    weeks.push({
      start: formatDateKey(start),
      end: formatDateKey(end - DAY_MS),
      label: formatDayMonth(start),
      count,
    })
  }

  const moodTrend = moodCheckinsRepo
    .forUser(userId, { from: formatDateKey(now - 29 * DAY_MS), to: formatDateKey(now) })
    .map((m) => ({ date: m.date, mood: m.mood, reason: m.reason }))

  const accuracy = round1(percent(correct, total))
  const consistency = Math.round((recentDays.size / 56) * 100)
  const texts: string[] = []
  if (accuracy >= 90) texts.push(`Ketepatan cemerlang (${String(accuracy)}%).`)
  if (consistency < 30)
    texts.push(`Konsistensi rendah (${String(consistency)}%) - perlu usaha lebih.`)

  const schoolId = user.schoolId ?? (cls ? effectiveSchoolId(cls) : null)
  return {
    school: schoolRef(schoolId),
    teacher: cls ? userRef(cls.teacherId) : null,
    class: cls ? classRef(cls) : null,
    student: { id: user.id, name: user.name },
    cards: {
      answers: total,
      accuracy,
      activeDays: days.size,
      streak: streak.get(userId).current,
      consistency,
    },
    subjects,
    weeks,
    moodTrend,
    headcount: headcountRows(userId, scope),
    insight: { texts, source: 'Rule-based Analysis' },
  }
}

/** "HeadCount" rows: the pupil's entries (dropped ones excluded) in configs the viewer may open. */
function headcountRows(userId: number, scope: DrillScope): CcHeadcountRow[] {
  const rows: CcHeadcountRow[] = []
  for (const entry of headcount.entriesOfStudent(userId)) {
    if (entry.dropped) continue
    const config = headcount.config(entry.configId)
    if (!config || !scope.mayOpenConfig(config.classroomId)) continue
    const graded = headcount.get(config.id)?.entries.find((e) => e.studentId === userId)
    rows.push({
      configId: config.id,
      subject: curriculum.subject(config.subjectId)?.name ?? '',
      tov: entry.tov,
      etr: entry.etr,
      rs: entry.rs,
      grade: graded?.grade ?? null,
      date: formatDateKey(config.updatedAt),
    })
  }
  return rows.sort((a, b) => a.configId - b.configId)
}
