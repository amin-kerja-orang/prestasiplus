import { Inject, Injectable } from '@nestjs/common'

import { ApiError } from '../../../../common/errors/api-error'
import { CLOCK, type Clock } from '../../../../db/clock'
import { ANALYTICS_CLASS_ROLES, canOpenClassAnalysis, viewerSchoolId } from '../domain/access-policy'
import { ANALYTICS_TREND_DAYS, COUNTED_MODES, isLegacySubject } from '../domain/constants'
import { figuresOf } from '../domain/reduce'
import { accuracyOf, analyticsTrendOf, compareIds, parseRiskLevel, projection, riskOfWholePercent, trendOf, type ClassRiskLevel, type Trend } from '../domain/rules'
import { inWindow, startOfDaysAgo, trendWindows } from '../domain/windows'
import { startOfMytDay } from '../../../../db/clock'
import { DIRECTORY_PORT, PerformancePorts, type AnswerFactRow, type BijakSittingFact, type ClassInfo, type DirectoryPort } from '../ports'
import { groupBy } from './support'
import type { Ctx, PerformanceAnalytics, PerformanceClassAnalytics, PerformanceClassAnalyticsQuery } from './types'


/** Tingkatan number of a level slug ('t4' = 4, 'tingkatan-5' = 5); unknown sorts last. */
const levelNumber = (slug: string): number => {
  const n = Number(/(\d+)/.exec(slug)?.[1])
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER
}
const byLevelThenName = (a: ClassInfo, b: ClassInfo): number => levelNumber(a.levelSlug) - levelNumber(b.levelSlug) || a.name.localeCompare(b.name, 'ms', { numeric: true })

/** Trend of one pupil in one subject from graded sittings (provisional ones never count). */
function trendOfFacts(facts: readonly BijakSittingFact[], now: Date): Trend {
  const w = trendWindows(now)
  const recent = { score: 0, max: 0 }
  const before = { score: 0, max: 0 }
  for (const s of facts) {
    if (s.provisional) continue
    const bucket = inWindow(s.submittedAt, w.recentFrom, w.recentTo)
      ? recent
      : inWindow(s.submittedAt, w.beforeFrom, w.recentFrom)
        ? before
        : null
    if (!bucket) continue
    bucket.score += s.score
    bucket.max += s.maxScore
  }
  return trendOf(recent, before)
}

/** Analitik (S7, S8). /analytics/me and /analytics/classes. 403 when the class is unknown or not openable (same status for both). */
@Injectable()
export class AnalyticsService {
  constructor(
    protected readonly ports: PerformancePorts,
    @Inject(DIRECTORY_PORT) protected readonly directory: DirectoryPort,
    @Inject(CLOCK) protected readonly clock: Clock,
  ) {}

  async me(ctx: Ctx): Promise<PerformanceAnalytics> {
    const facts = await this.ports.bijak.sittings({ userIds: [ctx.userId], modes: COUNTED_MODES.analytics })
    const now = this.clock.now()
    // A sitting stores the Bijak subject CODE; the curriculum knows the subject by id. Group by the curriculum id (as
    // classes() does) so one subject is one row; a code with no curriculum subject keeps the sitting's own id (SW13-08).
    // Migrated 'legacy' sittings have no subject: they are not a tab here (they stay in every overall figure elsewhere).
    const named = facts.filter((f) => !isLegacySubject(f))
    const idOfCode = await this.directory.subjectIdsOfCodes([...new Set(named.map((f) => f.subjectCode))])
    const subjects = [...groupBy(named, (f) => idOfCode.get(f.subjectCode) ?? f.subjectId)]
      .sort(([a], [b]) => compareIds(a, b))
      .map(([subjectId, list]) => {
        const f = figuresOf(list)
        const accuracy = accuracyOf(f.gradedScore, f.gradedMax)
        // Name and code come from a sitting already stored under the curriculum id when there is one, else the first.
        const first = (list.find((x) => x.subjectId === subjectId) ?? list[0]) as BijakSittingFact
        return {
          subjectId,
          name: first.subjectName,
          code: first.subjectCode,
          accuracy,
          answered: f.answered,
          trend: trendOfFacts(list, now),
          projection: projection(accuracy),
          counts: { mahir: 0, sederhana: 0, lemah: 0, belum: 0 },
          ringTotal: 0,
          weak: [],
          map: { caption: '', tiles: [] },
        }
      })
    const me = (await this.directory.users([ctx.userId])).get(ctx.userId)
    return { userLevelId: me?.levelId ?? null, topWeak: [], subjects }
  }

