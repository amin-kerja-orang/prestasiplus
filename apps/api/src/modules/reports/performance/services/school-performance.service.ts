import { Inject, Injectable, Optional } from '@nestjs/common'

import { ApiError } from '../../../../common/errors/api-error'
import { CLOCK, type Clock } from '../../../../db/clock'
import { canOpenClassDashboard } from '../domain/access-policy'
import {
  ACTIVE_DAYS,
  AT_RISK_BELOW,
  AT_RISK_LIMIT,
  LEVEL_CODES,
  LEVEL_NAMES,
  MIN_COHORT,
  REDACTED_ID,
  SESSION_MODES,
  TOP_STUDENT_LIMIT,
  TOP_STUDENT_MIN_ANSWERS,
  type LevelCode,
} from '../domain/constants'
import { NO_SUBJECT_LABEL, SCHOOL_CLASS_LABEL } from '../domain/labels'
import { canSeeName, isStaff, levelVisibleToNonStaff, meetsCohort, nameFor } from '../domain/privacy'
import { GRADES, compareIds, pct, round } from '../domain/rules'
import { startOfDaysAgo } from '../domain/windows'
import { toMytTimestamp } from '../../../../common/time/myt'
import { xsAccuracy } from '../../../school-admin/xs-queries'
import { HeadcountFactsService } from '../headcount/headcount-facts.service'
import { latestAr } from '../headcount/headcount.rules'
import { DIRECTORY_PORT, PerformancePorts, XS_COUNTS_PORT, type AnswerFactsQuery, type ClassInfo, type DirectoryPort, type XsCountsPort } from '../ports'
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
import { distinctMembers, nameMap, ownPupilIds, sessionTotalsOf, viewScope, type ViewScope } from './support'
import type { Ctx, PerformanceLevelCard, PerformanceLevelDetail, PerformanceSchool } from './types'

/** One pupil's figures from the shared answer reader: every mode answers, game modes add no session. */
interface UserTotals {
  sessions: number
  answered: number
  correct: number
  last: Date | null
}

interface SubjectTotals {
  subjectId: string
  sessions: number
  answered: number
  correct: number
  /** Distinct pupils with an answer in the subject (privacy cohort). */
  pupils: number
}

interface FactSet {
  byUser: Map<string, UserTotals>
  bySubject: Map<string, SubjectTotals>
}

interface Sums {
  sessions: number
  answered: number
  correct: number
  /** Pupils with at least one answer. */
  contributors: number
}

/** t4 and t5 are always listed; t1 to t3 only when the scope has classes or pupils at that level. */
function listedLevel(l: { code: LevelCode; classes: number; ids: readonly string[] }): boolean {
  return l.code === 't4' || l.code === 't5' || l.classes > 0 || l.ids.length > 0
}

function sumOf(ids: readonly string[], byUser: ReadonlyMap<string, UserTotals>): Sums {
  const s: Sums = { sessions: 0, answered: 0, correct: 0, contributors: 0 }
  for (const id of ids) {
    const t = byUser.get(id)
    if (!t) continue
    s.sessions += t.sessions
    s.answered += t.answered
    s.correct += t.correct
    s.contributors += 1
  }
  return s
}

/** XS-5 (decision 11) for every accuracy of this payload: pooled, one decimal, integer half up, never above 100. The contract's non-nullable fields show 0 without answers. */
const accuracyOf = (correct: number, answered: number): number => xsAccuracy(correct, answered) ?? 0

/** Zeroed when fewer than MIN_COHORT pupils stand behind it and the viewer is not staff. Pooled accuracy: correct / answered (XS-5). */
function shown(ctx: Ctx, s: Sums): { sessions: number; accuracy: number } {
  if (!meetsCohort(ctx.role, s.contributors)) return { sessions: 0, accuracy: 0 }
  return { sessions: s.sessions, accuracy: accuracyOf(s.correct, s.answered) }
}

interface Frame {
  scope: ViewScope
  /** Active classes (both kinds) in scope. */
  classes: ClassInfo[]
  members: { all: string[]; byClass: Map<string, string[]> }
  /** One shared-reader read of the whole view scope (every pupil with an answer; class members are a subset). */
  wide: FactSet
  byUser: Map<string, UserTotals>
}

/** Schools whose XS-3 count is read at once for the platform view. */
const XS_TEACHER_BATCH = 20

