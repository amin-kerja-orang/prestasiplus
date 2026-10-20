import { Inject, Injectable } from '@nestjs/common'
import { CLOCK, type Clock, mytDay } from '../../../../db/clock'
import { ClassesRepository } from '../../../classes'
import {
  type Population,
  type SchoolAgg,
  bandsOf,
  compareIds,
  monthOf,
  monthsOf,
  populationOf,
  schoolsOf,
  studentsOf,
  subjectsOf,
  totalsOf,
} from '../domain/aggregate'
import {
  CORRELATION_BANDS,
  CORRELATION_R,
  HEAT_FIRST_HOUR,
  HEAT_HOURS,
  fmt1,
  gradeOfAccuracyTenths,
  mean1,
  pct1,
  pctTenths,
  round1,
  statusOfAccuracy,
  strengthOfR,
  tahapOfScore,
} from '../domain/rules'
import { type Cell, type FeedbackAggregateRow, KirkpatrickRepository } from '../kirkpatrick.repository'
import type {
  KirkpatrickBehavior,
  KirkpatrickChain,
  KirkpatrickFilterOptions,
  KirkpatrickLearning,
  KirkpatrickOverview,
  KirkpatrickReaction,
  KirkpatrickResults,
} from '../types'
import { type Ctx, type Scope, type ScopeQuery, isSchoolForced, platformScope, resolveScope } from './scope'

const MONTHS_MS = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember']

const splitMonth = (month: string): [number, number] => {
  const [y, m] = month.split('-').map(Number)
  return [y as number, m as number]
}
const monthLabel = (month: string): string => {
  const [y, m] = splitMonth(month)
  return `${MONTHS_MS[m - 1] ?? ''} ${String(y)}`
}
const lastDayOf = (month: string): string => {
  const [y, m] = splitMonth(month)
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
}

interface Feedback {
  responses: number
  satisfaction: number
  nps: number
  npsStudent: number
  npsTeacher: number
  npsAdmin: number
}

/** BR-M12-32: means over the non-test responses; the NPS means leave out rows without an NPS (migrated rows). */
export function feedbackOf(rows: readonly FeedbackAggregateRow[]): Feedback {
  const sum = (pick: (r: FeedbackAggregateRow) => number, role?: string): number =>
    rows.filter((r) => role === undefined || r.role === role).reduce((s, r) => s + pick(r), 0)
  const npsMean = (role?: string): number => mean1(sum((r) => r.npsSum, role), sum((r) => r.npsCount, role))
  const responses = sum((r) => r.responses)
  return {
    responses,
    satisfaction: mean1(sum((r) => r.satSum), responses),
    nps: npsMean(),
    npsStudent: npsMean('student'),
    npsTeacher: npsMean('teacher'),
    npsAdmin: npsMean('admin'),
  }
}

/** The figures of one scope, read once per request. */
interface Stats {
  scope: Scope
  pop: Population
  cells: Cell[]
  totals: ReturnType<typeof totalsOf>
  students: ReturnType<typeof studentsOf>
  accuracy: number
}

