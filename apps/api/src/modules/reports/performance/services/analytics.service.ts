import { Inject, Injectable } from '@nestjs/common'

import { ApiError } from '../../../../common/errors/api-error'
import { CLOCK, type Clock } from '../../../../db/clock'
import { ANALYTICS_CLASS_ROLES, canOpenClassAnalysis, viewerSchoolId } from '../domain/access-policy'
import { ANALYTICS_TREND_DAYS, TOP_WEAK_SP_LIMIT } from '../domain/constants'
import { accuracyOf, analyticsTrendOf, compareIds, parseRiskLevel, pct, projection, riskOfWholePercent, spBandOfPercent, trendOf, type ClassRiskLevel } from '../domain/rules'
import { startOfDaysAgo, trendWindows } from '../domain/windows'
import { startOfMytDay } from '../../../../db/clock'
import { DIRECTORY_PORT, PUPIL_ROSTER_PORT, PerformancePorts, type AnswerFactRow, type ClassInfo, type DirectoryPort, type PupilRosterPort } from '../ports'
import { groupBy } from './support'
import type { Ctx, PerformanceAnalytics, PerformanceClassAnalytics, PerformanceClassAnalyticsQuery } from './types'


/** Tingkatan number of a level slug ('t4' = 4, 'tingkatan-5' = 5); unknown sorts last. */
const levelNumber = (slug: string): number => {
  const n = Number(/(\d+)/.exec(slug)?.[1])
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER
}
const byLevelThenName = (a: ClassInfo, b: ClassInfo): number => levelNumber(a.levelSlug) - levelNumber(b.levelSlug) || a.name.localeCompare(b.name, 'ms', { numeric: true })

/** Analitik (S7, S8). /analytics/me and /analytics/classes. 403 when the class is unknown or not openable (same status for both). */
@Injectable()
export class AnalyticsService {
  constructor(
    protected readonly ports: PerformancePorts,
    @Inject(DIRECTORY_PORT) protected readonly directory: DirectoryPort,
    @Inject(CLOCK) protected readonly clock: Clock,
    @Inject(PUPIL_ROSTER_PORT) protected readonly roster: PupilRosterPort,
  ) {}

