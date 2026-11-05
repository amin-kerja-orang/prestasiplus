import { Inject, Injectable } from '@nestjs/common'
import { AMARAN_MONTH_ABBREVIATIONS, type GuruWeeklyReport, type GuruWeeklyReportQuery } from '@pp/contract'

import { ApiError } from '../../../../common/errors/api-error'
import { CLOCK, mytDay, type Clock } from '../../../../db/clock'
import { idFromString, idToString } from '../../../../db/ids'
import { PrismaService } from '../../../../db/prisma.service'
import { addMytDays } from '../domain/windows'
import { PerformancePorts } from '../ports'

const TOP_MIN_ANSWERS = 5
const LIST_CAP = 5
const ATTENTION_BELOW = 50

interface Tally {
  answered: number
  correct: number
}

/** Reads the answers of a pupil set in a half-open window; the Prisma implementation is the only one that touches the DB. */
interface WeeklyData {
  byPupil(pupilIds: readonly string[], from: Date, to: Date): Promise<Map<string, Tally>>
  bySubject(pupilIds: readonly string[], from: Date, to: Date): Promise<Map<string, Tally>>
  pupilNames(pupilIds: readonly string[]): Promise<Map<string, string>>
  subjectNames(subjectIds: readonly string[]): Promise<Map<string, string>>
}

const one = (correct: number, answered: number): number => (answered === 0 ? 0 : Math.round((correct / answered) * 1000) / 10)
const whole = (v: number): number => Math.round(v)
const byName = (a: string, b: string): number => a.localeCompare(b, 'ms')

function addTo(map: Map<string, Tally>, key: string, isCorrect: boolean, n: number): void {
  const t = map.get(key) ?? { answered: 0, correct: 0 }
  t.answered += n
  if (isCorrect) t.correct += n
  map.set(key, t)
}

/** Monday of the week containing `day` (YYYY-MM-DD). */
function mondayOf(day: string): string {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay()
  return addMytDays(day, -((dow + 6) % 7))
}

const startOf = (day: string): Date => new Date(`${day}T00:00:00+08:00`)

function labelDay(day: string): string {
  const [y, m, d] = day.split('-')
  return `${d} ${AMARAN_MONTH_ABBREVIATIONS[Number(m) - 1]} ${y}`
}

/**
 * Weekly report. `report()` (API-RPT-13, S21): 403 "This action is unauthorized." for every role by design
 * (live parity, OQ-M08-01). `guruReport()` is API-GUR-21 (S6-T01): the teacher's own class, Monday to Sunday MYT.
 */
