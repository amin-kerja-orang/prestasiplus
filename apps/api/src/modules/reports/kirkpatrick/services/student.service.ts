import { Inject, Injectable } from '@nestjs/common'

import { ApiError } from '../../../../common/errors/api-error'
import { CLOCK, type Clock, mytDay } from '../../../../db/clock'
import { ClassesRepository } from '../../../classes'
import { compareIds } from '../domain/aggregate'
import { pct1, pctTenths } from '../domain/rules'
import { KirkpatrickRepository } from '../kirkpatrick.repository'
import type { KirkpatrickMe, KirkpatrickStudent } from '../types'
import { type Ctx, isSchoolForced } from './scope'

const DAY_MS = 86_400_000
const dayNumber = (day: string): number => Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS)
const addDays = (day: string, n: number): string => new Date((dayNumber(day) + n) * DAY_MS).toISOString().slice(0, 10)

/** BR-M12-28: consecutive active days ending at the last active day. */
export function streakOf(days: readonly string[]): number {
  if (days.length === 0) return 0
  let streak = 1
  for (let i = days.length - 1; i > 0; i--) {
    if (dayNumber(days[i] as string) - dayNumber(days[i - 1] as string) === 1) streak++
    else break
  }
  return streak
}

@Injectable()
export class StudentService {
  constructor(
    @Inject(KirkpatrickRepository) private readonly repo: KirkpatrickRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ClassesRepository) private readonly classes: ClassesRepository,
  ) {}

  /**
   * S8. One uniform 403 for an unknown id, a non-pupil and (teacher, school_admin) a pupil of another school, so
   * ids cannot be probed (FR-M12-17, SEC-M12-02). A pupil with no sessions gets the zero state.
   */
  async student(ctx: Ctx, id: string): Promise<KirkpatrickStudent> {
    const pupil = await this.repo.pupil(id)
    if (!pupil?.isStudent) throw ApiError.of('FORBIDDEN')
    if (ctx.role === 'teacher') {
      // A teacher opens only pupils of the own ACTIVE classes (data minimisation).
      if (!(await this.classes.teacherStudentIds(ctx.userId)).includes(id)) throw ApiError.of('FORBIDDEN')
    } else if (isSchoolForced(ctx.role) && (ctx.schoolId === null || pupil.schoolId !== ctx.schoolId)) throw ApiError.of('FORBIDDEN')

    const now = this.clock.now()
    const today = mytDay(now)
    const [totals, subjectRows, days] = await Promise.all([
      this.repo.pupilTotals(id, false),
      this.repo.pupilSubjects(id, false),
      this.repo.pupilDays(id, false),
    ])
    const names = await this.repo.subjectNames(subjectRows.map((s) => s.subjectId))
    const subjects = subjectRows
      .filter((s) => s.answered > 0)
      .map((s) => ({
        subjectId: s.subjectId,
        subjectName: names.get(s.subjectId) ?? `Subjek ${s.subjectId}`,
        answers: s.answered,
        tenths: pctTenths(s.correct, s.answered),
      }))
    const best = (a: (typeof subjects)[number], b: (typeof subjects)[number]): number =>
      b.tenths - a.tenths || b.answers - a.answers || compareIds(a.subjectId, b.subjectId)
    const worst = (a: (typeof subjects)[number], b: (typeof subjects)[number]): number =>
      a.tenths - b.tenths || b.answers - a.answers || compareIds(a.subjectId, b.subjectId)
    const ref = (s: (typeof subjects)[number] | undefined) => (s ? { subjectName: s.subjectName, accuracy: s.tenths / 10 } : null)

    // Konsistensi: share of the last 30 days (today included) with a completed session (the live formula is unobservable).
    const since = addDays(today, -29)
    const recent = days.filter((d) => d >= since && d <= today).length

    return {
      student: { id: pupil.id, name: pupil.name, schoolName: pupil.schoolName, grade: pupil.grade },
      activeDays: days.length,
      answers: totals.answered,
      accuracy: pct1(totals.correct, totals.answered),
      konsistensi: pct1(recent, 30),
      streak: streakOf(days),
      strongest: ref([...subjects].sort(best)[0]),
      weakest: ref([...subjects].sort(worst)[0]),
      // No headcount (TOV) table yet: an empty list for the year.
      headcount: { year: Number(today.slice(0, 4)), rows: [] },
      platform: [...subjects].sort(best).map((s) => ({ subjectName: s.subjectName, accuracy: s.tenths / 10, answers: s.answers })),
    }
  }

  /** S9: the viewer's own headcount (null without a TOV) and the 30 squares, today minus 29 to today. */
  async me(ctx: Ctx): Promise<KirkpatrickMe> {
    const today = mytDay(this.clock.now())
    const first = addDays(today, -29)
    const perDay = await this.repo.answersPerDay(ctx.userId, first, ctx.isTest)
    const days: KirkpatrickMe['days'] = []
    for (let i = 0; i < 30; i++) {
      const day = addDays(first, i)
      days.push({ date: `${day.slice(8, 10)}/${day.slice(5, 7)}`, answers: perDay.get(day) ?? 0 })
    }
    return { headcount: null, days }
  }
}
