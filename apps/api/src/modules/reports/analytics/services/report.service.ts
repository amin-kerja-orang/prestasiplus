import { Inject, Injectable } from '@nestjs/common'

import { CLOCK, type Clock } from '../../../../db/clock'
import { ClassesRepository } from '../../../classes'
import { AnalyticsRepository } from '../analytics.repository'
import { DAY_MS, byName, ddmm, dayKey, mytDayStart, percent, rangeOf, reportTypeOfMode, round1, type ReportType } from '../domain/rules'
import type { AdminLaporanView, StudentLite, TeacherReport } from '../types'
import type { Ctx } from './scope'
import { classOptions, ownClasses, populationOf } from './teacher-scope'

interface UserLite {
  id: string
  name: string
  email: string
  lastLoginAt: Date | null
}

const lite = (u: UserLite): StudentLite => ({ id: u.id, name: u.name, email: u.email, avatarUrl: null, neverLoggedIn: u.lastLoginAt === null })

const TYPE_LABELS = { kuiz: 'Kuiz', struktur: 'Struktur', latihTubi: 'Latih Tubi', trackingA: 'Tracking A', battle: 'Battle Arena', permainan: 'Permainan' } as const

interface TallyRow {
  userId?: string
  mode: string
  day: string
  sessions: number
  correct: number
  questions: number
}

/**
 * The one aggregation of the Guru Laporan and the Admin Pusat Laporan (so their figures agree): sessions per activity type, correct and
 * asked questions per scored type, sessions per day and, when the rows carry a pupil, per pupil.
 */
function tally(rows: readonly TallyRow[]) {
  const byType = { kuiz: 0, struktur: 0, latihTubi: 0, trackingA: 0, battle: 0, permainan: 0 }
  const sums: Record<ReportType, { c: number; n: number }> = { kuiz: { c: 0, n: 0 }, latihTubi: { c: 0, n: 0 }, trackingA: { c: 0, n: 0 } }
  const perDay = new Map<string, number>()
  const perUser = new Map<string, number>()
  for (const r of rows) {
    const type = reportTypeOfMode(r.mode)
    byType[type] += r.sessions
    sums[type].c += r.correct
    sums[type].n += r.questions
    perDay.set(r.day, (perDay.get(r.day) ?? 0) + r.sessions)
    if (r.userId !== undefined) perUser.set(r.userId, (perUser.get(r.userId) ?? 0) + r.sessions)
  }
  return { byType, sums, perDay, perUser }
}

/**
 * S1 teacher report (SRS M11 section 6.4; BR-M11-01 to 07). Population: the distinct pupils actively enrolled in the
 * caller's own active classes (or the selected own class); the admin has no class and so an empty population.
 * Activities are the completed non-test practice sessions by `completed_at`; Struktur, Battle and Permainan have no
 * source in this build and stay 0 (see the deviations log).
 */
