import { Inject, Injectable } from '@nestjs/common'

import { ApiError } from '../../../../common/errors/api-error'
import { CLOCK, type Clock } from '../../../../db/clock'
import {
  COUNTED_MODES,
  LEVEL_CODES,
  LEVEL_NAMES,
  REDACTED_ID,
  TOP_STUDENT_LIMIT,
  TOP_STUDENT_MIN_SITTINGS,
  type LevelCode,
} from '../domain/constants'
import { NO_SUBJECT_LABEL, SCHOOL_CLASS_LABEL } from '../domain/labels'
import { canSeeName, isStaff, levelVisibleToNonStaff, meetsCohort, nameFor } from '../domain/privacy'
import { GRADES, accuracyOf, compareIds } from '../domain/rules'
import {
  DIRECTORY_PORT,
  PerformancePorts,
  type BijakSittingQuery,
  type BijakTotals,
  type ClassInfo,
  type DirectoryPort,
} from '../ports'
import { distinctMembers, nameMap, ownPupilIds, viewScope, type ViewScope } from './support'
import type { Ctx, PerformanceLevelCard, PerformanceLevelDetail, PerformanceSchool } from './types'

interface Sums {
  sittings: number
  max: number
  gradedScore: number
  gradedMax: number
  /** Pupils with at least one sitting. */
  contributors: number
}

function sumOf(ids: readonly string[], byUser: ReadonlyMap<string, BijakTotals>): Sums {
  const s: Sums = { sittings: 0, max: 0, gradedScore: 0, gradedMax: 0, contributors: 0 }
  for (const id of ids) {
    const t = byUser.get(id)
    if (!t) continue
    s.sittings += t.sittings
    s.max += t.max
    s.gradedScore += t.gradedScore
    s.gradedMax += t.gradedMax
    s.contributors += 1
  }
  return s
}

/** Zeroed when fewer than MIN_COHORT pupils stand behind it and the viewer is not staff. */
function shown(ctx: Ctx, s: Sums): { sessions: number; accuracy: number } {
  if (!meetsCohort(ctx.role, s.contributors)) return { sessions: 0, accuracy: 0 }
  return { sessions: s.sittings, accuracy: accuracyOf(s.gradedScore, s.gradedMax) }
}

interface Frame {
  scope: ViewScope
  /** Active classes (both kinds) in scope. */
  classes: ClassInfo[]
  members: { all: string[]; byClass: Map<string, string[]> }
  byUser: Map<string, BijakTotals>
}

/** Prestasi sekolah and tingkatan (S1 to S3). Scope: admin = platform, others their own school, no school = empty. Exported for BE-21. level() throws NOT_FOUND for a code other than t4/t5. */
@Injectable()
export class SchoolPerformanceService {
  constructor(
    protected readonly ports: PerformancePorts,
    @Inject(DIRECTORY_PORT) protected readonly directory: DirectoryPort,
    @Inject(CLOCK) protected readonly clock: Clock,
  ) {}

  private query(scope: ViewScope): BijakSittingQuery {
    return scope.kind === 'school' ? { schoolIds: [scope.schoolId], modes: COUNTED_MODES.school } : { modes: COUNTED_MODES.school }
  }

  private async frame(ctx: Ctx): Promise<Frame> {
    const scope = viewScope(ctx)
    const all = scope.kind === 'platform' ? await this.ports.classes.allClasses() : scope.kind === 'school' ? await this.ports.classes.classesOfSchool(scope.schoolId) : []
    const classes = all.filter((c) => c.isActive)
    const members = await distinctMembers(this.ports, classes)
    const rows = members.all.length === 0 ? [] : await this.ports.bijak.totals({ userIds: members.all, modes: COUNTED_MODES.school }, 'user')
    const byUser = new Map<string, BijakTotals>()
    for (const r of rows) if (r.userId !== undefined) byUser.set(r.userId, r)
    return { scope, classes, members, byUser }
  }

