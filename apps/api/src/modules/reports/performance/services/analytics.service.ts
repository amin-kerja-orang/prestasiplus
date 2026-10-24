import { Inject, Injectable } from '@nestjs/common'

import { ApiError } from '../../../../common/errors/api-error'
import { CLOCK, type Clock } from '../../../../db/clock'
import { CLASS_ANALYSIS_ROLES, canOpenClassAnalysis } from '../domain/access-policy'
import { COUNTED_MODES } from '../domain/constants'
import { addFact, emptyFigures, figuresOf } from '../domain/reduce'
import { accuracyOf, compareIds, parseRiskLevel, projection, riskOfAccuracy, round, trendOf, type Trend } from '../domain/rules'
import { inWindow, trendWindows } from '../domain/windows'
import { DIRECTORY_PORT, PerformancePorts, type BijakSittingFact, type ClassInfo, type DirectoryPort } from '../ports'
import { groupBy, nameMap } from './support'
import type { Ctx, PerformanceAnalytics, PerformanceClassAnalytics, PerformanceClassAnalyticsQuery } from './types'

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
    const subjects = [...groupBy(facts, (f) => f.subjectId)]
      .sort(([a], [b]) => compareIds(a, b))
      .map(([subjectId, list]) => {
        const f = figuresOf(list)
        const accuracy = accuracyOf(f.gradedScore, f.gradedMax)
        const first = list[0] as BijakSittingFact
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
    if (!CLASS_ANALYSIS_ROLES.includes(ctx.role)) throw ApiError.of('FORBIDDEN')
    const riskLevel = parseRiskLevel(query.riskLevel)
    const own =
      ctx.role === 'teacher'
        ? (await this.ports.classes.classesForTeacher(ctx.userId)).filter((c) => c.kind === 'classroom' && c.isActive)
        : []
    const classes = own.map((c) => ({ id: c.id, name: c.name }))

    let cls: ClassInfo | null = null
    if (query.classroomId !== undefined) {
      // Unknown and not-openable give the same 403, so class ids cannot be enumerated.
      cls = await this.ports.classes.classById(query.classroomId)
      if (!cls || !canOpenClassAnalysis(ctx, cls)) throw ApiError.of('FORBIDDEN')
    } else if (ctx.role === 'teacher') {
      cls = own[0] ?? null
    }
    if (!cls) {
      return { options: { classes, subjects: [], selected: { classroomId: null, subjectId: null, riskLevel } }, summary: null, rows: [] }
    }

    const members = await this.ports.classes.memberIds(cls.id)
    const facts = members.length === 0 ? [] : await this.ports.bijak.sittings({ userIds: members, modes: COUNTED_MODES.analytics })
    // A sitting stores the Bijak subject CODE; a class stores the curriculum subject id. Group by the curriculum id so
    // the options and the class subject agree (a code with no curriculum subject keeps the sitting's own id).
    const codes = [...new Set(facts.map((f) => f.subjectCode))]
    const idOfCode = await this.directory.subjectIdsOfCodes(codes)
    const bySubject = groupBy(facts, (f) => idOfCode.get(f.subjectCode) ?? f.subjectId)
    const subjectIds = [...bySubject.keys()].sort(compareIds)
    if (cls.subjectId !== null) {
      const i = subjectIds.indexOf(cls.subjectId)
      if (i >= 0) subjectIds.splice(i, 1)
      subjectIds.unshift(cls.subjectId)
    }
    const subjectName = (id: string): string =>
      bySubject.get(id)?.[0]?.subjectName ?? (id === cls.subjectId ? (cls.subjectName ?? '') : '')
    const subjects = subjectIds.map((id) => ({ id, name: subjectName(id) }))
    const subjectId = query.subjectId ?? subjects[0]?.id ?? null

    const names = await nameMap(this.directory, members)
    const now = this.clock.now()
    const byUser = groupBy(subjectId === null ? [] : (bySubject.get(subjectId) ?? []), (f) => f.userId)
    const rows = members.flatMap((userId) => {
      const list = byUser.get(userId) ?? []
      const f = list.reduce((acc, s) => addFact(acc, s), emptyFigures())
      if (f.gradedMax === 0) return []
      const accuracy = accuracyOf(f.gradedScore, f.gradedMax)
      return [
        {
          userId,
          name: names.get(userId) ?? '',
          accuracy,
          answered: f.answered,
          trend: trendOfFacts(list, now),
          projection: projection(accuracy),
          riskLevel: riskOfAccuracy(accuracy),
        },
      ]
    })
    const shown = rows.filter((r) => riskLevel === '' || r.riskLevel === riskLevel)
    const summary =
      shown.length === 0
        ? null
        : {
            students: shown.length,
            accuracy: round(shown.reduce((a, r) => a + r.accuracy, 0) / shown.length, 1),
            atRisk: shown.filter((r) => r.riskLevel === 'critical' || r.riskLevel === 'high').length,
            good: shown.filter((r) => r.riskLevel === 'low').length,
          }
    return { options: { classes, subjects, selected: { classroomId: cls.id, subjectId, riskLevel } }, summary, rows: shown }
  }
}