@Injectable()
export class WeeklyReportService {
  constructor(
    @Inject(PerformancePorts) private readonly ports: PerformancePorts,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  report(): never {
    throw ApiError.of('FORBIDDEN')
  }

  /** Unknown class and another teacher's class are both 403 (AC-GUR-43-6, a documented exception to the 404 default). */
  async guruReport(teacherId: string, query: GuruWeeklyReportQuery): Promise<GuruWeeklyReport> {
    const cls = await this.ports.classes.classById(query.classroomId)
    if (cls === null || cls.teacherId !== teacherId) throw ApiError.of('FORBIDDEN')

    const monday = mondayOf(query.week ?? mytDay(this.clock.now()))
    const sunday = addMytDays(monday, 6)
    const from = startOf(monday)
    const to = startOf(addMytDays(monday, 7))
    const prevFrom = startOf(addMytDays(monday, -7))

    const pupils = await this.ports.classes.memberIds(cls.id)
    const data = this.data()
    const [now, before, subjects] =
      pupils.length === 0
        ? [new Map<string, Tally>(), new Map<string, Tally>(), new Map<string, Tally>()]
        : await Promise.all([data.byPupil(pupils, from, to), data.byPupil(pupils, prevFrom, from), data.bySubject(pupils, from, to)])
    const active = pupils.filter((id) => (now.get(id)?.answered ?? 0) > 0)
    const names = active.length === 0 ? new Map<string, string>() : await data.pupilNames(active)
    const nameOf = (id: string): string => names.get(id) ?? ''

    const rows = active.map((id) => {
      const t = now.get(id) as Tally
      const prev = before.get(id)
      const acc = one(t.correct, t.answered)
      const prevAcc = prev && prev.answered > 0 ? one(prev.correct, prev.answered) : null
      return { name: nameOf(id), answered: t.answered, accuracy: acc, prevAcc, delta: prevAcc === null ? 0 : whole(acc) - whole(prevAcc) }
    })

    const topPerformers = rows
      .filter((r) => r.answered >= TOP_MIN_ANSWERS)
      .sort((a, b) => whole(b.accuracy) - whole(a.accuracy) || b.answered - a.answered || byName(a.name, b.name))
      .slice(0, LIST_CAP)
      .map((r, i) => ({ rank: i + 1, name: r.name, answered: r.answered, accuracy: r.accuracy }))

    const improved = rows
      .filter((r) => r.prevAcc !== null && r.delta > 0)
      .sort((a, b) => b.delta - a.delta || byName(a.name, b.name))
    const mostImproved = improved
      .slice(0, LIST_CAP)
      .map((r) => ({ name: r.name, previousAccuracy: r.prevAcc as number, accuracy: r.accuracy, delta: r.delta }))

    const subjectNames = subjects.size === 0 ? new Map<string, string>() : await data.subjectNames([...subjects.keys()])
    const attentionSubjects = [...subjects.entries()]
      .map(([id, t]) => ({ subject: subjectNames.get(id) ?? '', accuracy: one(t.correct, t.answered), answered: t.answered }))
      .filter((s) => whole(s.accuracy) < ATTENTION_BELOW)
      .sort((a, b) => a.accuracy - b.accuracy || byName(a.subject, b.subject))

    return {
      classroom: { id: cls.id, name: cls.name },
      week: { from: monday, to: sunday, label: `${labelDay(monday)} — ${labelDay(sunday)}` },
      summary: {
        answered: rows.reduce((s, r) => s + r.answered, 0),
        activePupils: active.length,
        improvedPupils: improved.length,
        attentionSubjects: attentionSubjects.length,
      },
      topPerformers,
      mostImproved,
      attentionSubjects,
    }
  }

  /** Parameterised Prisma `groupBy` reads, all modes, non-test answers only. */
  private data(): WeeklyData {
    const db = (): PrismaService['client'] => this.prisma.client
    const where = (ids: readonly string[], from: Date, to: Date) => ({
      userId: { in: ids.map(idFromString) },
      answeredAt: { gte: from, lt: to },
      isTest: false,
    })
    return {
      byPupil: async (ids, from, to) => {
        const rows = await db().practiceAnswer.groupBy({ by: ['userId', 'isCorrect'], where: where(ids, from, to), _count: { _all: true } })
        const out = new Map<string, Tally>()
        for (const r of rows) addTo(out, idToString(r.userId), r.isCorrect, r._count._all)
        return out
      },
      bySubject: async (ids, from, to) => {
        const rows = await db().practiceAnswer.groupBy({
          by: ['subjectId', 'isCorrect'],
          where: { ...where(ids, from, to), subjectId: { not: null } },
          _count: { _all: true },
        })
        const out = new Map<string, Tally>()
        for (const r of rows) if (r.subjectId !== null) addTo(out, idToString(r.subjectId), r.isCorrect, r._count._all)
        return out
      },
      pupilNames: async (ids) => {
        const rows = await db().user.findMany({ where: { id: { in: ids.map(idFromString) } }, select: { id: true, name: true } })
        return new Map(rows.map((r) => [idToString(r.id), r.name]))
      },
      subjectNames: async (ids) => {
        const rows = await db().subject.findMany({ where: { id: { in: ids.map(idFromString) } }, select: { id: true, name: true } })
        return new Map(rows.map((r) => [idToString(r.id), r.name]))
      },
    }
  }
}
