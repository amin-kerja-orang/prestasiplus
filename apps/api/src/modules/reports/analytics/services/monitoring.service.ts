import { Inject, Injectable } from '@nestjs/common'

import { toMytTimestamp } from '../../../../common/time/myt'
import { CLOCK, type Clock } from '../../../../db/clock'
import { ApiError } from '../../../../common/errors/api-error'
import { ClassesRepository } from '../../../classes'
import { AnalyticsRepository, type SchoolFact } from '../analytics.repository'
import {
  type Period,
  byName,
  compareIds,
  levelLabelOf,
  percent,
  periodFromMs,
  periodOf,
  round1,
  statusOf,
  tahapOf,
  weeksUntil,
} from '../domain/rules'
import type {
  MonitoringExport,
  MonitoringOverview,
  SchoolDetail,
  SchoolEngagementRow,
  Signal,
  TeacherDetail,
  TeacherEngagementRow,
  WeeklyRow,
} from '../types'
import { type Ctx, isSchoolForced, scopeOf } from './scope'

export interface MonitoringFilters {
  period?: string | undefined
  state?: string | undefined
  tahap?: string | undefined
}

interface Universe {
  period: Period
  state: string
  tahap: string
  /** Student-table schools within the state / scope (registered at least 1), any tahap, table order. */
  rows: SchoolEngagementRow[]
  teacherRows: TeacherEngagementRow[]
  /** "Jumlah Sekolah": schools with at least one user of any role. */
  schools: number
  loggedBySchool: Map<string, number>
  answersBySchool: Map<string, number>
  scope: string[] | null
  /** A teacher's own-class pupils (the S3/S5 minimisation filter); null = no pupil filter. */
  pupilIds: string[] | null
}

const NOT_FOUND = (): never => {
  throw ApiError.of('NOT_FOUND')
}