  /**
   * Analitik Adaptif of the pupil (R1-MUR-5). Own data only. A tab per subject that has an SP map at the pupil's level
   * (FR-MUR-5-2); an SP's band is the pooled accuracy of the pupil's answers (all modes, one answer reader) to the
   * questions tagged to that SP (FR-MUR-5-3). A question with no SP tag (a Bab-only question) is in no tile and no
   * band count (AC-MUR-DK-3); its answers still count in the subject's own Ketepatan and Soalan Dijawab.
   * One statement per port read, never a loop per subject: three answer reads (all time and the two trend windows),
   * one tree read and one tag read.
   */
  async me(ctx: Ctx): Promise<PerformanceAnalytics> {
    const now = this.clock.now()
    const me = (await this.directory.users([ctx.userId])).get(ctx.userId)
    const levelId = me?.levelId ?? null
    const tree = await this.ports.spMap.spTree({ levelId })
    if (tree.length === 0) return { userLevelId: levelId, topWeak: [], subjects: [] }

    const w = trendWindows(now)
    const query = { userIds: [ctx.userId] }
    const [rows, recentRows, beforeRows] = await Promise.all([
      this.ports.answerFacts.answerFacts(query),
      this.ports.answerFacts.answerFacts({ ...query, from: w.recentFrom, to: w.recentTo }),
      this.ports.answerFacts.answerFacts({ ...query, from: w.beforeFrom, to: w.recentFrom }),
    ])
    const questionIds = [...new Set(rows.map((r) => r.questionId).filter((q) => q !== '0'))]
    const tags = questionIds.length > 0 ? await this.ports.spMap.spOf(questionIds) : []

    // Pooled attempts and correct per SP node; a question tagged to two SPs counts in both.
    const spsOfQuestion = groupBy(tags, (t) => t.questionId)
    const perSp = new Map<string, { attempts: number; correct: number }>()
    for (const r of rows) {
      for (const t of spsOfQuestion.get(r.questionId) ?? []) {
        const cell = perSp.get(t.spNodeId) ?? { attempts: 0, correct: 0 }
        cell.attempts += r.attempts
        cell.correct += r.correct
        perSp.set(t.spNodeId, cell)
      }
    }
    const pool = (list: readonly AnswerFactRow[]): Map<string, { attempts: number; correct: number }> => {
      const out = new Map<string, { attempts: number; correct: number }>()
      for (const r of list) {
        const cell = out.get(r.subjectId) ?? { attempts: 0, correct: 0 }
        cell.attempts += r.attempts
        cell.correct += r.correct
        out.set(r.subjectId, cell)
      }
      return out
    }
    const bySubject = pool(rows)
    const recentBy = pool(recentRows)
    const beforeBy = pool(beforeRows)

    const subjects = tree.map((subject) => {
      const total = bySubject.get(subject.subjectId) ?? { attempts: 0, correct: 0 }
      const accuracy = total.attempts === 0 ? null : accuracyOf(total.correct, total.attempts)
      const recent = recentBy.get(subject.subjectId) ?? { attempts: 0, correct: 0 }
      const before = beforeBy.get(subject.subjectId) ?? { attempts: 0, correct: 0 }
      const nodes = [...subject.nodes].sort((a, b) => a.sortOrder - b.sortOrder)
      const counts = { mahir: 0, sederhana: 0, lemah: 0, belum: 0 }
      const tiles = nodes.map((n) => {
        const cell = perSp.get(n.spNodeId)
        const status: 'mahir' | 'sederhana' | 'lemah' | 'belum' =
          cell === undefined || cell.attempts === 0 ? 'belum' : spBandOfPercent(pct(cell.correct, cell.attempts))
        counts[status] += 1
        return { spId: n.spNodeId, code: n.code, title: n.title, status, strand: n.strand }
      })
      const weak = nodes
        .flatMap((n) => {
          const cell = perSp.get(n.spNodeId)
          if (cell === undefined || cell.attempts === 0 || spBandOfPercent(pct(cell.correct, cell.attempts)) !== 'lemah') return []
          return [
            {
              spId: n.spNodeId,
              code: n.code,
              title: n.title,
              subjectName: subject.subjectName,
              subjectCode: subject.subjectCode,
              answered: cell.attempts,
              accuracy: accuracyOf(cell.correct, cell.attempts),
              // The servable count behind "Latihan Fokus ({n} soalan)" is S5-T03's: 0 means no link, never an invented number.
              available: 0,
              focusCount: 0,
            },
          ]
        })
        .sort((a, b) => a.accuracy - b.accuracy)
      return {
        subjectId: subject.subjectId,
        name: subject.subjectName,
        code: subject.subjectCode,
        accuracy,
        answered: total.attempts,
        trend: trendOf({ score: recent.correct, max: recent.attempts }, { score: before.correct, max: before.attempts }),
        projection: accuracy === null ? null : projection(accuracy),
        counts,
        ringTotal: tiles.length,
        weak,
        map: { caption: `Peta DSKP — Standard Pembelajaran · ${subject.subjectName}`, tiles },
      }
    })
    const topWeak = subjects
      .flatMap((s) => s.weak)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, TOP_WEAK_SP_LIMIT)
    return { userLevelId: levelId, topWeak, subjects }
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

    // Roster: the XS-1 pupils (active, not suspended, Tingkatan 1-5; S6-T03 `XsQueries.pupils`) of the viewer's scope, intersected with
    // the members of the scope classes, each once; pupils with no answers are part of it.
    const membersByClass = scope.length === 0 ? new Map<string, string[]>() : await this.ports.classes.membersOf(scope.map((c) => c.id))
    const classNamesOf = new Map<string, string[]>()
    for (const c of scope) {
      for (const id of membersByClass.get(c.id) ?? []) classNamesOf.set(id, [...(classNamesOf.get(id) ?? []), c.name])
    }
    const xsPupils = new Set<string>()
    if (classNamesOf.size > 0) {
      const scopes = ctx.role === 'teacher' ? [{ kind: 'teacher' as const, teacherId: ctx.userId }] : [...new Set(scope.map((c) => c.schoolId))].map((schoolId) => ({ kind: 'school' as const, schoolId }))
      for (const s of scopes) for (const id of await this.roster.xsPupilIds(s)) xsPupils.add(id)
    }
    const users = classNamesOf.size === 0 ? new Map() : await this.directory.users([...classNamesOf.keys()])
    const roster = [...classNamesOf.keys()].filter((id) => xsPupils.has(id) && users.has(id))
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
      // The band is applied to the whole-number accuracy rounded half up from the UNROUNDED percentage (never from the 1-decimal one).
      const rawPercent = hasAnswers ? Math.min(pct(t.correct, t.attempts), 100) : null
      return {
        userId,
        name: users.get(userId)?.name ?? '',
        accuracy,
        correct: t.correct,
        answered: t.attempts,
        trend: hasAnswers ? analyticsTrendOf(recentBy.get(userId) ?? none, beforeBy.get(userId) ?? none) : ('stable' as const),
        projection: accuracy === null ? null : projection(accuracy),
        riskLevel: (rawPercent === null ? 'none' : riskOfWholePercent(rawPercent)) as ClassRiskLevel,
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
