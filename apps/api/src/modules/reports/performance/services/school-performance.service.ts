import { Inject, Injectable, Optional } from '@nestjs/common'

import { ApiError } from '../../../../common/errors/api-error'
import { CLOCK, type Clock } from '../../../../db/clock'
import {
  COUNTED_MODES,
  LEVEL_CODES,
  LEVEL_NAMES,
  MIN_COHORT,
  REDACTED_ID,
  TOP_STUDENT_LIMIT,
  TOP_STUDENT_MIN_SITTINGS,
  type LevelCode,
} from '../domain/constants'
import { NO_SUBJECT_LABEL, SCHOOL_CLASS_LABEL } from '../domain/labels'
import { canSeeName, isStaff, levelVisibleToNonStaff, meetsCohort, nameFor } from '../domain/privacy'
import { GRADES, accuracyOf, compareIds, pct, round } from '../domain/rules'
import { HeadcountFactsService } from '../headcount/headcount-facts.service'
import { latestAr } from '../headcount/headcount.rules'
import {
  DIRECTORY_PORT,
  PerformancePorts,
  type BijakSittingQuery,
  type BijakTotals,
  type ClassInfo,
  type DirectoryPort,
} from '../ports'
import type { HeadcountEntryView, HeadcountFacts } from './headcount-facts.types'
import {
  achievementOf,
  distinctStudents,
  entryGrade,
  gpsOf,
  gradeOfPoints,
  gradedEntries,
  liveEntries,
  pairCounts,
  schoolGps,
  studentStatuses,
} from './headcount-figures'
import { distinctMembers, nameMap, ownPupilIds, viewScope, type ViewScope } from './support'
import type { Ctx, PerformanceLevelCard, PerformanceLevelDetail, PerformanceSchool } from './types'