/** The M11 monitoring read models (S2 to S5 and the export rows): computed per request, nothing stored but the flags. */
@Injectable()
export class MonitoringService {
  constructor(
    @Inject(AnalyticsRepository) private readonly repo: AnalyticsRepository,
    @Inject(ClassesRepository) private readonly classes: ClassesRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  // --- S2 ------------------------------------------------------------------------------------------------------

  private async universe(filters: MonitoringFilters, ctx: Ctx): Promise<Universe> {
    const now = this.clock.now()
    const scope = scopeOf(ctx)
    const period = periodOf(filters.period)
    const state = filters.state ?? ''
    const tahap = filters.tahap ?? ''
    const from = periodFromMs(period, now.getTime())
    const pupilIds = await this.ownPupilIds(ctx)
    const [facts, registered, teachers, engagement, withUsers] = await Promise.all([
      this.repo.schools(scope),
      this.repo.registeredBySchool(scope, pupilIds),
      this.repo.teachersBySchool(scope, this.ownTeacherIds(ctx)),
      this.repo.engagement(scope, from === null ? null : new Date(from), pupilIds),
      this.repo.schoolsWithUsers(scope),
    ])
    const factOf = new Map<string, SchoolFact>(facts.map((f) => [f.id, f]))
    const stateOk = (f: SchoolFact): boolean => state === '' || f.state === state

    // The raw (unrounded) percentage orders the table and picks the tahap; the row carries it rounded.
    const students: { row: SchoolEngagementRow; raw: number }[] = []
    for (const [schoolId, n] of registered) {
      const fact = factOf.get(schoolId)
      if (n <= 0 || !fact || !stateOk(fact)) continue
      const e = engagement.get(schoolId)?.engaged ?? 0
      const raw = percent(e, n)
      students.push({
        raw,
        row: { schoolId, name: fact.name, code: fact.code, state: fact.state, registered: n, engaged: e, pct: round1(raw), tahap: tahapOf(raw) },
      })
    }
    students.sort((a, b) => b.raw - a.raw || compareIds(a.row.schoolId, b.row.schoolId))

    const loggedBySchool = new Map<string, number>()
    const teacherRows: { row: TeacherEngagementRow; raw: number }[] = []
    for (const [schoolId, t] of teachers) {
      loggedBySchool.set(schoolId, t.logged)
      const fact = factOf.get(schoolId)
      if (t.n <= 0 || !fact || !stateOk(fact)) continue
      const raw = percent(t.logged, t.n)
      teacherRows.push({
        raw,
        row: { schoolId, name: fact.name, code: fact.code, state: fact.state, registered: t.n, loggedIn: t.logged, pct: round1(raw), tahap: tahapOf(raw) },
      })
    }
    teacherRows.sort((a, b) => b.raw - a.raw || compareIds(a.row.schoolId, b.row.schoolId))

    const schools = withUsers.filter((id) => {
      const f = factOf.get(id)
      return f !== undefined && stateOk(f)
    }).length
    return {
      period,
      state,
      tahap,
      rows: students.map((s) => s.row),
      teacherRows: teacherRows.map((t) => t.row),
      schools,
      loggedBySchool,
      answersBySchool: new Map([...engagement].map(([id, e]) => [id, e.answers])),
      scope,
      pupilIds,
    }
  }

  /** The student table with the `tahap` filter applied (BR-M11-14: tahap filters this table only). */
  private studentTable(u: Universe): SchoolEngagementRow[] {
    return u.tahap === '' ? u.rows : u.rows.filter((r) => r.tahap === u.tahap)
  }

  private signal(r: SchoolEngagementRow, kind: Signal['kind'], logged: Map<string, number>): Signal {
    return {
      schoolId: r.schoolId,
      name: r.name,
      kind,
      registered: r.registered,
      engaged: r.engaged,
      pct: r.pct,
      teachersLoggedIn: logged.get(r.schoolId) ?? 0,
    }
  }

  /** BR-M11-16 signals from the student table ignoring `tahap`. */
  private signals(u: Universe): MonitoringOverview['signals'] {
    const best: Signal[] = []
    const attention: Signal[] = []
    const suggestions: Signal[] = []
    for (const r of u.rows) {
      if (r.tahap === 'Cemerlang') {
        if (best.length < 3) best.push(this.signal(r, 'best', u.loggedBySchool))
        continue
      }
      if (r.tahap === 'Sederhana') continue
      const kind = r.tahap === 'Rendah' ? 'rendah' : r.tahap === 'Kritikal' ? 'kritikal' : 'tiada'
      const s = this.signal(r, kind, u.loggedBySchool)
      attention.push(s)
      if (r.tahap === 'Kritikal') suggestions.push({ ...s, kind: 'motivasi' })
      else if (r.tahap === 'Tiada Langsung') suggestions.push({ ...s, kind: s.teachersLoggedIn > 0 ? 'handsOn' : 'hubungi' })
    }
    return { best, attention, suggestions }
  }

  /** BR-M11-15 weekly tracking over the student-table schools (state filter only). */
  private async weekly(u: Universe, weeks: { k: number }[]): Promise<WeeklyRow[]> {
    const perSchool = await this.repo.answersByWeek(u.scope, u.pupilIds)
    const totals = u.period === '' ? u.answersBySchool : new Map([...(await this.repo.engagement(u.scope, null, u.pupilIds))].map(([id, e]) => [id, e.answers]))
    const ordered = [...u.rows].sort((a, b) => {
      const ta = totals.get(a.schoolId) ?? 0
      const tb = totals.get(b.schoolId) ?? 0
      if (ta > 0 !== tb > 0) return ta > 0 ? -1 : 1
      return tb - ta || compareIds(a.schoolId, b.schoolId)
    })
    return ordered.map((r) => {
      const weekMap = perSchool.get(r.schoolId)
      const counts = weeks.map((w) => weekMap?.get(w.k) ?? 0)
      let bestIdx = -1
      counts.forEach((c, i) => {
        if (c > 0 && (bestIdx < 0 || c > (counts[bestIdx] as number))) bestIdx = i
      })
      const cells = counts.map((count, i) => {
        const prev = i > 0 ? (counts[i - 1] as number) : null
        let cls: 'zero' | 'first' | 'up' | 'down'
        if (count === 0) cls = 'zero'
        else if (prev === null) cls = 'first'
        else if (count > prev) cls = 'up'
        else if (count < prev) cls = 'down'
        else cls = 'first'
        return { k: (weeks[i] as { k: number }).k, count, cls, best: i === bestIdx }
      })
      const last = counts[counts.length - 1] ?? 0
      const before = counts[counts.length - 2] ?? 0
      return {
        schoolId: r.schoolId,
        name: r.name,
        code: r.code,
        cells,
        trend: last > before ? 'up' : last < before ? 'down' : 'same',
        best: bestIdx >= 0 ? { k: (weeks[bestIdx] as { k: number }).k, count: counts[bestIdx] as number } : null,
      }
    })
  }

  async overview(ctx: Ctx, filters: MonitoringFilters): Promise<MonitoringOverview> {
    const u = await this.universe(filters, ctx)
    const students = u.rows.reduce((a, r) => a + r.registered, 0)
    const engaged = u.rows.reduce((a, r) => a + r.engaged, 0)
    const answered = u.rows.reduce((a, r) => a + (u.answersBySchool.get(r.schoolId) ?? 0), 0)
    const teachers = u.teacherRows.reduce((a, r) => a + r.registered, 0)
    const loggedIn = u.teacherRows.reduce((a, r) => a + r.loggedIn, 0)
    const weeks = weeksUntil(this.clock.now().getTime())
    return {
      filters: { period: u.period, state: u.state, tahap: u.tahap },
      kpi: {
        schools: u.schools,
        students,
        engaged,
        engagementPct: round1(percent(engaged, students)),
        answers: answered,
        avgPerStudent: engaged === 0 ? 0 : round1(answered / engaged),
        teachers,
        teachersLoggedIn: loggedIn,
        teacherPct: round1(percent(loggedIn, teachers)),
      },
      studentRows: this.studentTable(u),
      teacherRows: u.teacherRows,
      weeks,
      weekly: await this.weekly(u, weeks),
      signals: this.signals(u),
    }
  }

  /** The student table of the filters (the rows behind the PDF and CSV links); the client builds the file. */
  async exportRows(ctx: Ctx, format: 'pdf' | 'csv', filters: MonitoringFilters): Promise<MonitoringExport> {
    const u = await this.universe(filters, ctx)
    return { filename: `monitoring-penglibatan.${format}`, rows: this.studentTable(u) }
  }

  /** Data minimisation: a teacher sees the pupils of the own active classes only; other roles see the whole school. */
  private async ownPupilIds(ctx: Ctx): Promise<string[] | null> {
    return ctx.role === 'teacher' ? this.classes.teacherStudentIds(ctx.userId) : null
  }

  /** Data minimisation for teachers: a teacher caller sees only themself; null = no teacher filter. */
  private ownTeacherIds(ctx: Ctx): string[] | null {
    return ctx.role === 'teacher' ? [ctx.userId] : null
  }

  /** The one teacher filter: S2 teacher counts (via `ownTeacherIds`) and the S3 teacher list. */
  private visibleTeachers<T extends { id: string }>(ctx: Ctx, teachers: T[]): T[] {
    const ids = this.ownTeacherIds(ctx)
    return ids === null ? teachers : teachers.filter((t) => ids.includes(t.id))
  }

  /** The one minimisation filter: S2 counts (via `ownPupilIds`), S3 and S5 lists all use it. */
  private async visiblePupils<T extends { id: string }>(ctx: Ctx, pupils: T[]): Promise<T[]> {
    const ids = await this.ownPupilIds(ctx)
    if (ids === null) return pupils
    const own = new Set(ids)
    return pupils.filter((p) => own.has(p.id))
  }

  // --- S3 --------------------------------------------------------------------------------------------------------

  /** A school the caller may open: a forced role only its own; unknown ids are 404 for everyone. */
  private async schoolInScope(ctx: Ctx, schoolId: string): Promise<SchoolFact> {
    if (isSchoolForced(ctx.role) && ctx.schoolId !== schoolId) return NOT_FOUND()
    const fact = await this.repo.school(schoolId)
    return fact ?? NOT_FOUND()
  }

  async schoolDetail(ctx: Ctx, schoolId: string): Promise<SchoolDetail> {
    const fact = await this.schoolInScope(ctx, schoolId)
    const [allPupils, allTeachers, sub] = await Promise.all([
      this.repo.pupilsOfSchool(fact.id),
      this.repo.teachersOfSchool(fact.id),
      this.repo.latestSubscription(fact.id),
    ])
    const pupils = await this.visiblePupils(ctx, allPupils)
    const teachers = this.visibleTeachers(ctx, allTeachers)
    const [stats, flags] = await Promise.all([this.repo.pupilStats(pupils.map((p) => p.id)), this.repo.flagsOf(pupils.map((p) => p.id))])

    const students = pupils
      .map((p) => {
        const answers = stats.get(p.id)?.answers ?? 0
        const flag = flags.get(p.id) ?? null
        const last = stats.get(p.id)?.last ?? null
        return {
          id: p.id,
          name: p.name,
          email: p.email,
          level: levelLabelOf(p.grade),
          answers,
          status: statusOf(answers, p.lastLoginAt),
          engaged: answers > 0 && flag !== 'excluded',
          flag,
          lastLoginAt: p.lastLoginAt === null ? null : toMytTimestamp(p.lastLoginAt),
          lastActivityAt: last === null ? null : toMytTimestamp(last),
        }
      })
      .sort((a, b) => a.level.localeCompare(b.level) || byName(a, b))

    const teacherRows = teachers
      .map((t) => ({
        id: t.id,
        name: t.name,
        email: t.email,
        loggedIn: t.lastLoginAt !== null,
        lastLoginAt: t.lastLoginAt === null ? null : toMytTimestamp(t.lastLoginAt),
        createdAt: toMytTimestamp(t.createdAt),
      }))
      .sort(byName)

    const fc = { review: 0, excluded: 0 }
    for (const f of flags.values()) fc[f]++
    const engaged = students.filter((s) => s.engaged).length
    const p = percent(engaged, students.length)
    const status = sub && (['active', 'cancelled', 'expired'] as const).find((s) => s === sub.status)
    return {
      school: { id: fact.id, name: fact.name, code: fact.code, state: fact.state },
      subscription: sub && status ? { status, endsAt: `${sub.endsOn}T23:59:59+08:00` } : null,
      warning: fc.review + fc.excluded > 0 ? { review: fc.review, excluded: fc.excluded } : null,
      tahap: tahapOf(p),
      pct: round1(p),
      cards: {
        students: students.length,
        engaged,
        answers: students.reduce((a, s) => a + s.answers, 0),
        teachers: teacherRows.length,
        teachersLoggedIn: teacherRows.filter((t) => t.loggedIn).length,
      },
      flags: fc,
      students,
      teachers: teacherRows,
    }
  }

  // --- S5 --------------------------------------------------------------------------------------------------------

  /**
   * The person is loaded by id; a forced role must own both the school and the teacher, the admin's school segment is
   * not validated against the person (BR-M11-29). The pupil list is the whole school of the URL (BR-M11-24).
   */
  async teacherDetail(ctx: Ctx, schoolId: string, userId: string): Promise<TeacherDetail> {
    const fact = await this.schoolInScope(ctx, schoolId)
    const teacher = await this.repo.user(userId)
    if (!teacher || !teacher.isTeacher) return NOT_FOUND()
    if (isSchoolForced(ctx.role) && teacher.schoolId !== ctx.schoolId) return NOT_FOUND()
    if (ctx.role === 'teacher' && teacher.id !== ctx.userId) return NOT_FOUND()
    const pupils = await this.visiblePupils(ctx, await this.repo.pupilsOfSchool(fact.id))
    const stats = await this.repo.pupilStats(pupils.map((p) => p.id))
    const rows = pupils
      .map((p) => {
        const answers = stats.get(p.id)?.answers ?? 0
        const correct = stats.get(p.id)?.correct ?? 0
        return {
          id: p.id,
          name: p.name,
          level: levelLabelOf(p.grade),
          answers,
          raw: answers > 0 ? percent(correct, answers) : null,
          status: statusOf(answers, p.lastLoginAt),
          never: p.lastLoginAt === null,
        }
      })
      .sort(byName)
    const engaged = rows.filter((r) => r.answers > 0).length
    return {
      school: { id: fact.id, name: fact.name },
      teacher: { id: teacher.id, name: teacher.name, email: teacher.email, lastLoginAt: teacher.lastLoginAt === null ? null : toMytTimestamp(teacher.lastLoginAt) },
      cards: {
        students: rows.length,
        engaged,
        pct: round1(percent(engaged, rows.length)),
        needAttention: rows.filter((r) => r.answers === 0).length,
      },
      students: rows.map((r) => ({
        id: r.id,
        name: r.name,
        level: r.level,
        answers: r.answers,
        accuracy: r.raw === null ? null : round1(r.raw),
        status: r.status,
      })),
      suggestions: {
        neverLoggedIn: rows.filter((r) => r.never).length,
        lowAccuracy: rows.filter((r) => r.raw !== null && r.raw < 50).length,
        answered: engaged,
      },
    }
  }
}
