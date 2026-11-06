import { Inject, Injectable, Optional } from '@nestjs/common'

import { ApiError } from '../../../../common/errors/api-error'
import { toMytTimestamp } from '../../../../common/time/myt'
import { CLOCK, type Clock } from '../../../../db/clock'
import { canOpenClassDashboard, viewerSchoolId } from '../domain/access-policy'
import {
  ACTIVE_DAYS,
  ATTENTION_BELOW,
  CLASS_TREND_DAYS,
  REDACTED_ID,
  SESSION_MODES,
  TOP_STUDENT_LIMIT,
  TOP_STUDENT_MIN_ANSWERS,
} from '../domain/constants'
import { canSeeName, nameFor } from '../domain/privacy'
import { accuracyOf, compareIds, round } from '../domain/rules'
import { lastDays, mytMidnight, startOfDaysAgo } from '../domain/windows'
import { HeadcountFactsService } from '../headcount/headcount-facts.service'
import { meanOrNull } from '../headcount/headcount.rules'
import { DIRECTORY_PORT, PerformancePorts, type AnswerFactRow, type DirectoryPort } from '../ports'
import { classBadge, liveEntries, newestConfigId } from './headcount-figures'
import type { HeadcountFacts } from './headcount-facts.types'
import { groupBy, nameMap, ownPupilIds, sessionTotalsOf, toCard } from './support'
import type { Ctx, PerformanceClassCard, PerformanceClassDashboard, PerformanceClassesAggregate } from './types'

/** One pupil's figures over the class, from the shared answer reader (every mode answers; game modes add no session). */
interface MemberRow {
  userId: string
  sessions: number
  answered: number
  correct: number
  last: Date | null
  /** null when nothing answered yet. */
  accuracy: number | null
  rawAccuracy: number
}

const sumOf = <T>(list: readonly T[], f: (x: T) => number): number => list.reduce((n, x) => n + f(x), 0)

/** Prestasi kelas (S4, S5). classDashboard throws NOT_FOUND for an unknown, school-kind or not-openable class. */
@Injectable()
export class ClassPerformanceService {
  constructor(
    protected readonly ports: PerformancePorts,
    @Inject(DIRECTORY_PORT) protected readonly directory: DirectoryPort,
    @Inject(CLOCK) protected readonly clock: Clock,
    @Optional() @Inject(HeadcountFactsService) protected readonly facts?: HeadcountFacts,
  ) {}

  /** A teacher gets the own active classrooms, a school admin the active classrooms of the own school; every other role gets []. */
  async ownClasses(ctx: Ctx): Promise<PerformanceClassCard[]> {
    let classes
    if (ctx.role === 'teacher') classes = await this.ports.classes.classesForTeacher(ctx.userId)
    else if (ctx.role === 'school_admin') {
      const schoolId = viewerSchoolId(ctx)
      classes = schoolId === null ? [] : await this.ports.classes.classesOfSchool(schoolId)
    } else return []
    return classes.filter((c) => c.kind === 'classroom' && c.isActive).map(toCard)
  }

  /**
   * `/prestasi/kelas` additive block (R1-GUR-4, FR-GUR-4-7): the cards plus "Pelajar Terbaik" (top 10 with at least 5 answers,
   * accuracy descending, ties by answers) and "Prestasi Mengikut Subjek" (accuracy per subject, descending) over the pupils of
   * those classes. One reader call; pooled accuracy (XS-5), capped at 100.
   */
  async classesAggregate(ctx: Ctx): Promise<PerformanceClassesAggregate> {
    const classes = await this.ownClasses(ctx)
    const rosters = await this.ports.classes.membersOf(classes.map((c) => c.id))
    const members = [...new Set([...rosters.values()].flat())].sort(compareIds)
    const rows = members.length === 0 ? [] : await this.ports.answerFacts.answerFacts({ userIds: members })

    const perUser = new Map<string, { answered: number; correct: number }>()
    const perSubject = new Map<string, { answered: number; correct: number }>()
    const add = (m: Map<string, { answered: number; correct: number }>, key: string, r: AnswerFactRow): void => {
      const t = m.get(key) ?? { answered: 0, correct: 0 }
      t.answered += r.attempts
      t.correct += r.correct
      m.set(key, t)
    }
    for (const r of rows) {
      add(perUser, r.userId, r)
      if (r.subjectId !== '0') add(perSubject, r.subjectId, r)
    }

    const best = [...perUser]
      .filter(([, t]) => t.answered >= TOP_STUDENT_MIN_ANSWERS)
      .map(([userId, t]) => ({ userId, ...t, raw: t.correct / t.answered }))
      .sort((a, b) => b.raw - a.raw || b.answered - a.answered || compareIds(a.userId, b.userId))
      .slice(0, TOP_STUDENT_LIMIT)
    const own = await ownPupilIds(this.ports, ctx)
    const [names, subjectNames] = await Promise.all([nameMap(this.directory, best.map((b) => b.userId)), this.directory.subjectsOfIds([...perSubject.keys()])])
    const topStudents = best.map((b) => {
      const visible = canSeeName(ctx.role, ctx.userId, b.userId, own)
      return { userId: visible ? b.userId : REDACTED_ID, name: nameFor(names.get(b.userId) ?? '', visible), answered: b.answered, accuracy: accuracyOf(b.correct, b.answered) }
    })
    const subjects = [...perSubject]
      .flatMap(([subjectId, t]) => {
        const name = subjectNames.get(subjectId)?.name
        return name === undefined ? [] : [{ subjectId, name, answered: t.answered, accuracy: accuracyOf(t.correct, t.answered), raw: t.correct / t.answered }]
      })
      .sort((a, b) => b.raw - a.raw || b.answered - a.answered || a.name.localeCompare(b.name) || compareIds(a.subjectId, b.subjectId))
      .map((r) => ({ subjectId: r.subjectId, name: r.name, answered: r.answered, accuracy: r.accuracy }))
    return { classes, topStudents, subjects }
  }