@Injectable()
export class ReportService {
  constructor(
    @Inject(AnalyticsRepository) private readonly repo: AnalyticsRepository,
    @Inject(ClassesRepository) private readonly classes: ClassesRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async report(ctx: Ctx, query: { range?: string | undefined; classroomId?: string | undefined }): Promise<TeacherReport> {
    const now = this.clock.now()
    const range = rangeOf(query.range)
    const own = await ownClasses(this.classes, ctx)
    const pop = await populationOf(this.classes, ctx, own, query.classroomId, true)
    const people = (await this.repo.studentsAmong(pop.ids)).sort(byName)
    const ids = people.map((u) => u.id)
    const today = mytDayStart(now.getTime())
    const from = today - (range - 1) * DAY_MS

    const rows = await this.repo.sessionsByDay(ids, new Date(from), now)
    const { byType, sums, perDay, perUser } = tally(rows)
    const rate = (c: number, n: number): number | null => (n > 0 ? Math.round(percent(c, n)) : null)
    const scoreC = sums.kuiz.c + sums.latihTubi.c + sums.trackingA.c
    const scoreN = sums.kuiz.n + sums.latihTubi.n + sums.trackingA.n

    const trend: TeacherReport['trend'] = []
    for (let d = range - 1; d >= 0; d--) {
      const day = today - d * DAY_MS
      trend.push({ date: ddmm(day), count: perDay.get(dayKey(day)) ?? 0 })
    }

    const practisedSet = await this.repo.practisedAmong(ids)
    const neverPractised = people.filter((u) => !practisedSet.has(u.id)).map(lite)
    return {
      range,
      classroomId: pop.classroom?.id ?? null,
      options: { classes: classOptions(own) },
      population: {
        total: people.length,
        loggedIn: people.filter((u) => u.lastLoginAt !== null).length,
        practised: people.filter((u) => practisedSet.has(u.id)).length,
      },
      activity: { total: Object.values(byType).reduce((a, b) => a + b, 0), byType },
      score: {
        overall: rate(scoreC, scoreN),
        byType: {
          kuiz: rate(sums.kuiz.c, sums.kuiz.n),
          struktur: null,
          latihTubi: rate(sums.latihTubi.c, sums.latihTubi.n),
          trackingA: rate(sums.trackingA.c, sums.trackingA.n),
          battle: null,
        },
      },
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

  /**
   * Admin Pusat Laporan (S6-T11, API-ADM-13): the same read model as `report` over every pupil of the platform. Tiles and breakdown
   * cover the range (default 30 days), the trend always the last 14 days; accuracy has one decimal. Pupil names are for the admin
   * only (the caller is `@Roles('admin')`) and are never logged.
   */
  async adminLaporan(query: { range?: string | undefined }): Promise<AdminLaporanView> {
    const now = this.clock.now()
    const range = rangeOf(query.range)
    const today = mytDayStart(now.getTime())
    const rangeFrom = today - (range - 1) * DAY_MS
    const trendFrom = today - 13 * DAY_MS
    const to = now

    const [people, teachers, schools, rows, top, bySchool] = await Promise.all([
      this.repo.pupilTotals(),
      this.repo.teachersBySchool(null),
      this.repo.schoolsWithUsers(null),
      this.repo.platformSessionsByDay(new Date(Math.min(rangeFrom, trendFrom)), to),
      this.repo.topPupilsBySessions(new Date(rangeFrom), to, 10),
      this.repo.sessionsBySchool(new Date(rangeFrom), to, 20),
    ])
    const rangeKey = dayKey(rangeFrom)
    const inRange = tally(rows.filter((r) => r.day >= rangeKey))
    const perDay = tally(rows).perDay

    const trend: AdminLaporanView['trend'] = []
    for (let d = 13; d >= 0; d--) {
      const day = today - d * DAY_MS
      trend.push({ date: ddmm(day), count: perDay.get(dayKey(day)) ?? 0 })
    }
    const scoreC = inRange.sums.kuiz.c + inRange.sums.latihTubi.c + inRange.sums.trackingA.c
    const scoreN = inRange.sums.kuiz.n + inRange.sums.latihTubi.n + inRange.sums.trackingA.n
    let teacherTotal = 0
    let teacherAccessed = 0
    for (const t of teachers.values()) {
      teacherTotal += t.n
      teacherAccessed += t.logged
    }
    return {
      range,
      tiles: {
        schools: schools.length,
        teachers: teacherTotal,
        pupils: people.pupils,
        pupilsAccessed: people.accessed,
        teachersAccessed: teacherAccessed,
        pupilsPractised: people.practised,
        activities: Object.values(inRange.byType).reduce((a, b) => a + b, 0),
        averageScore: scoreN > 0 ? round1(percent(scoreC, scoreN)) : null,
      },
      trend,
      breakdown: (['kuiz', 'struktur', 'latihTubi', 'trackingA', 'battle', 'permainan'] as const).map((type) => ({ type, label: TYPE_LABELS[type], count: inRange.byType[type] })),
      mostActive: top.map((p) => ({ id: p.id, name: p.name, school: p.schoolId === null ? null : { id: p.schoolId, name: p.schoolName ?? '' }, activities: p.sessions })),
      schoolActivity: bySchool.map((s) => ({ schoolId: s.schoolId, name: s.name, activities: s.sessions, activePupils: s.pupils })),
    }
  }
}
