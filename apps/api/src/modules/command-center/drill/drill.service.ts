import { Inject, Injectable } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import type {
  CommandCenterClass,
  CommandCenterHeadcountDetail,
  CommandCenterSchool,
  CommandCenterSessionDetail,
  CommandCenterSessionList,
  CommandCenterStudent,
  CommandCenterTeacher,
} from '@pp/contract'

import { CLOCK, type Clock } from '../../../db/clock'
import { PrismaService } from '../../../db/prisma.service'
import { PracticePorts, type PracticeQuestion, versionKey } from '../../practice'
import { notFound } from '../http/errors'
import { dateRangeOf } from '../http/request'
import type { Viewer } from '../http/viewer'
import { type ClassRow, CommandCenterRepository, type Ref, type SessionRow } from '../shared/command-center.repository'
import { percent } from '../shared/math'
import { HEADCOUNT_PORT, type HeadcountReadPort, MOOD_PORT, type MoodReadPort } from '../shared/ports'
import { type CcScope, ScopeService } from '../shared/scope.service'
import { addDays, dateKey, DAY_MS, startOfDateKey, startOfIsoWeek, toMytTimestamp } from '../shared/windows'
import { DrillReads } from './reads'

const FREE_CODE = 'UMUM'
const FREE_LABEL = 'Latihan Bebas'
const ANSWER_TEXT_MAX = 150

const idCmp = (a: string, b: string): number => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0)
const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name)
const uniq = (list: string[]): string[] => [...new Set(list)]

/** "D{n}" (Darjah, grades 1 to 6) or "T{n}" (Tingkatan, grades 7 to 11); '' for a level outside the standard ones. */
export function levelLabel(grade: number | null): string {
  if (grade === null || !Number.isInteger(grade) || grade < 1 || grade > 11) return ''
  return grade <= 6 ? `D${grade}` : `T${grade - 6}`
}

const classRefOf = (c: ClassRow): { id: string; name: string; level: string } => ({ id: c.id, name: c.name, level: levelLabel(c.educationGrade) })