  /**
   * The newest config of the class (BR-M08-08 rule 2): above and on track both read "on"; members without a live entry are
   * "no data"; dropped pupils are left out. Null when the class has no entries (the config is then not visible to this reader).
   * The k = 5 cohort rule is deliberately not applied here: the viewers are the admin, the owner teacher and the school admin (all staff).
   * Teacher: own configs only (teacherId = the viewer).
   */
  private async headcountBlock(
    ctx: Ctx,
    classId: string,
    members: readonly string[],
  ): Promise<{ block: PerformanceClassDashboard['headcount']; badges: Map<string, 'on' | 'below' | 'na'> }> {
    const badges = new Map<string, 'on' | 'below' | 'na'>()
    if (!this.facts) return { block: null, badges }
    // A teacher sees only the own configs: a co-teaching colleague's newest config of the same class must not stand in for it.
    const all = (await this.facts.entriesOfClasses([classId])).filter((e) => ctx.role !== 'teacher' || e.teacherId === ctx.userId)
    const configId = newestConfigId(all.filter((e) => e.classroomId === classId))
    if (configId === null) return { block: null, badges }
    const ofConfig = all.filter((e) => e.configId === configId)
    const dropped = new Set(ofConfig.filter((e) => e.dropped).map((e) => e.studentId))
    const live = liveEntries(ofConfig)
    const byStudent = new Map(live.map((e) => [e.studentId, e]))
    const roster = [...new Set([...members.filter((m) => !dropped.has(m)), ...byStudent.keys()])]
    let on = 0
    let below = 0
    let none = 0
    for (const id of roster) {
      const b = classBadge(byStudent.get(id))
      badges.set(id, b)
      if (b === 'on') on++
      else if (b === 'below') below++
      else none++
    }
    const total = roster.length
    const share = (n: number): number => (total === 0 ? 0 : round((n / total) * 100, 1))
    return {
      block: {
        configId,
        onTrack: on,
        below,
        noData: none,
        pct: { on: share(on), below: share(below), none: share(none) },
        avgTov: meanOrNull(live.map((e) => e.tov)),
        avgEtr: meanOrNull(live.map((e) => e.etr)),
      },
      badges,
    }
  }