  async school(ctx: Ctx): Promise<PerformanceSchool> {
    const fr = await this.frame(ctx)
    const { scope } = fr
    const kind = scope.kind === 'platform' ? 'platform' : 'school'
    const classrooms = fr.classes.filter((c) => c.kind === 'classroom')

    const schoolIds =
      scope.kind === 'school' ? [scope.schoolId] : scope.kind === 'platform' ? (await this.directory.schoolsInScope({})).map((s) => s.id) : []
    const sum = (m: ReadonlyMap<string, number>): number => [...m.values()].reduce((a, b) => a + b, 0)
    const students = schoolIds.length === 0 ? 0 : sum(await this.directory.countPupils(schoolIds))
    const teachers = schoolIds.length === 0 ? 0 : sum(await this.directory.countTeachers(schoolIds))

    let sessions = 0
    let answered = 0
    let gradedScore = 0
    let gradedMax = 0
    let totalPupils = 0
    let subjectRows: BijakTotals[] = []
    if (scope.kind !== 'none') {
      const q = this.query(scope)
      for (const r of await this.ports.bijak.totals(q, 'school')) {
        sessions += r.sittings
        answered += r.max
        gradedScore += r.gradedScore
        gradedMax += r.gradedMax
        totalPupils += r.pupils
      }
      subjectRows = await this.ports.bijak.totals(q, 'subject')
    }

    const levelSums = LEVEL_CODES.map((code) => {
      const lc = fr.classes.filter((c) => c.levelSlug === code)
      const ids = [...new Set(lc.flatMap((c) => fr.members.byClass.get(c.id) ?? []))]
      const sums = sumOf(ids, fr.byUser)
      const classPupils = lc.map((c) => sumOf(fr.members.byClass.get(c.id) ?? [], fr.byUser).contributors)
      return { code, classes: lc.length, ids, sums, visible: levelVisibleToNonStaff(ctx.role, sums.contributors, classPupils) }
    })
    const levels = levelSums.map((l) => ({
      code: l.code,
      accuracy: l.visible ? shown(ctx, l.sums).accuracy : 0,
      classes: l.classes,
      students: l.ids.length,
      sessions: l.visible ? shown(ctx, l.sums).sessions : 0,
    }))
    // Non-staff: a total that would let a suppressed level (or a small remainder) be recovered by
    // subtraction is suppressed too, as is a total backed by fewer than MIN_COHORT pupils.
    let hideTotals = false
    let visibleSubjects = subjectRows
    if (!isStaff(ctx.role)) {
      const inLevels = new Set(levelSums.flatMap((l) => l.ids.filter((id) => fr.byUser.has(id))))
      const remainder = totalPupils - inLevels.size
      hideTotals =
        !meetsCohort(ctx.role, totalPupils) ||
        levelSums.some((l) => l.sums.contributors > 0 && !l.visible) ||
        (remainder > 0 && !meetsCohort(ctx.role, remainder))
      visibleSubjects = subjectRows.filter((r) => meetsCohort(ctx.role, r.pupils))
    }

    const byTeacher = new Map<string, { name: string; classes: ClassInfo[] }>()
    for (const c of classrooms) {
      if (c.teacherId === null) continue
      const e = byTeacher.get(c.teacherId) ?? { name: c.teacherName ?? '', classes: [] }
      e.classes.push(c)
      byTeacher.set(c.teacherId, e)
    }
    const teacherCards = isStaff(ctx.role)
      ? [...byTeacher]
          .map(([userId, e]) => {
            const ids = [...new Set(e.classes.flatMap((c) => fr.members.byClass.get(c.id) ?? []))]
            return {
              userId,
              name: e.name,
              classCount: e.classes.length,
              studentCount: ids.length,
              accuracy: shown(ctx, sumOf(ids, fr.byUser)).accuracy,
              onTrack: null,
              below: null,
            }
          })
          .sort((a, b) => a.name.localeCompare(b.name) || compareIds(a.userId, b.userId))
      : []

    return {
      scope: kind,
      header: { classCount: classrooms.length, studentCount: students },
      stats: {
        students,
        teachers,
        classes: classrooms.length,
        subjects: new Set(classrooms.map((c) => c.subjectId).filter((s): s is string => s !== null)).size,
        sessions: hideTotals ? 0 : sessions,
        answered: hideTotals ? 0 : answered,
        accuracy: hideTotals ? 0 : accuracyOf(gradedScore, gradedMax),
      },
      gps: { value: null, band: null, entries: 0 },
      distribution: GRADES.map((grade) => ({ grade, count: 0, pct: 0 })),
      trend: { years: [], chart: { labels: [], overall: [], subjects: [] } },
      subjects: visibleSubjects
        .filter((r) => r.subjectId !== undefined)
        .map((r) => ({
          subjectId: r.subjectId as string,
          name: r.subjectName ?? '',
          gps: null,
          grade: null,
          entries: 0,
          onTrack: 0,
          below: 0,
          noTarget: 0,
          achievementPct: null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name) || compareIds(a.subjectId, b.subjectId)),
      levels,
      teachers: teacherCards,
    }
  }

  async levels(ctx: Ctx): Promise<PerformanceLevelCard[]> {
    const fr = await this.frame(ctx)
    return LEVEL_CODES.map((code) => {
      const lc = fr.classes.filter((c) => c.levelSlug === code)
      const ids = new Set(lc.flatMap((c) => fr.members.byClass.get(c.id) ?? []))
      return { code, name: LEVEL_NAMES[code], classes: lc.length, students: ids.size }
    })
  }

  async level(ctx: Ctx, code: string): Promise<PerformanceLevelDetail> {
    if (!(LEVEL_CODES as readonly string[]).includes(code)) throw ApiError.of('NOT_FOUND')
    const level = code as LevelCode
    const fr = await this.frame(ctx)
    const lc = fr.classes.filter((c) => c.levelSlug === level)
    const students = [...new Set(lc.flatMap((c) => fr.members.byClass.get(c.id) ?? []))].sort(compareIds)
    // Non-staff: a class row hidden for having 1 to 4 pupils would be recovered as total minus shown rows, so the total is hidden too.
    const visible = levelVisibleToNonStaff(
      ctx.role,
      sumOf(students, fr.byUser).contributors,
      lc.map((c) => sumOf(fr.members.byClass.get(c.id) ?? [], fr.byUser).contributors),
    )
    const total = !visible ? { sessions: 0, accuracy: 0 } : shown(ctx, sumOf(students, fr.byUser))

    const groupKey = (c: ClassInfo): [number, string] =>
      c.kind === 'school_class' ? [2, ''] : c.subjectId === null ? [0, ''] : [1, c.subjectName ?? '']
    const classRows = [...lc]
      .sort((a, b) => {
        const [ga, na] = groupKey(a)
        const [gb, nb] = groupKey(b)
        return ga - gb || na.localeCompare(nb) || a.name.localeCompare(b.name) || compareIds(a.id, b.id)
      })
      .map((c) => {
        const ids = fr.members.byClass.get(c.id) ?? []
        const s = shown(ctx, sumOf(ids, fr.byUser))
        return {
          classId: c.id,
          kind: c.kind,
          name: c.name,
          subject: c.kind === 'school_class' ? SCHOOL_CLASS_LABEL : (c.subjectName ?? NO_SUBJECT_LABEL),
          teacher: c.teacherName,
          students: ids.length,
          sessions: s.sessions,
          accuracy: s.accuracy,
          onTrack: 0,
          below: 0,
          href: c.kind === 'classroom' ? `/prestasi/kelas/${c.id}` : null,
        }
      })

    let topStudents: PerformanceLevelDetail['topStudents'] = []
    if (isStaff(ctx.role)) {
      const own = await ownPupilIds(this.ports, ctx)
      const best = students
        .flatMap((userId) => {
          const t = fr.byUser.get(userId)
          return t && t.sittings >= TOP_STUDENT_MIN_SITTINGS ? [{ userId, t, raw: t.gradedMax === 0 ? 0 : t.gradedScore / t.gradedMax }] : []
        })
        .sort((a, b) => b.raw - a.raw || compareIds(a.userId, b.userId))
        .slice(0, TOP_STUDENT_LIMIT)
      const names = await nameMap(this.directory, best.map((b) => b.userId))
      topStudents = best.map(({ userId, t }) => ({
        userId: canSeeName(ctx.role, ctx.userId, userId, own) ? userId : REDACTED_ID,
        name: nameFor(names.get(userId) ?? '', canSeeName(ctx.role, ctx.userId, userId, own)),
        sessions: t.sittings,
        answered: t.max,
        accuracy: accuracyOf(t.gradedScore, t.gradedMax),
      }))
    }

    return {
      code: level,
      name: LEVEL_NAMES[level],
      classes: lc.length,
      students: students.length,
      subjects: new Set(lc.map((c) => c.subjectId).filter((s): s is string => s !== null)).size,
      accuracy: total.accuracy,
      sessions: total.sessions,
      onTrack: 0,
      below: 0,
      onTrackPct: 0,
      classRows,
      topStudents,
      atRisk: [],
    }
  }
}