/** Rows of the level's at-risk list. */
const AT_RISK_LIMIT = 15

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
    @Optional() @Inject(HeadcountFactsService) protected readonly facts?: HeadcountFacts,
  ) {}

  /** Per-request memo: a `Ctx` object lives for one request, so a scope is read from the database once per request however many of school(), levels() and level() run with it. */
  private readonly memo = new WeakMap<Ctx, Map<string, Promise<HeadcountEntryView[]>>>()

  /** Live headcount entries of the view scope; [] without the reader or a scope. */
  private entriesOf(ctx: Ctx, scope: ViewScope): Promise<HeadcountEntryView[]> {
    const facts = this.facts
    if (!facts || scope.kind === 'none') return Promise.resolve([])
    const key = scope.kind === 'platform' ? 'platform' : `school:${scope.schoolId}`
    const perCtx = this.memo.get(ctx) ?? new Map<string, Promise<HeadcountEntryView[]>>()
    this.memo.set(ctx, perCtx)
    let hit = perCtx.get(key)
    if (!hit) {
      const loaded = facts
        .entriesInScope(scope.kind === 'platform' ? { kind: 'platform' } : { kind: 'school', schoolId: scope.schoolId })
        .then(liveEntries)
      perCtx.set(key, loaded)
      // A failed read is not kept: a later call with the same ctx tries again.
      loaded.catch(() => perCtx.delete(key))
      hit = loaded
    }
    return hit
  }

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
        answered += r.answered
        gradedScore += r.gradedScore
        gradedMax += r.gradedMax
        totalPupils += r.pupils
      }
      subjectRows = await this.ports.bijak.totals(q, 'subject')
    }

    const entries = await this.entriesOf(ctx, scope)
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
            const own = new Set(e.classes.map((c) => c.id))
            const hc = entries.filter((x) => own.has(x.classroomId))
            const st = hc.length === 0 ? null : studentStatuses(hc)
            return {
              userId,
              name: e.name,
              classCount: e.classes.length,
              studentCount: ids.length,
              accuracy: shown(ctx, sumOf(ids, fr.byUser)).accuracy,
              onTrack: st ? st.on : null,
              below: st ? st.below : null,
            }
          })
          .sort((a, b) => a.name.localeCompare(b.name) || compareIds(a.userId, b.userId))
      : []

    const hc = this.schoolFigures(ctx, entries, fr.classes, visibleSubjects)

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
      gps: hc.gps,
      distribution: hc.distribution,
      trend: { years: [], chart: { labels: [], overall: [], subjects: [] } },
      subjects: hc.subjects,
      levels,
      teachers: teacherCards,
    }
  }

  /**
   * GPS, grade distribution and subject rows from the headcount entries (BR-M08-01 to 04). Non-staff: GPS and distribution are
   * empty below MIN_COHORT graded pupils, and a subject row with fewer than MIN_COHORT pupils is dropped (practice rows keep their own rule).
   */
  private schoolFigures(
    ctx: Ctx,
    entries: readonly HeadcountEntryView[],
    classes: readonly ClassInfo[],
    practiceRows: readonly BijakTotals[],
  ): Pick<PerformanceSchool, 'gps' | 'distribution' | 'subjects'> {
    const staff = isStaff(ctx.role)
    const graded = gradedEntries(entries)
    const shownGps = staff || distinctStudents(graded) >= MIN_COHORT
    const gps: PerformanceSchool['gps'] = schoolGps(entries, staff)

    const counts = new Map<string, number>()
    for (const e of shownGps ? graded : []) {
      const grade = entryGrade(e) as string
      counts.set(grade, (counts.get(grade) ?? 0) + 1)
    }
    const distribution = GRADES.map((grade) => {
      const count = counts.get(grade) ?? 0
      return { grade, count, pct: shownGps ? round(pct(count, graded.length), 1) : 0 }
    })

    const bySubject = new Map<string, HeadcountEntryView[]>()
    for (const e of graded) bySubject.set(e.subjectId, [...(bySubject.get(e.subjectId) ?? []), e])
    const nameOfSubject = new Map<string, string>()
    for (const c of classes) if (c.subjectId !== null && c.subjectName !== null) nameOfSubject.set(c.subjectId, c.subjectName)
    for (const e of graded) if (e.subjectName !== undefined) nameOfSubject.set(e.subjectId, e.subjectName)

    const neutral = { gps: null, grade: null, entries: 0, onTrack: 0, below: 0, noTarget: 0, achievementPct: null }
    const rowOf = (subjectId: string, name: string): PerformanceSchool['subjects'][number] => {
      const list = bySubject.get(subjectId) ?? []
      if (list.length === 0 || (!staff && distinctStudents(list) < MIN_COHORT)) return { subjectId, name, ...neutral }
      const value = gpsOf(list).value as number
      let on = 0
      let below = 0
      let noTarget = 0
      for (const e of list) {
        const l = latestAr(e)
        if (l === null || l.target === null) noTarget++
        else if (l.ar >= l.target) on++
        else below++
      }
      return { subjectId, name, gps: value, grade: gradeOfPoints(value), entries: list.length, onTrack: on, below, noTarget, achievementPct: achievementOf(value) }
    }
    const rows = new Map<string, PerformanceSchool['subjects'][number]>()
    for (const r of practiceRows) {
      if (r.subjectId !== undefined) rows.set(r.subjectId, rowOf(r.subjectId, r.subjectName ?? ''))
    }
    for (const subjectId of bySubject.keys()) {
      const name = nameOfSubject.get(subjectId)
      if (rows.has(subjectId) || name === undefined) continue
      const row = rowOf(subjectId, name)
      // A subject known only from headcount is listed to non-staff only when it clears the cohort.
      if (staff || row.gps !== null) rows.set(subjectId, row)
    }
    // BR-M08-04: GPS ascending, subjects without data last, then by name.
    const subjects = [...rows.values()].sort(
      (a, b) => (a.gps === null ? 1 : 0) - (b.gps === null ? 1 : 0) || (a.gps ?? 0) - (b.gps ?? 0) || a.name.localeCompare(b.name) || compareIds(a.subjectId, b.subjectId),
    )
    return { gps, distribution, subjects }
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

    const classIds = new Set(lc.filter((c) => c.kind === 'classroom').map((c) => c.id))
    const levelEntries = (await this.entriesOf(ctx, viewScope(ctx))).filter((e) => classIds.has(e.classroomId))
    // Non-staff: the same remainder rule as for the practice figures, over the pupils holding headcount entries.
    const hcVisible =
      visible &&
      levelVisibleToNonStaff(
        ctx.role,
        distinctStudents(levelEntries),
        lc.map((c) => distinctStudents(levelEntries.filter((e) => e.classroomId === c.id))),
      )
    const pairs = hcVisible ? pairCounts(levelEntries) : { on: 0, below: 0, onPct: 0 }

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
        const own = levelEntries.filter((e) => e.classroomId === c.id)
        const st = isStaff(ctx.role) || meetsCohort(ctx.role, distinctStudents(own)) ? studentStatuses(own) : { on: 0, below: 0 }
        return {
          classId: c.id,
          kind: c.kind,
          name: c.name,
          subject: c.kind === 'school_class' ? SCHOOL_CLASS_LABEL : (c.subjectName ?? NO_SUBJECT_LABEL),
          teacher: c.teacherName,
          students: ids.length,
          sessions: s.sessions,
          accuracy: s.accuracy,
          onTrack: st.on,
          below: st.below,
          href: c.kind === 'classroom' ? `/prestasi/kelas/${c.id}` : null,
        }
      })

    let topStudents: PerformanceLevelDetail['topStudents'] = []
    let atRisk: PerformanceLevelDetail['atRisk'] = []
    if (isStaff(ctx.role)) {
      const own = await ownPupilIds(this.ports, ctx)
      atRisk = await this.atRiskOf(ctx, levelEntries, lc, own)
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
        answered: t.answered,
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
      onTrack: pairs.on,
      below: pairs.below,
      onTrackPct: pairs.onPct,
      classRows,
      topStudents,
      atRisk,
    }
  }

  /** Murid Berisiko (BR-M07): pairs below their target with an AR, gap ascending, then config and pupil; top 15. Staff only; names follow canSeeName. */
  private async atRiskOf(
    ctx: Ctx,
    entries: readonly HeadcountEntryView[],
    classes: readonly ClassInfo[],
    own: ReadonlySet<string>,
  ): Promise<PerformanceLevelDetail['atRisk']> {
    const picked = entries
      .flatMap((e) => {
        const l = latestAr(e)
        return l === null || l.target === null || l.ar >= l.target ? [] : [{ e, l, target: l.target, gap: l.ar - l.target }]
      })
      .sort((a, b) => a.gap - b.gap || compareIds(a.e.configId, b.e.configId) || compareIds(a.e.studentId, b.e.studentId))
      .slice(0, AT_RISK_LIMIT)
    if (picked.length === 0) return []
    const names = await nameMap(this.directory, picked.map((x) => x.e.studentId))
    const classNames = new Map(classes.map((c) => [c.id, c.name]))
    return picked.map(({ e, l, target, gap }) => {
      const visible = canSeeName(ctx.role, ctx.userId, e.studentId, own)
      return {
        userId: visible ? e.studentId : REDACTED_ID,
        name: nameFor(names.get(e.studentId) ?? '', visible),
        className: classNames.get(e.classroomId) ?? '',
        checkpoint: l.n,
        ar: l.ar,
        target,
        gap: round(gap, 1),
      }
    })
  }
}