  async classDashboard(ctx: Ctx, id: string): Promise<PerformanceClassDashboard> {
    const cls = await this.ports.classes.classById(id)
    if (!cls || !canOpenClassDashboard(ctx, cls)) throw ApiError.of('NOT_FOUND')

    const members = await this.ports.classes.memberIds(cls.id)
    const now = this.clock.now()
    // Every figure comes from the shared answer reader (S10-T01): all modes answer, game modes add no session (XS-4, XS-5, XS-8).
    const query = { userIds: members, ...(cls.subjectId !== null ? { subjectId: cls.subjectId } : {}) }
    const days = lastDays(now, CLASS_TREND_DAYS)
    const trendWindow = { from: mytMidnight(days[0] as string), to: now }
    const reader = this.ports.answerFacts
    const [factRows, sessionRows, dayRows, daySessionRows, durationRows] =
      members.length === 0
        ? [[], [], [], [], []]
        : await Promise.all([
            reader.answerFacts(query),
            reader.sessionCounts({ ...query, modes: SESSION_MODES }),
            reader.dailyFacts({ ...query, ...trendWindow }),
            reader.dailyFacts({ ...query, ...trendWindow, modes: SESSION_MODES }),
            // Purata Masa/Sesi: finished sessions of the session modes, all time (the same scope as Jumlah Sesi).
            reader.sessionDurations({ ...query, modes: SESSION_MODES }),
          ])

    const byUser = groupBy(factRows, (r) => r.userId)
    const sessionsOf = sessionTotalsOf(sessionRows)
    const rows: MemberRow[] = members.map((userId) => {
      const list = byUser.get(userId) ?? []
      const answered = sumOf(list, (r) => r.attempts)
      const correct = sumOf(list, (r) => r.correct)
      const last = list.reduce<Date | null>((m, r) => (m === null || r.lastAnsweredAt > m ? r.lastAnsweredAt : m), null)
      return {
        userId,
        sessions: sessionsOf.get(userId) ?? 0,
        answered,
        correct,
        last,
        accuracy: answered === 0 ? null : accuracyOf(correct, answered),
        rawAccuracy: answered === 0 ? 0 : (correct / answered) * 100,
      }
    })

    const total = { sessions: sumOf(rows, (r) => r.sessions), answered: sumOf(rows, (r) => r.answered), correct: sumOf(rows, (r) => r.correct) }
    const activeFrom = startOfDaysAgo(now, ACTIVE_DAYS - 1)
    const active7d = rows.filter((r) => r.last !== null && r.last >= activeFrom).length

    // Daily trend (R1-GUR-4): the last 30 MYT days including today, zero-filled (a day without an answer is 0 / 0 / 0).
    // Sessions leave the game modes out; accuracy and active pupils count every answer.
    const sessionsByDay = new Map<string, number>()
    for (const r of daySessionRows) sessionsByDay.set(r.day, (sessionsByDay.get(r.day) ?? 0) + r.sessions)
    const trend = days.map((date) => {
      const list = dayRows.filter((r) => r.day === date && r.attempts > 0)
      return {
        date,
        sessions: sessionsByDay.get(date) ?? 0,
        avgAccuracy: list.length === 0 ? 0 : accuracyOf(sumOf(list, (r) => r.correct), sumOf(list, (r) => r.attempts)),
        activeStudents: new Set(list.map((r) => r.userId)).size,
      }
    })
    // Purata Masa/Sesi (BR-M08-10): sum of seconds / finished sessions / 60, one decimal; null when no session finished.
    const finished = sumOf(durationRows, (r) => r.sessions)
    const avgMinutes = finished === 0 ? null : round(sumOf(durationRows, (r) => r.seconds) / finished / 60, 1)

    const hc = await this.headcountBlock(ctx, cls.id, members)
    const names = await nameMap(this.directory, members)
    const nameOf = (id: string): string => names.get(id) ?? ''
    // Kedudukan Murid: accuracy descending (uncapped for the order), ties by answers descending then name; members without an answer last.
    const byName = (a: MemberRow, b: MemberRow): number => nameOf(a.userId).localeCompare(nameOf(b.userId)) || compareIds(a.userId, b.userId)
    const order = [...rows].sort((a, b) => {
      if (a.accuracy === null && b.accuracy === null) return byName(a, b)
      if (a.accuracy === null) return 1
      if (b.accuracy === null) return -1
      return b.rawAccuracy - a.rawAccuracy || b.answered - a.answered || byName(a, b)
    })
    const ranking = order.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      name: nameOf(r.userId),
      sessions: r.sessions,
      answered: r.answered,
      accuracy: r.accuracy,
      headcount: hc.badges.get(r.userId) ?? ('na' as const),
      lastActiveAt: r.last ? toMytTimestamp(r.last) : null,
    }))
    const attention = [
      ...order
        .filter((r) => r.accuracy !== null && r.rawAccuracy < ATTENTION_BELOW)
        .map((r) => ({ userId: r.userId, name: nameOf(r.userId), sessions: r.sessions, accuracy: r.accuracy })),
      ...rows
        .filter((r) => r.answered === 0)
        .sort((a, b) => compareIds(a.userId, b.userId))
        .map((r) => ({ userId: r.userId, name: nameOf(r.userId), sessions: 0, accuracy: null })),
    ]

    const school = await this.directory.school(cls.schoolId)
    return {
      class: { id: cls.id, name: cls.name, school: school?.name ?? '', subject: cls.subjectName, year: cls.year, joinCode: cls.joinCode },
      stats: {
        students: members.length,
        accuracy: accuracyOf(total.correct, total.answered),
        sessions: total.sessions,
        answered: total.answered,
        avgMinutes,
        active7d,
      },
      headcount: hc.block,
      attention,
      trend,
      ranking,
    }
  }
}
