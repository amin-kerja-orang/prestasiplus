import { Inject, Injectable } from '@nestjs/common'

import { PerformancePorts } from '../ports'
import type { HeadcountEntryView, HeadcountFacts, HeadcountScope } from '../services/headcount-facts.types'
import { autoArOf, withAutoAr } from './headcount.auto-ar'
import { HeadcountRepository, type HeadcountConfigRecord, type HeadcountEntryRecord } from './headcount.repository'
import { resolveMarks } from './headcount.rules'

/**
 * Reader of the headcount entries for the other performance reports (Part D: GPS, on track / below, at risk).
 * Dropped entries ARE returned (flag `dropped`); the readers leave them out of every count. Set-based: a fixed number of
 * statements whatever the number of configs. No privacy rule lives here: the caller applies cohort and name rules.
 * Marks come from the same assembler as the headcount screens (`resolveMarks`: class defaults, computed OTR targets) and an
 * Auto config reads its AR from the answer store, so every report agrees with the teacher's table (HC-SPEC, FR-GUR-3-8).
 */
@Injectable()
export class HeadcountFactsService implements HeadcountFacts {
  constructor(
    @Inject(HeadcountRepository) private readonly repo: HeadcountRepository,
    @Inject(PerformancePorts) private readonly ports: PerformancePorts,
  ) {}

  async entriesInScope(scope: HeadcountScope): Promise<HeadcountEntryView[]> {
    const configs = await this.configsOf(scope)
    return this.views(configs, await this.repo.entriesOf(configs))
  }

  async entriesOfClasses(classroomIds: readonly string[]): Promise<HeadcountEntryView[]> {
    const configs = await this.repo.configsOfClassrooms(classroomIds)
    return this.views(configs, await this.repo.entriesOf(configs))
  }

  async entriesOfStudent(studentId: string, scope: HeadcountScope, classYear: number): Promise<HeadcountEntryView[]> {
    // The configs holding an entry row (any year) AND those of the pupil's own classes for `classYear` (the current MYT year): a
    // config needs no entry row to be the pupil's, as in `GET /headcounts/me` and in the teacher's class table (roster = class
    // members). The pupil then reads the class defaults and the live Auto AR. This holds for staff too (AC-CHAIN-5: an Auto pupil
    // with no entry row had no card). Membership is today's, so a class config of another year is not derived from it (a pupil who
    // joined this year gets no previous-year card); staff stay limited to the configs of their scope below.
    const classIds = (await this.ports.classes.classIdsOfStudent(studentId)) ?? []
    const byEntry = await this.repo.configsByIds(await this.repo.configIdsOfStudent(studentId))
    const byClass = classIds.length === 0 ? [] : (await this.repo.configsOfClassrooms(classIds)).filter((c) => c.academicYear === classYear)
    const mine = [...new Map([...byEntry, ...byClass].map((c) => [c.id, c])).values()]
    let visible: HeadcountConfigRecord[]
    if (scope.kind === 'platform') visible = mine
    else if (scope.kind === 'teacher') visible = mine.filter((c) => c.teacherId === scope.teacherId)
    else {
      const schools = await this.repo.schoolOfConfigs(mine)
      visible = mine.filter((c) => schools.get(c.id) === scope.schoolId)
    }
    return this.views(visible, await this.repo.entriesOfStudent(studentId, visible), studentId, new Set(classIds))
  }

  private configsOf(scope: HeadcountScope): Promise<HeadcountConfigRecord[]> {
    if (scope.kind === 'platform') return this.repo.allConfigs()
    if (scope.kind === 'school') return this.repo.configsOfSchool(scope.schoolId)
    return this.repo.configsOfTeacher(scope.teacherId)
  }

  /**
   * Entry views. An Auto config also lists its class members that hold no entry row (their AR comes from the answer store
   * and they count like the pupils of the teacher's table); a Manual config lists entry rows only.
   * `onlyStudentId` (the per-student path) limits the roster expansion to that pupil, so classmates never leak; there a config
   * of one of the pupil's own classes (`memberOf`) is listed in either mode even with no entry row (like `GET /headcounts/me`).
   */
  private async views(
    configs: readonly HeadcountConfigRecord[],
    found: readonly HeadcountEntryRecord[],
    onlyStudentId?: string,
    memberOf: ReadonlySet<string> = new Set(),
  ): Promise<HeadcountEntryView[]> {
    const byId = new Map(configs.map((c) => [c.id, c]))
    const autoConfigs = configs.filter((c) => c.mode === 'auto')
    const members = autoConfigs.length === 0 ? new Map<string, string[]>() : await this.ports.classes.membersOf([...new Set(autoConfigs.map((c) => c.classroomId))])
    const entries: HeadcountEntryRecord[] = onlyStudentId === undefined ? [...found] : found.filter((e) => e.studentId === onlyStudentId)
    const have = new Set(found.map((e) => `${e.configId}:${e.studentId}`))
    for (const c of autoConfigs) {
      for (const studentId of members.get(c.classroomId) ?? []) {
        if (onlyStudentId !== undefined && studentId !== onlyStudentId) continue
        if (!have.has(`${c.id}:${studentId}`)) {
          entries.push({ configId: c.id, studentId, marks: resolveMarks(null, c), rsRecordedAt: null, dropped: false, own: { tov: null, etr: null } })
        }
      }
    }
    if (onlyStudentId !== undefined) {
      for (const c of configs) {
        if (c.mode === 'auto' || !memberOf.has(c.classroomId) || have.has(`${c.id}:${onlyStudentId}`)) continue
        entries.push({ configId: c.id, studentId: onlyStudentId, marks: resolveMarks(null, c), rsRecordedAt: null, dropped: false, own: { tov: null, etr: null } })
      }
    }
    if (entries.length === 0) return []
    const rosterOf = new Map<string, string[]>()
    for (const e of entries) rosterOf.set(e.configId, [...(rosterOf.get(e.configId) ?? []), e.studentId])
    const auto = await autoArOf(this.ports, autoConfigs, (id) => rosterOf.get(id) ?? [])
    const schools = await this.repo.schoolOfConfigs(configs)
    const subjects = await this.repo.subjectNames(configs.map((c) => c.subjectId))
    return entries.flatMap((e): HeadcountEntryView[] => {
        const c = byId.get(e.configId)
        if (!c) return []
        const marks = c.mode === 'auto' ? withAutoAr(e.marks, auto.get(c.id)?.get(e.studentId) ?? null) : e.marks
        return [
          {
            configId: c.id,
            studentId: e.studentId,
            classroomId: c.classroomId,
            subjectId: c.subjectId,
            ...(subjects.has(c.subjectId) ? { subjectName: subjects.get(c.subjectId) as string } : {}),
            levelId: c.educationLevelId,
            schoolId: schools.get(c.id) ?? null,
            teacherId: c.teacherId,
            configUpdatedAt: c.updatedAt,
            academicYear: c.academicYear,
            activeOtrs: c.activeOtrs,
            tov: marks.tov,
            targets: marks.targets,
            actuals: marks.actuals,
            etr: marks.etr,
            rs: marks.rs,
            rsRecordedAt: e.rsRecordedAt,
            dropped: e.dropped,
          },
        ]
      })
  }
}