@Injectable()
export class LevelsService {
  constructor(
    @Inject(KirkpatrickRepository) private readonly repo: KirkpatrickRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ClassesRepository) private readonly classes: ClassesRepository,
  ) {}

  private async statsOf(scope: Scope): Promise<Stats> {
    const [popRows, cells] = await Promise.all([this.repo.populations(scope.schoolIds), this.repo.cells(scope.schoolIds)])
    const totals = totalsOf(cells)
    return { scope, pop: populationOf(popRows), cells, totals, students: studentsOf(cells), accuracy: pct1(totals.correct, totals.answered) }
  }

  /** Feedback of the viewer's view: the platform for admin, the own school's respondents for the forced roles. */
  private async feedbackFor(ctx: Ctx): Promise<Feedback> {
    if (isSchoolForced(ctx.role)) {
      if (ctx.schoolId === null) return feedbackOf([])
      return feedbackOf(await this.repo.feedbackAggregates(ctx.schoolId))
    }
    return feedbackOf(await this.repo.feedbackAggregates(null))
  }

  private schoolName(names: Map<string, { name: string }>, id: string): string {
    return names.get(id)?.name ?? id
  }

  // --- #2 Reaction ----------------------------------------------------------------------------------------

  async reaction(ctx: Ctx): Promise<KirkpatrickReaction> {
    const a = await this.feedbackFor(ctx)
    return { npsStudent: a.npsStudent, npsTeacher: a.npsTeacher, npsAdmin: a.npsAdmin, satisfaction: a.satisfaction }
  }

  // --- #1 Overview ----------------------------------------------------------------------------------------

  private panelOf(cells: readonly Cell[], month: string, to: string): NonNullable<KirkpatrickOverview['comparison']['before']> {
    const agg = monthOf(cells, month)
    return {
      month,
      from: `${month}-01`,
      to,
      active: agg.students.length,
      accuracy: pct1(agg.correct, agg.answered),
      answers: agg.answered,
      champions: agg.students.filter((s) => s.answered >= 50).length,
    }
  }

  /** BR-M12-08: SEBELUM = the first month with an answer in scope, SELEPAS = the current month up to today. */
  private comparisonOf(cells: readonly Cell[], now: Date): KirkpatrickOverview['comparison'] {
    const first = monthsOf(cells)[0]
    if (first === undefined) {
      return { subtitle: 'Tiada Data vs Tiada Data', before: null, after: null, delta: null, sentences: ['Data tidak mencukupi untuk perbandingan.'] }
    }
    const today = mytDay(now)
    const current = today.slice(0, 7)
    const before = this.panelOf(cells, first, lastDayOf(first))
    const after = this.panelOf(cells, current, today)
    const delta = {
      active: after.active - before.active,
      accuracy: round1(after.accuracy - before.accuracy),
      answers: after.answers - before.answers,
      champions: after.champions - before.champions,
    }
    const text: string[] = []
    if (delta.accuracy > 0) text.push(`Peningkatan ${fmt1(delta.accuracy)}% dalam ketepatan jawapan.`)
    else if (delta.accuracy < 0) text.push(`Penurunan ${fmt1(Math.abs(delta.accuracy))}% dalam ketepatan jawapan.`)
    if (delta.active > 0) text.push(`${String(delta.active)} pelajar baru mula aktif.`)
    else if (delta.active < 0) text.push(`${String(Math.abs(delta.active))} pelajar kurang aktif berbanding sebelumnya.`)
    if (delta.answers > 0 && before.answers > 0) text.push(`Jumlah jawapan meningkat ${fmt1((delta.answers / before.answers) * 100)}%.`)
    if (delta.champions > 0) text.push(`${String(delta.champions)} pelajar naik ke tahap Champion.`)
    return { subtitle: `${monthLabel(first)} vs ${monthLabel(current)}`, before, after, delta, sentences: text }
  }

  async overview(ctx: Ctx, query: ScopeQuery): Promise<KirkpatrickOverview> {
    const scope = await resolveScope(this.repo, ctx, query, true)
    const [s, t1] = await Promise.all([this.statsOf(scope), this.feedbackFor(ctx)])
    return {
      scope: { schoolId: scope.schoolId, state: scope.state },
      // No SPM history table yet (BE-19 spm_history is not built): the zero state of the card.
      t4: { gps: null, gpsYear: null, recordsLabel: 0 },
      t3: { active: s.totals.activeStudents, t4t5: s.pop.t4t5, sessions: s.totals.sessions, accuracy: s.accuracy },
      t2: { accuracy: s.accuracy, answers: s.totals.answered },
      t1: { satisfaction: t1.satisfaction, responses: t1.responses },
      comparison: this.comparisonOf(s.cells, this.clock.now()),
      kpi: {
        t4t5: s.pop.t4t5,
        answers: s.totals.answered,
        teachersLoggedIn: s.pop.teachersLoggedIn,
        teachers: s.pop.teachers,
        accuracy: s.accuracy,
      },
      bands: bandsOf(s.pop.t4t5, s.students),
    }
  }

  // --- #3 Learning ----------------------------------------------------------------------------------------

  async learning(ctx: Ctx, query: ScopeQuery): Promise<KirkpatrickLearning> {
    const scope = await resolveScope(this.repo, ctx, query, false)
    const s = await this.statsOf(scope)
    const t = s.totals

    const subjectAggs = subjectsOf(s.cells).filter((x) => x.answered > 0)
    const subjectNames = await this.repo.subjectNames(subjectAggs.map((x) => x.subjectId))
    const subjects = subjectAggs
      .map((x) => ({
        subjectId: x.subjectId,
        name: subjectNames.get(x.subjectId) ?? `Subjek ${x.subjectId}`,
        answers: x.answered,
        correct: x.correct,
        accuracy: pctTenths(x.correct, x.answered) / 10,
      }))
      // Exact accuracy descending (cross-multiplied, not the rounded value), then the subject name A to Z.
      .sort((a, b) => b.correct * a.answers - a.correct * b.answers || a.name.localeCompare(b.name, 'ms'))
      .map((r) => ({ subjectId: r.subjectId, name: r.name, answers: r.answers, accuracy: r.accuracy, status: statusOfAccuracy(r.accuracy) }))

    const bySchool = new Map<string, SchoolAgg>(schoolsOf(s.cells).map((a) => [a.schoolId, a]))
    const schoolInfo = await this.repo.schools(s.pop.schools.map((p) => p.schoolId))
    const schools = s.pop.schools
      .map((p) => {
        const a = bySchool.get(p.schoolId)
        const tenths = a ? pctTenths(a.correct, a.answered) : 0
        return {
          schoolId: p.schoolId,
          name: this.schoolName(schoolInfo, p.schoolId),
          students: p.t4t5,
          answers: a?.answered ?? 0,
          accuracy: tenths / 10,
          avgScore: a ? mean1(a.scoreSum, a.scoredSessions) : 0,
          subjects: a?.subjects ?? 0,
          tenths,
        }
      })
      .sort((a, b) => b.tenths - a.tenths || compareIds(a.schoolId, b.schoolId))
      .map((r) => ({ schoolId: r.schoolId, name: r.name, students: r.students, answers: r.answers, accuracy: r.accuracy, avgScore: r.avgScore, subjects: r.subjects }))

    return {
      kpi: {
        answers: t.answered,
        accuracy: s.accuracy,
        avgScore: mean1(t.scoreSum, t.scoredSessions),
        // BR-M12-05: every counted session is completed, so the rate is 100 whenever there is a session.
        sessionsCompleted: t.sessions,
        sessions: t.sessions,
        completionPct: t.sessions > 0 ? 100 : 0,
      },
      subjects,
      schools,
    }
  }

  // --- #4 Behavior ----------------------------------------------------------------------------------------

  /** BR-M12-14: the three alert lists in the fixed order, each in school-id order. */
  private alertsOf(pop: Population, bySchool: Map<string, SchoolAgg>, names: Map<string, { name: string }>): KirkpatrickBehavior['alerts'] {
    const list1: KirkpatrickBehavior['alerts'] = []
    const list2: KirkpatrickBehavior['alerts'] = []
    const list3: KirkpatrickBehavior['alerts'] = []
    for (const p of pop.schools) {
      const name = this.schoolName(names, p.schoolId)
      const agg = bySchool.get(p.schoolId)
      if (p.never * 2 > p.t4t5) list1.push({ list: 1, schoolId: p.schoolId, name, kind: 'never', n: p.never })
      if (p.teachersLoggedIn >= 1 && (agg?.answered ?? 0) === 0) list2.push({ list: 2, schoolId: p.schoolId, name, kind: 'teacher', n: p.teachersLoggedIn })
      const active = agg?.activeStudents ?? 0
      if (active * 2 > p.t4t5) list3.push({ list: 3, schoolId: p.schoolId, name, kind: 'good', pct: pct1(active, p.t4t5) })
    }
    return [...list1, ...list2, ...list3]
  }

  async behavior(ctx: Ctx, query: ScopeQuery): Promise<KirkpatrickBehavior> {
    const scope = await resolveScope(this.repo, ctx, query, false)
    const [s, heatRows] = await Promise.all([this.statsOf(scope), this.repo.heat(scope.schoolIds)])
    const t = s.totals
    const bySchool = new Map<string, SchoolAgg>(schoolsOf(s.cells).map((a) => [a.schoolId, a]))
    const info = await this.repo.schools(s.pop.schools.map((p) => p.schoolId))

    const rows = s.pop.schools
      .map((p) => {
        const a = bySchool.get(p.schoolId)
        const active = a?.activeStudents ?? 0
        const answers = a?.answered ?? 0
        // Score: share of the school's T4/T5 pupils with an answer (the live formula is unobservable).
        const score = pct1(active, p.t4t5)
        const code = info.get(p.schoolId)?.code ?? null
        return {
          schoolId: p.schoolId,
          name: this.schoolName(info, p.schoolId),
          code: code === null || code === '' ? null : code,
          students: p.t4t5,
          active,
          answers,
          sessions: a?.sessions ?? 0,
          perActive: active > 0 ? mean1(answers, active) : 0,
          score,
          tahap: tahapOfScore(score),
        }
      })
      .sort((x, y) => y.score - x.score || compareIds(x.schoolId, y.schoolId))

    const cells: number[][] = Array.from({ length: 7 }, () => Array.from({ length: HEAT_HOURS }, () => 0))
    for (const h of heatRows) {
      const col = h.hour - HEAT_FIRST_HOUR
      if (h.dow >= 1 && h.dow <= 7 && col >= 0 && col < HEAT_HOURS) (cells[h.dow - 1] as number[])[col] = h.n
    }

    return {
      kpi: {
        t4t5: s.pop.t4t5,
        active: t.activeStudents,
        sessions: t.sessions,
        answers: t.answered,
        accuracy: s.accuracy,
        teacherPct: pct1(s.pop.teachersLoggedIn, s.pop.teachers),
        teachersLoggedIn: s.pop.teachersLoggedIn,
        teachers: s.pop.teachers,
      },
      bands: bandsOf(s.pop.t4t5, s.students),
      schools: rows,
      heat: { max: cells.reduce((m, r) => Math.max(m, ...r), 0), cells },
      alerts: this.alertsOf(s.pop, bySchool, info),
      moodCount: 0,
    }
  }

  // --- #5 Results -----------------------------------------------------------------------------------------

  async results(ctx: Ctx, query: ScopeQuery): Promise<KirkpatrickResults> {
    const scope = await resolveScope(this.repo, ctx, query, false)
    const s = await this.statsOf(scope)
    const t = s.totals
    const bySchool = new Map<string, SchoolAgg>(schoolsOf(s.cells).map((a) => [a.schoolId, a]))
    const info = await this.repo.schools(s.pop.schools.map((p) => p.schoolId))

    const schoolRows = s.pop.schools
      .map((p) => {
        const a = bySchool.get(p.schoolId)
        const active = a?.activeStudents ?? 0
        const score = pct1(active, p.t4t5)
        return {
          schoolId: p.schoolId,
          name: this.schoolName(info, p.schoolId),
          students: p.t4t5,
          active,
          accuracy: active > 0 && a ? pct1(a.correct, a.answered) : null,
          answers: active > 0 && a ? a.answered : null,
          engagement: active === 0 && (a?.sessions ?? 0) === 0 ? null : score,
          tahap: tahapOfScore(score),
          faded: active === 0,
          score,
        }
      })
      .sort((x, y) => y.score - x.score || compareIds(x.schoolId, y.schoolId))
      .map((r) => ({
        schoolId: r.schoolId,
        name: r.name,
        students: r.students,
        active: r.active,
        accuracy: r.accuracy,
        answers: r.answers,
        engagement: r.engagement,
        tahap: r.tahap,
        faded: r.faded,
      }))

    // BR-M12-21: every pupil with an answer, accuracy descending, then the user id ascending.
    // Pupils are listed by name: a teacher gets only the pupils of the own active classes (data minimisation).
    const own = ctx.role === 'teacher' ? new Set(await this.classes.teacherStudentIds(ctx.userId)) : null
    const active = s.students.filter((x) => x.answered >= 1 && (own === null || own.has(x.userId)))
    const names = await this.repo.userNames(active.map((x) => x.userId))
    const schoolNames = await this.repo.schools([...new Set(active.map((x) => x.schoolId))])
    const predictions = active
      .map((x) => {
        const tenths = pctTenths(x.correct, x.answered)
        return {
          userId: x.userId,
          name: names.get(x.userId) ?? `Pelajar ${x.userId}`,
          schoolId: x.schoolId,
          schoolName: this.schoolName(schoolNames, x.schoolId),
          answers: x.answered,
          accuracy: tenths / 10,
          grade: gradeOfAccuracyTenths(tenths),
          tenths,
        }
      })
      .sort((a, b) => b.tenths - a.tenths || compareIds(a.userId, b.userId))
      .map((r) => ({
        userId: r.userId,
        name: r.name,
        schoolId: r.schoolId,
        schoolName: r.schoolName,
        answers: r.answers,
        accuracy: r.accuracy,
        grade: r.grade,
      }))

    const accuracy = s.accuracy
    return {
      kpi: {
        // No SPM history or headcount table yet: the zero state of the GPS cards (mock: a scope without a history row).
        gps: null,
        gpsYear: null,
        recordsLabel: 0,
        passPct: 0,
        pass: 0,
        candidates: 0,
        gradeA: 0,
        gradeAPct: 0,
        accuracy,
        answers: t.answered,
        active: t.activeStudents,
        activePct: pct1(t.activeStudents, s.pop.t4t5),
        t4t5: s.pop.t4t5,
        records: 0,
      },
      distribution: null,
      subjectGps: { year: 0, rows: [] },
      trend: { years: [], rows: [] },
      schools: schoolRows,
      predictions,
      // ALESA predictions are M13 (AI): no adapter yet, so an empty block.
      alesa: { lulus: 0, gagal: 0, intervensi: 0, rows: [] },
      roi: { active: t.activeStudents, perStudent: t.activeStudents > 0 ? mean1(t.answered, t.activeStudents) : 0, accuracy, gps: null },
      insights: {
        active: t.activeStudents,
        t4t5: s.pop.t4t5,
        pct: pct1(t.activeStudents, s.pop.t4t5),
        accuracy,
        grade: gradeOfAccuracyTenths(pctTenths(t.correct, t.answered)),
        year: null,
        gps: null,
      },
    }
  }

  // --- #6 Chain -------------------------------------------------------------------------------------------

  async chain(ctx: Ctx): Promise<KirkpatrickChain> {
    const s = await this.statsOf(platformScope(ctx))
    const t1 = await this.feedbackFor(ctx)
    return {
      t1: { nps: t1.nps, satisfaction: t1.satisfaction, responses: t1.responses },
      t2: { accuracy: s.accuracy, answers: s.totals.answered, avgScore: mean1(s.totals.scoreSum, s.totals.scoredSessions) },
      t3: {
        active: s.totals.activeStudents,
        t4t5: s.pop.t4t5,
        pct: pct1(s.totals.activeStudents, s.pop.t4t5),
        sessions: s.totals.sessions,
        bands: bandsOf(s.pop.t4t5, s.students),
      },
      t4: { gps: null, r: CORRELATION_R, strength: strengthOfR(CORRELATION_R) },
      correlation: { bands: CORRELATION_BANDS.map((b) => ({ ...b })), r: CORRELATION_R },
    }
  }

  // --- #14 Filter options -----------------------------------------------------------------------------------

  /** The S1 / S4 selects: schools with at least one user, A to Z, and their states. school_admin sees the own school only. */
  async filterOptions(ctx: Ctx): Promise<KirkpatrickFilterOptions> {
    if (ctx.role === 'school_admin' && ctx.schoolId === null) return { schools: [], states: [] }
    const rows = await this.repo.schoolsWithUsers(ctx.role === 'school_admin' ? ctx.schoolId : null)
    const states = [...new Set(rows.map((r) => r.state).filter((x): x is string => x !== null && x !== ''))].sort((a, b) => a.localeCompare(b, 'ms'))
    return { schools: rows.map((r) => ({ id: r.id, name: r.name })), states }
  }
}