  async classes(ctx: Ctx, query: PerformanceClassAnalyticsQuery): Promise<PerformanceClassAnalytics> {
    if (!ANALYTICS_CLASS_ROLES.includes(ctx.role)) throw ApiError.of('FORBIDDEN')
    const riskLevel = parseRiskLevel(query.riskLevel)
    const isSchoolAdmin = ctx.role === 'school_admin'
    // A school admin picks among the active classrooms of the own school only (S10-T04 Change (2)).
    const school = isSchoolAdmin ? viewerSchoolId(ctx) : null
    const own =
      ctx.role === 'teacher'
        ? (await this.ports.classes.classesForTeacher(ctx.userId)).filter((c) => c.kind === 'classroom' && c.isActive)
        : school !== null
          ? (await this.ports.classes.classesOfSchool(school)).filter((c) => c.kind === 'classroom' && c.isActive)
          : []
    // School admin: Tingkatan then name (R1-AS-5); a teacher keeps the own order.
    if (isSchoolAdmin) own.sort(byLevelThenName)
    const classes = own.map((c) => ({ id: c.id, name: c.name }))
    const subjects = await this.directory.activeSubjects()

    // "Semua Kelas" (no classroomId): every active classroom of the teacher / of the school. A named class must be openable.
    let scope: ClassInfo[] = own
    if (query.classroomId !== undefined) {
      // Unknown and not-openable give the same 403, so class ids cannot be enumerated.
      const cls = await this.ports.classes.classById(query.classroomId)
      if (!cls || !canOpenClassAnalysis(ctx, cls)) throw ApiError.of('FORBIDDEN')
      scope = [cls]
    }
    const selected = { classroomId: query.classroomId ?? null, subjectId: query.subjectId ?? null, riskLevel }

    // Roster: active pupils enrolled in the scope classes, each once; pupils with no answers are part of it.
    const membersByClass = scope.length === 0 ? new Map<string, string[]>() : await this.ports.classes.membersOf(scope.map((c) => c.id))
    const classNamesOf = new Map<string, string[]>()
    for (const c of scope) {
      for (const id of membersByClass.get(c.id) ?? []) classNamesOf.set(id, [...(classNamesOf.get(id) ?? []), c.name])
    }
    const users = classNamesOf.size === 0 ? new Map() : await this.directory.users([...classNamesOf.keys()])
    const roster = [...classNamesOf.keys()].filter((id) => {
      const u = users.get(id)
      return u !== undefined && u.isActive && u.isStudent
    })
    if (roster.length === 0) return { options: { classes, subjects, selected }, summary: null, rows: [] }

    // Three set-based reads of the one answer store: all time, this week, the week before (all modes, test rows never count).
    const now = this.clock.now()
    const recentFrom = startOfDaysAgo(now, ANALYTICS_TREND_DAYS - 1)
    const beforeFrom = startOfDaysAgo(now, 2 * ANALYTICS_TREND_DAYS - 1)
    const scopeQuery = { userIds: roster, ...(query.subjectId !== undefined ? { subjectId: query.subjectId } : {}) }
    const [allTime, recent, before] = await Promise.all([
      this.ports.answerFacts.answerFacts(scopeQuery),
      this.ports.answerFacts.answerFacts({ ...scopeQuery, from: recentFrom, to: new Date(startOfMytDay(now).getTime() + 86_400_000) }),
      this.ports.answerFacts.answerFacts({ ...scopeQuery, from: beforeFrom, to: recentFrom }),
    ])
    const totals = (rows: readonly AnswerFactRow[]): Map<string, { correct: number; attempts: number }> => {
      const m = new Map<string, { correct: number; attempts: number }>()
      for (const r of rows) {
        const t = m.get(r.userId) ?? { correct: 0, attempts: 0 }
        t.correct += r.correct
        t.attempts += r.attempts
        m.set(r.userId, t)
      }
      return m
    }
    const all = totals(allTime)
    const recentBy = totals(recent)
    const beforeBy = totals(before)
    const none = { correct: 0, attempts: 0 }

    const everyone = roster.map((userId) => {
      const t = all.get(userId) ?? none
      const hasAnswers = t.attempts > 0
      const accuracy = hasAnswers ? accuracyOf(t.correct, t.attempts) : null
      return {
        userId,
        name: users.get(userId)?.name ?? '',
        accuracy,
        correct: t.correct,
        answered: t.attempts,
        trend: hasAnswers ? analyticsTrendOf(recentBy.get(userId) ?? none, beforeBy.get(userId) ?? none) : ('stable' as const),
        projection: accuracy === null ? null : projection(accuracy),
        riskLevel: (accuracy === null ? 'none' : riskOfWholePercent(accuracy)) as ClassRiskLevel,
        classes: isSchoolAdmin ? (classNamesOf.get(userId) ?? []) : [],
      }
    })
    // Accuracy ascending, then name; Belum Bermula last (also by name).
    everyone.sort((a, b) => {
      if ((a.accuracy === null) !== (b.accuracy === null)) return a.accuracy === null ? 1 : -1
      return (a.accuracy ?? 0) - (b.accuracy ?? 0) || a.name.localeCompare(b.name, 'ms') || compareIds(a.userId, b.userId)
    })
    const shown = everyone.filter((r) => riskLevel === '' || r.riskLevel === riskLevel)
    if (shown.length === 0) return { options: { classes, subjects, selected }, summary: null, rows: [] }

    // Pooled over the pupils with answers (XS-5); Belum Bermula pupils are in Jumlah Pelajar only.
    const answered = shown.filter((r) => r.accuracy !== null)
    const sumCorrect = answered.reduce((a, r) => a + r.correct, 0)
    const sumAnswered = answered.reduce((a, r) => a + r.answered, 0)
    const summary = {
      students: shown.length,
      accuracy: sumAnswered === 0 ? null : accuracyOf(sumCorrect, sumAnswered),
      atRisk: shown.filter((r) => r.riskLevel === 'critical' || r.riskLevel === 'high').length,
      good: shown.filter((r) => r.riskLevel === 'low').length,
    }
    const rows = shown.map((r) => ({
      userId: r.userId,
      name: r.name,
      accuracy: r.accuracy,
      answered: r.answered,
      trend: r.trend,
      projection: r.projection,
      riskLevel: r.riskLevel,
      classes: r.classes,
    }))
    return { options: { classes, subjects, selected }, summary, rows }
  }
}