/** How many of `ids` are XS-1 pupils. */
function countOf(ids: Iterable<string>, xsPupils: ReadonlySet<string>): number {
  let n = 0
  for (const id of ids) if (xsPupils.has(id)) n += 1
  return n
}

const EMPTY_FACTS = (): FactSet => ({ byUser: new Map(), bySubject: new Map() })

/** Prestasi sekolah and tingkatan (S1 to S3). Scope: admin = platform, others their own school, no school = empty. Exported for BE-21. level() throws NOT_FOUND for a code other than t1 to t5. */
@Injectable()
export class SchoolPerformanceService {
  constructor(
    protected readonly ports: PerformancePorts,
    @Inject(DIRECTORY_PORT) protected readonly directory: DirectoryPort,
    @Inject(CLOCK) protected readonly clock: Clock,
    @Inject(XS_COUNTS_PORT) protected readonly xs: XsCountsPort,
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

  /** Per-request memo of the XS-1 pupil set of the view scope (same lifetime as `memo`). */
  private readonly pupilMemo = new WeakMap<Ctx, Promise<ReadonlySet<string>>>()

  /**
   * XS-1 (S6-T03 `XsQueries.pupils`): the pupils of the view scope that count as "Murid". Every pupil figure of Prestasi sekolah and
   * Tingkatan (header, stats, level rows, teacher cards) is a count over this set, so a suspended, pending, deactivated or
   * non-Tingkatan-1-5 account never adds to a "Murid" number (AC-XS-1). A scope without a school is empty.
   */
  private xsPupils(ctx: Ctx, scope: ViewScope): Promise<ReadonlySet<string>> {
    if (scope.kind === 'none') return Promise.resolve(new Set())
    let hit = this.pupilMemo.get(ctx)
    if (!hit) {
      hit = this.xs.pupils(scope.kind === 'platform' ? { kind: 'platform' } : { kind: 'school', schoolId: scope.schoolId }).then((r) => new Set(r.ids))
      this.pupilMemo.set(ctx, hit)
      // A failed read is not kept: a later call with the same ctx tries again.
      hit.catch(() => this.pupilMemo.delete(ctx))
    }
    return hit
  }

  /**
   * XS-3 "Guru" of the view scope as ids (`XsQueries.teachers`): the school's teachers, or those of every school for the platform (admin).
   * The "Guru" count and the teacher cards both come from this one set (AC-AS-4-1), so they cannot disagree.
   */
  private async xsTeacherIds(scope: ViewScope): Promise<ReadonlySet<string>> {
    if (scope.kind === 'none') return new Set()
    if (scope.kind === 'school') return new Set((await this.xs.teachers(scope.schoolId)).ids)
    const ids = (await this.directory.schoolsInScope({})).map((s) => s.id)
    const all = new Set<string>()
    for (let i = 0; i < ids.length; i += XS_TEACHER_BATCH) {
      for (const r of await Promise.all(ids.slice(i, i + XS_TEACHER_BATCH).map((id) => this.xs.teachers(id)))) for (const t of r.ids) all.add(t)
    }
    return all
  }

  /** The shared answer reader (S10-T01): answers of every mode, sessions of the non-game modes; per pupil and per subject. */
  private async loadFacts(query: AnswerFactsQuery, keep: ReadonlySet<string>): Promise<FactSet> {
    const reader = this.ports.answerFacts
    // (user x subject) grain: the figures here never need question, chapter or topic rows.
    const [allRows, allSessionRows] = await Promise.all([reader.answerFacts({ ...query, grain: 'user-subject' }), reader.sessionCounts({ ...query, modes: SESSION_MODES })])
    // XS-1 (S6-T03): only the answers and sessions of counted pupils (active, not suspended, Tingkatan 1-5) enter any figure, the same set as "Murid".
    const rows = allRows.filter((r) => keep.has(r.userId))
    const sessionRows = allSessionRows.filter((r) => keep.has(r.userId))
    const byUser = new Map<string, UserTotals>()
    const bySubject = new Map<string, SubjectTotals>()
    const subjectUsers = new Map<string, Set<string>>()
    for (const r of rows) {
      const u = byUser.get(r.userId) ?? { sessions: 0, answered: 0, correct: 0, last: null }
      u.answered += r.attempts
      u.correct += r.correct
      if (u.last === null || r.lastAnsweredAt > u.last) u.last = r.lastAnsweredAt
      byUser.set(r.userId, u)
      if (r.subjectId === '0') continue
      const sub = bySubject.get(r.subjectId) ?? { subjectId: r.subjectId, sessions: 0, answered: 0, correct: 0, pupils: 0 }
      sub.answered += r.attempts
      sub.correct += r.correct
      bySubject.set(r.subjectId, sub)
      subjectUsers.set(r.subjectId, (subjectUsers.get(r.subjectId) ?? new Set<string>()).add(r.userId))
    }
    for (const [userId, sessions] of sessionTotalsOf(sessionRows)) {
      const u = byUser.get(userId)
      if (u) u.sessions = sessions
    }
    for (const r of sessionRows) {
      if (r.subjectId !== null) {
        const sub = bySubject.get(r.subjectId)
        if (sub) sub.sessions += r.sessions
      }
    }
    for (const [id, users] of subjectUsers) (bySubject.get(id) as SubjectTotals).pupils = users.size
    return { byUser, bySubject }
  }

  /** `withFacts` false: the caller needs classes and rosters only (no answer read). */
  private async frame(ctx: Ctx, withFacts = true): Promise<Frame> {
    const scope = viewScope(ctx)
    const all = scope.kind === 'platform' ? await this.ports.classes.allClasses() : scope.kind === 'school' ? await this.ports.classes.classesOfSchool(scope.schoolId) : []
    const classes = all.filter((c) => c.isActive)
    const members = await distinctMembers(this.ports, classes)
    // One read per request: platform = no filter, school = the school id (never a pupil id list). Class figures filter this set in memory.
    const wide =
      !withFacts || scope.kind === 'none'
        ? EMPTY_FACTS()
        : await this.loadFacts(scope.kind === 'school' ? { schoolIds: [scope.schoolId] } : {}, await this.xsPupils(ctx, scope))
    return { scope, classes, members, wide, byUser: wide.byUser }
  }

  async school(ctx: Ctx): Promise<PerformanceSchool> {
    const fr = await this.frame(ctx)
    const { scope } = fr
    const kind = scope.kind === 'platform' ? 'platform' : 'school'
    const classrooms = fr.classes.filter((c) => c.kind === 'classroom')

    // XS-1 / XS-3 (S6-T03): the same named queries as the school admin Dashboard, through XS_COUNTS_PORT (FR-AS-4-1, AC-AS-4-1).
    const [xsPupils, xsTeacherIds] = await Promise.all([this.xsPupils(ctx, scope), this.xsTeacherIds(scope)])
    const teachers = xsTeacherIds.size
    const students = xsPupils.size

    // Sessions, answered and pooled accuracy come from the shared answer reader (all modes; XS-4, XS-5, XS-8), over the XS-1 pupils only (`loadFacts`).
    let sessions = 0
    let answered = 0
    let correct = 0
    let totalPupils = 0
    let subjectRows: SubjectTotals[] = []
    if (scope.kind !== 'none') {
      const wide = fr.wide
      for (const u of wide.byUser.values()) {
        sessions += u.sessions
        answered += u.answered
        correct += u.correct
        totalPupils += 1
      }
      subjectRows = [...wide.bySubject.values()]
    }

    const entries = await this.entriesOf(ctx, scope)
    const levelSums = LEVEL_CODES.map((code) => {
      const lc = fr.classes.filter((c) => c.levelSlug === code)
      const ids = [...new Set(lc.flatMap((c) => fr.members.byClass.get(c.id) ?? []))]
      const sums = sumOf(ids, fr.byUser)
      const classPupils = lc.map((c) => sumOf(fr.members.byClass.get(c.id) ?? [], fr.byUser).contributors)
      return { code, classes: lc.length, ids, counted: countOf(ids, xsPupils), sums, visible: levelVisibleToNonStaff(ctx.role, sums.contributors, classPupils) }
    })
    // t4 and t5 are always listed (zeros when empty); t1 to t3 only when the scope has classes or pupils at that level (R1-AS-4).
    const levels = levelSums.filter(listedLevel).map((l) => ({
      code: l.code,
      accuracy: l.visible ? shown(ctx, l.sums).accuracy : 0,
      classes: l.classes,
      students: l.counted,
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
      // Teacher cards list XS-3 teachers only: a pending, deactivated, suspended or school-admin class owner gets no card (AC-AS-4-1).
      if (c.teacherId === null || !xsTeacherIds.has(c.teacherId)) continue
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
              studentCount: countOf(ids, xsPupils),
              accuracy: shown(ctx, sumOf(ids, fr.byUser)).accuracy,
              onTrack: st ? st.on : null,
              below: st ? st.below : null,
            }
          })
          .sort((a, b) => a.name.localeCompare(b.name) || compareIds(a.userId, b.userId))
      : []

    // The reader keys subject totals by the curriculum subject id, the same id classes and headcount entries carry: one subject is one row (SW13-08).
    const subjectNames = await this.directory.subjectsOfIds(visibleSubjects.map((r) => r.subjectId))
    const practiceRows = visibleSubjects.map((r) => ({ subjectId: r.subjectId, name: subjectNames.get(r.subjectId)?.name ?? '' }))
    const hc = this.schoolFigures(ctx, entries, fr.classes, practiceRows)

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
        accuracy: hideTotals ? 0 : accuracyOf(correct, answered),
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
   * While the overall figures are shown, the subject breakdown is shown only when no subject with graded entries falls below MIN_COHORT.
   */
  private schoolFigures(
    ctx: Ctx,
    entries: readonly HeadcountEntryView[],
    classes: readonly ClassInfo[],
    practiceRows: readonly { subjectId: string; name: string }[],
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
      // The class / headcount name wins over the curriculum name when the subject is known there.
      rows.set(r.subjectId, rowOf(r.subjectId, nameOfSubject.get(r.subjectId) ?? r.name))
    }
    for (const subjectId of bySubject.keys()) {
      const name = nameOfSubject.get(subjectId)
      if (rows.has(subjectId) || name === undefined) continue
      const row = rowOf(subjectId, name)
      // A subject known only from headcount is listed to non-staff only when it clears the cohort.
      if (staff || row.gps !== null) rows.set(subjectId, row)
    }
    // Non-staff: the overall GPS and entry count are served with the rows, so a breakdown that leaves out a subject below
    // MIN_COHORT would not stay consistent with them. It is shown only when every subject with graded entries is in it.
    const complete = [...bySubject].every(([subjectId, list]) => distinctStudents(list) >= MIN_COHORT && rows.has(subjectId))
    const withheld = !staff && shownGps && !complete
    // BR-M08-04: GPS ascending, subjects without data last, then by name.
    const subjects = (withheld ? [] : [...rows.values()]).sort(
      (a, b) => (a.gps === null ? 1 : 0) - (b.gps === null ? 1 : 0) || (a.gps ?? 0) - (b.gps ?? 0) || a.name.localeCompare(b.name) || compareIds(a.subjectId, b.subjectId),
    )
    return { gps, distribution, subjects }
  }

  /**
   * A teacher's Tingkatan view covers the teacher's own active classes only (R1-GUR-4, OPT-KELAS-OWN: aggregates over the teacher's
   * pupils); the school-wide comparison belongs to the school admin screen (R1-AS-4). Other roles keep the whole scope.
   */
  private async scoped(ctx: Ctx, fr: Frame): Promise<Frame> {
    if (ctx.role !== 'teacher') return fr
    const own = new Set((await this.ports.classes.classesForTeacher(ctx.userId)).map((c) => c.id))
    return { ...fr, classes: fr.classes.filter((c) => own.has(c.id)) }
  }

  async levels(ctx: Ctx): Promise<PerformanceLevelCard[]> {
    const fr = await this.scoped(ctx, await this.frame(ctx, false))
    const xsPupils = await this.xsPupils(ctx, fr.scope)
    // t4 and t5 always, t1 to t3 only with classes or pupils: the Tingkatan cards and chips are built from this list.
    return LEVEL_CODES.flatMap((code) => {
      const lc = fr.classes.filter((c) => c.levelSlug === code)
      const ids = new Set(lc.flatMap((c) => fr.members.byClass.get(c.id) ?? []))
      return listedLevel({ code, classes: lc.length, ids: [...ids] }) ? [{ code, name: LEVEL_NAMES[code], classes: lc.length, students: countOf(ids, xsPupils) }] : []
    })
  }

  async level(ctx: Ctx, code: string): Promise<PerformanceLevelDetail> {
    if (!(LEVEL_CODES as readonly string[]).includes(code)) throw ApiError.of('NOT_FOUND')
    const level = code as LevelCode
    const fr = await this.scoped(ctx, await this.frame(ctx))
    const lc = fr.classes.filter((c) => c.levelSlug === level)
    const students = [...new Set(lc.flatMap((c) => fr.members.byClass.get(c.id) ?? []))].sort(compareIds)
    const xsPupils = await this.xsPupils(ctx, fr.scope)
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

    const classRows = [...lc]
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
          students: countOf(ids, xsPupils),
          sessions: s.sessions,
          accuracy: s.accuracy,
          onTrack: st.on,
          below: st.below,
          // Only a link the viewer can open: the class dashboard answers 404 otherwise.
          href: canOpenClassDashboard(ctx, c) ? `/prestasi/kelas/${c.id}` : null,
        }
      })
      // Perbandingan Kelas: accuracy descending (R1-AS-4); the page shows 25 per page.
      .sort((a, b) => b.accuracy - a.accuracy || b.students - a.students || a.name.localeCompare(b.name) || compareIds(a.classId, b.classId))

    // The pupil lists name XS-1 pupils only: an account outside the counted set has no figures here, so it must not appear as "no answer".
    const xsStudents = students.filter((id) => xsPupils.has(id))
    let topStudents: PerformanceLevelDetail['topStudents'] = []
    let atRisk: PerformanceLevelDetail['atRisk'] = []
    if (isStaff(ctx.role)) {
      const own = await ownPupilIds(this.ports, ctx)
      const classOf = new Map<string, string>()
      for (const c of [...lc].sort((a, b) => a.name.localeCompare(b.name) || compareIds(a.id, b.id)))
        for (const id of fr.members.byClass.get(c.id) ?? []) if (!classOf.has(id)) classOf.set(id, c.name)
      // Murid Terbaik: at least TOP_STUDENT_MIN_ANSWERS answers, accuracy descending, ties by answers (then id).
      const best = xsStudents
        .flatMap((userId) => {
          const t = fr.byUser.get(userId)
          return t && t.answered >= TOP_STUDENT_MIN_ANSWERS ? [{ userId, t, raw: t.correct / t.answered }] : []
        })
        .sort((a, b) => b.raw - a.raw || b.t.answered - a.t.answered || compareIds(a.userId, b.userId))
        .slice(0, TOP_STUDENT_LIMIT)
      // Murid Berisiko: whole-number accuracy below AT_RISK_BELOW, or no answer in the last ACTIVE_DAYS days; accuracy ascending, pupils with no answer last.
      const activeFrom = startOfDaysAgo(this.clock.now(), ACTIVE_DAYS - 1)
      const risky = xsStudents
        .flatMap((userId) => {
          const t = fr.byUser.get(userId)
          const accuracy = t ? xsAccuracy(t.correct, t.answered) : null
          const inactive = !t || t.last === null || t.last < activeFrom
          return (accuracy !== null && Math.round(accuracy) < AT_RISK_BELOW) || inactive ? [{ userId, t, accuracy }] : []
        })
        .sort((a, b) => (a.accuracy === null ? 1 : 0) - (b.accuracy === null ? 1 : 0) || (a.accuracy ?? 0) - (b.accuracy ?? 0) || compareIds(a.userId, b.userId))
        .slice(0, AT_RISK_LIMIT)
      const names = await nameMap(this.directory, [...best.map((b) => b.userId), ...risky.map((r) => r.userId)])
      const shownName = (userId: string): { userId: string; name: string } => {
        const visible = canSeeName(ctx.role, ctx.userId, userId, own)
        return { userId: visible ? userId : REDACTED_ID, name: nameFor(names.get(userId) ?? '', visible) }
      }
      topStudents = best.map(({ userId, t }) => ({
        ...shownName(userId),
        sessions: t.sessions,
        answered: t.answered,
        accuracy: accuracyOf(t.correct, t.answered),
      }))
      atRisk = risky.map(({ userId, t, accuracy }) => ({
        ...shownName(userId),
        className: classOf.get(userId) ?? '',
        answered: t?.answered ?? 0,
        accuracy,
        lastAnsweredAt: t?.last ? toMytTimestamp(t.last) : null,
      }))
    }

    return {
      code: level,
      name: LEVEL_NAMES[level],
      classes: lc.length,
      students: countOf(students, xsPupils),
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
}