const cut = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max)}...` : text)

/** Topic of a session row: chapter name, "Latihan Bebas" for free practice, else null. */
function topicOf(s: SessionRow): string | null {
  if (s.chapterName) return s.chapterName
  return s.subjectId === null ? FREE_LABEL : null
}

function listOf(sessions: SessionRow[]): CommandCenterSessionList {
  let answers = 0
  let correct = 0
  let seconds = 0
  const rows = sessions.map((s) => {
    answers += s.questionCount
    correct += s.correctCount
    seconds += s.timeSpentSec
    return {
      id: s.id,
      completedAt: toMytTimestamp(s.completedAt),
      subjectLabel: s.subjectId === null ? 'Umum' : (s.subjectName ?? 'Umum'),
      topic: topicOf(s),
      total: s.questionCount,
      correct: s.correctCount,
      accuracy: percent(s.correctCount, s.questionCount, 2),
      minutes: Math.floor(s.timeSpentSec / 60),
    }
  })
  return { totalAnswers: answers, totalSessions: rows.length, accuracy: percent(correct, answers, 1), timeSpentMinutes: Math.floor(seconds / 60), sessions: rows }
}

/**
 * DRILL slice (routes 4 to 11). Every method builds the viewer's scope first and checks the id against it (404 on a miss,
 * never 403) BEFORE any other validation: the week range is parsed after the scope check.
 *
 * Counting rules (mock `command-center-drill-*`): the school page counts the ACTIVE pupils' whole log; the teacher, class and
 * student pages count the members' whole log whether active or not. All reads exclude `is_test`.
 */
@Injectable()
export class DrillService {
  private readonly reads: DrillReads

  constructor(
    @Inject(CommandCenterRepository) readonly repo: CommandCenterRepository,
    @Inject(ScopeService) readonly scopes: ScopeService,
    @Inject(CLOCK) readonly clock: Clock,
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
    @Inject(MOOD_PORT) private readonly mood: MoodReadPort,
    @Inject(HEADCOUNT_PORT) private readonly headcountPort: HeadcountReadPort,
  ) {
    this.reads = new DrillReads(prisma)
  }

  // --- 4: school ------------------------------------------------------------------------------------------------

  async school(viewer: Viewer, schoolId: string): Promise<CommandCenterSchool> {
    const scope = await this.scopes.scopeOf(viewer)
    const school = await this.scopes.assertSchoolInScope(scope, schoolId)
    const now = this.clock.now()

    const classes = (await this.repo.classesOfSchool(schoolId, { activeClassroomsOnly: true })).filter((c) => c.ownerId !== null)
    const classesOf = new Map<string, ClassRow[]>()
    for (const c of classes) classesOf.set(c.ownerId as string, [...(classesOf.get(c.ownerId as string) ?? []), c])

    // Cards: "Jumlah Pelajar" is every student of the school; a teacher sees only the active members of the own classes there.
    let students: { id: string; isActive: boolean }[]
    if (scope.role === 'teacher') {
      const own = classes.filter((c) => scope.ownedClassIds.includes(c.id)).map((c) => c.id)
      const members = await this.repo.classMembers(own)
      students = await this.reads.studentsByIds(uniq(members.map((m) => m.studentId)))
    } else {
      students = await this.repo.studentsOfSchool(schoolId, { includeInactive: true })
    }
    const pupils = students.filter((u) => u.isActive).map((u) => u.id)
    const tally = await this.repo.answerTallyByUser({ to: now, studentIds: pupils })
    const answers = tally.reduce((a, t) => a + t.answers, 0)
    const correct = tally.reduce((a, t) => a + t.correct, 0)

    // Teachers of the school, then the owners of its classes who are not among them.
    const teachers = await this.repo.teachersOfSchool(schoolId)
    const listed = new Set(teachers.map((t) => t.id))
    const ownerOnly = [...classesOf.entries()]
      .filter(([id]) => !listed.has(id))
      .map(([id, list]) => ({ id, name: list[0]?.ownerName ?? '', ownerOnly: true }))
      .sort(byName)
    const rows = [...teachers.map((t) => ({ id: t.id, name: t.name, ownerOnly: false })).sort(byName), ...ownerOnly]
    const shown = scope.role === 'teacher' ? rows.filter((r) => r.id === scope.userId) : rows

    const classMembers = await this.repo.classMembers(shown.flatMap((r) => (classesOf.get(r.id) ?? []).map((c) => c.id)))
    const membersOf = (teacherId: string): string[] => {
      const classIds = new Set((classesOf.get(teacherId) ?? []).map((c) => c.id))
      return uniq(classMembers.filter((m) => classIds.has(m.classId)).map((m) => m.studentId))
    }
    const allMembers = uniq(shown.flatMap((r) => membersOf(r.id)))
    const recent = new Set(
      (await this.repo.answerTallyByUser({ from: addDays(now, -30), to: now, studentIds: allMembers, includeInactive: true })).map((t) => t.userId),
    )
    const subjects = await this.reads.teacherSubjects(shown.map((r) => r.id))
    const teacherRows = shown.map((r) => {
      const members = membersOf(r.id)
      return {
        userId: r.id,
        name: r.name,
        subjectText: subjects.get(r.id) ?? null,
        classes: classesOf.get(r.id)?.length ?? 0,
        students: members.length,
        active30d: members.filter((id) => recent.has(id)).length,
        ownerOnly: r.ownerOnly,
      }
    })
    return {
      school,
      cards: { students: students.length, active: tally.length, answers, accuracy: percent(correct, answers, 1) },
      teachers: teacherRows,
    }
  }

  // --- 5: teacher page ------------------------------------------------------------------------------------------

  async teacher(viewer: Viewer, schoolId: string, teacherId: string): Promise<CommandCenterTeacher> {
    const scope = await this.scopes.scopeOf(viewer)
    const { school, teacher } = await this.scopes.assertTeacherInScope(scope, schoolId, teacherId)
    const now = this.clock.now()
    const classes = (await this.repo.classesOfOwner(teacherId, { activeClassroomsOnly: true })).filter((c) => c.effectiveSchoolId === schoolId)
    const members = await this.repo.classMembers(classes.map((c) => c.id))
    const all = uniq(members.map((m) => m.studentId))
    const tally = new Map((await this.repo.answerTallyByUser({ to: now, studentIds: all, includeInactive: true })).map((t) => [t.userId, t]))
    const recent = new Set((await this.repo.answerTallyByUser({ from: addDays(now, -30), to: now, studentIds: all, includeInactive: true })).map((t) => t.userId))
    return {
      school,
      teacher: { id: teacher.id, name: teacher.name },
      classes: classes.map((c) => {
        const ids = uniq(members.filter((m) => m.classId === c.id).map((m) => m.studentId))
        let answers = 0
        let correct = 0
        for (const id of ids) {
          answers += tally.get(id)?.answers ?? 0
          correct += tally.get(id)?.correct ?? 0
        }
        return { id: c.id, name: c.name, level: levelLabel(c.educationGrade), students: ids.length, active30d: ids.filter((id) => recent.has(id)).length, answers, accuracy: percent(correct, answers, 1) }
      }),
    }
  }

  // --- 6: class -------------------------------------------------------------------------------------------------

  async classroom(viewer: Viewer, classId: string): Promise<CommandCenterClass> {
    const scope = await this.scopes.scopeOf(viewer)
    const cls = await this.scopes.assertClassInScope(scope, classId)
    const now = this.clock.now()
    const weekAgo = addDays(now, -7)
    const ids = uniq((await this.repo.classMembers([cls.id])).map((m) => m.studentId))
    const [names, tallies, moods, school] = await Promise.all([
      this.repo.userNames(ids),
      this.repo.answerTallyByUser({ to: now, studentIds: ids, includeInactive: true }),
      this.mood.latest(ids),
      cls.effectiveSchoolId ? this.repo.schoolRef(cls.effectiveSchoolId) : Promise.resolve(null),
    ])
    const tally = new Map(tallies.map((t) => [t.userId, t]))
    const students = ids
      .map((userId) => {
        const t = tally.get(userId)
        return {
          userId,
          name: names.get(userId) ?? '',
          answers: t?.answers ?? 0,
          accuracy: t ? percent(t.correct, t.answers, 1) : 0,
          lastActiveAt: t ? toMytTimestamp(t.lastAt) : null,
          status: t !== undefined && t.lastAt >= weekAgo && t.lastAt <= now ? ('aktif' as const) : ('tidak_aktif' as const),
          mood: moods.get(userId) ?? null,
        }
      })
      .sort((x, y) => y.answers - x.answers || idCmp(x.userId, y.userId))
    return { school, teacher: { id: cls.ownerId as string, name: cls.ownerName ?? '' }, class: classRefOf(cls), students }
  }

  // --- 7: headcount detail --------------------------------------------------------------------------------------

  /** Every config is unknown (404) until the headcount owner (BE-19) binds `HEADCOUNT_PORT`. */
  async headcount(viewer: Viewer, configId: string): Promise<CommandCenterHeadcountDetail> {
    const scope = await this.scopes.scopeOf(viewer)
    const config = await this.headcountPort.config(configId)
    if (!config) throw notFound()
    await this.scopes.assertClassInScope(scope, config.classId)
    return config.detail
  }

  // --- 8: student -----------------------------------------------------------------------------------------------

  private async mayOpenClass(scope: CcScope, cls: ClassRow): Promise<boolean> {
    if (scope.role === 'admin') return true
    if (scope.role === 'teacher') return scope.ownedClassIds.includes(cls.id)
    return cls.effectiveSchoolId === scope.schoolId
  }

  async student(viewer: Viewer, studentId: string): Promise<CommandCenterStudent> {
    const scope = await this.scopes.scopeOf(viewer)
    const user = await this.scopes.assertStudentInScope(scope, studentId)
    const now = this.clock.now()

    let cls: Awaited<ReturnType<CommandCenterRepository['classesOfStudent']>>[number] | null = null
    for (const c of await this.repo.classesOfStudent(studentId)) {
      if (await this.mayOpenClass(scope, c)) {
        cls = c
        break
      }
    }
    const own = { studentIds: [studentId], includeInactive: true }
    const monday = startOfIsoWeek(now)
    const [tally, allDays, recentDays, daily, breakdown, streak, moodTrend, school] = await Promise.all([
      this.repo.answerTally({ to: now, ...own }),
      this.repo.answerDays({ to: now, ...own }),
      this.repo.answerDays({ from: addDays(now, -56), to: now, ...own }),
      this.repo.dailyCounts({ from: addDays(monday, -49), to: now, ...own }),
      this.reads.subjectBreakdown(studentId, now),
      this.reads.streakOf(studentId),
      this.mood.trend(studentId, { from: startOfDateKey(dateKey(addDays(now, -29))), to: now }),
      user.schoolId ?? cls?.effectiveSchoolId ? this.repo.schoolRef((user.schoolId ?? cls?.effectiveSchoolId) as string) : Promise.resolve<Ref | null>(null),
    ])

    // "Pecahan Subjek": a free-practice answer (no session, or a session without subject) is UMUM.
    const bySubject = new Map<string, { code: string; label: string; correct: number; total: number }>()
    for (const b of breakdown) {
      const code = b.code ?? FREE_CODE
      const row = bySubject.get(code) ?? { code, label: b.code === null ? FREE_LABEL : (b.name ?? b.code), correct: 0, total: 0 }
      row.total += b.total
      row.correct += b.correct
      bySubject.set(code, row)
    }
    const subjects = [...bySubject.values()]
      .map((r) => ({ ...r, pct: percent(r.correct, r.total, 1) }))
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))

    // "Aktiviti Mingguan (8 Minggu)": the 8 Monday-based weeks ending with the current one, oldest first.
    const perDay = new Map(daily.map((d) => [d.day, d.answers]))
    const weeks = []
    for (let k = 7; k >= 0; k--) {
      const start = addDays(monday, -k * 7)
      let count = 0
      for (let d = 0; d < 7; d++) count += perDay.get(dateKey(addDays(start, d))) ?? 0
      const key = dateKey(start)
      weeks.push({ start: key, end: dateKey(addDays(start, 6)), label: `${key.slice(8, 10)}/${key.slice(5, 7)}`, count })
    }

    const accuracy = percent(tally.correct, tally.answers, 1)
    const consistency = percent(new Set(recentDays.map((d) => d.day)).size, 56, 0)
    const texts: string[] = []
    if (accuracy >= 90) texts.push(`Ketepatan cemerlang (${accuracy}%).`)
    if (consistency < 30) texts.push(`Konsistensi rendah (${consistency}%) - perlu usaha lebih.`)

    // Headcount rows of configs the viewer may open (the port answers none until BE-19 binds it).
    const headcount = []
    for (const row of await this.headcountPort.ofStudent(studentId)) {
      const config = await this.headcountPort.config(row.configId)
      if (!config) continue
      const cfgClass = await this.repo.classById(config.classId)
      if (cfgClass && (await this.mayOpenClass(scope, cfgClass))) headcount.push(row)
    }

    return {
      school,
      teacher: cls?.ownerId ? { id: cls.ownerId, name: cls.ownerName ?? '' } : null,
      class: cls ? classRefOf(cls) : null,
      student: { id: user.id, name: user.name },
      cards: { answers: tally.answers, accuracy, activeDays: new Set(allDays.map((d) => d.day)).size, streak, consistency },
      subjects,
      weeks,
      moodTrend,
      headcount,
      insight: { texts, source: 'Rule-based Analysis' },
    }
  }

  // --- 9, 10: session lists -------------------------------------------------------------------------------------

  /** `code` is trimmed or undefined; unknown or absent code = empty list (200). */
  async studentSubject(viewer: Viewer, studentId: string, code: string | undefined): Promise<CommandCenterSessionList> {
    const scope = await this.scopes.scopeOf(viewer)
    await this.scopes.assertStudentInScope(scope, studentId)
    if (!code) return listOf([])
    return listOf(await this.repo.completedSessions({ userId: studentId, subjectCode: code, newestFirst: true }))
  }

  /** `start`/`end` are the raw query values, parsed after the scope check; sessions completed in `[start 00:00, end + 1 day 00:00)` MYT, oldest first. */
  async studentWeek(viewer: Viewer, studentId: string, start: unknown, end: unknown): Promise<CommandCenterSessionList> {
    const scope = await this.scopes.scopeOf(viewer)
    await this.scopes.assertStudentInScope(scope, studentId)
    const range = dateRangeOf(start, end)
    const from = startOfDateKey(range.start)
    const to = new Date(startOfDateKey(range.end).getTime() + DAY_MS)
    return listOf(await this.repo.completedSessions({ userId: studentId, from, to }))
  }

  // --- 11: session detail ---------------------------------------------------------------------------------------

  /** The questions as the session served them (exact version). Empty until the question source is wired. */
  private async servedQuestions(refs: { questionId: string; versionNo: number }[]): Promise<ReadonlyMap<string, PracticeQuestion>> {
    if (refs.length === 0) return new Map()
    try {
      return await this.moduleRef.get(PracticePorts, { strict: false }).questions.versions(refs)
    } catch {
      return new Map()
    }
  }

  /** `sessionId` is '' when the path text is not a valid id shape (404). */
  async session(viewer: Viewer, sessionId: string): Promise<CommandCenterSessionDetail> {
    const scope = await this.scopes.scopeOf(viewer)
    const row = sessionId ? await this.repo.completedSession(sessionId) : null
    if (!row) throw notFound()
    await this.scopes.assertStudentInScope(scope, row.userId)

    const [answers, served] = await Promise.all([this.repo.sessionAnswers(row.id), this.repo.sessionQuestions(row.id)])
    const versionOf = new Map(served.map((s) => [s.questionId, s.versionNo]))
    const refs = uniq(answers.flatMap((a) => (a.questionId ? [a.questionId] : []))).flatMap((questionId) => {
      const versionNo = versionOf.get(questionId)
      return versionNo === undefined ? [] : [{ questionId, versionNo }]
    })
    const questions = await this.servedQuestions(refs)
    const detail = answers.map((a, i) => {
      const versionNo = a.questionId ? versionOf.get(a.questionId) : undefined
      const q = a.questionId && versionNo !== undefined ? questions.get(versionKey(a.questionId, versionNo)) : undefined
      const option = (label: string | null): string | null => {
        const hit = label === null ? undefined : q?.options.find((o) => o.label === label)
        return hit ? `${hit.label}) ${hit.text}` : null
      }
      return {
        no: i + 1,
        correct: a.isCorrect,
        questionText: cut(q?.questionText ?? '', ANSWER_TEXT_MAX),
        selectedAnswer: option(a.selectedLabel),
        correctAnswer: option(q?.correctLabel ?? null),
        answeredAt: toMytTimestamp(a.answeredAt),
      }
    })
    const total = row.questionCount
    return {
      subjectLabel: row.subjectId === null ? FREE_LABEL : (row.subjectName ?? FREE_LABEL),
      topic: topicOf(row),
      completedAt: toMytTimestamp(row.completedAt),
      total,
      correctCount: row.correctCount,
      wrongCount: total - row.correctCount,
      accuracy: percent(row.correctCount, total, 2),
      timeSpent: { m: Math.floor(row.timeSpentSec / 60), s: row.timeSpentSec % 60 },
      difficulty: row.difficulty,
      answers: detail,
    }
  }
}

