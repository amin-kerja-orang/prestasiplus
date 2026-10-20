import { Inject, Injectable } from '@nestjs/common'

import type { HeadcountEntryView, HeadcountFacts, HeadcountScope } from '../services/headcount-facts.types'
import { HeadcountRepository, type HeadcountConfigRecord, type HeadcountEntryRecord } from './headcount.repository'

/**
 * Reader of the headcount entries for the other performance reports (Part D: GPS, on track / below, at risk).
 * Dropped entries ARE returned (flag `dropped`); the readers leave them out of every count. Set-based: a fixed number of
 * statements whatever the number of configs. No privacy rule lives here: the caller applies cohort and name rules.
 */
@Injectable()
export class HeadcountFactsService implements HeadcountFacts {
  constructor(@Inject(HeadcountRepository) private readonly repo: HeadcountRepository) {}

  async entriesInScope(scope: HeadcountScope): Promise<HeadcountEntryView[]> {
    const configs = await this.configsOf(scope)
    return this.views(configs, await this.repo.entriesOf(configs))
  }

  async entriesOfClasses(classroomIds: readonly string[]): Promise<HeadcountEntryView[]> {
    const configs = await this.repo.configsOfClassrooms(classroomIds)
    return this.views(configs, await this.repo.entriesOf(configs))
  }

  async entriesOfStudent(studentId: string, scope: HeadcountScope): Promise<HeadcountEntryView[]> {
    const mine = await this.repo.configsByIds(await this.repo.configIdsOfStudent(studentId))
    let visible: HeadcountConfigRecord[]
    if (scope.kind === 'platform') visible = mine
    else if (scope.kind === 'teacher') visible = mine.filter((c) => c.teacherId === scope.teacherId)
    else {
      const schools = await this.repo.schoolOfConfigs(mine)
      visible = mine.filter((c) => schools.get(c.id) === scope.schoolId)
    }
    return this.views(visible, await this.repo.entriesOfStudent(studentId, visible))
  }

  private configsOf(scope: HeadcountScope): Promise<HeadcountConfigRecord[]> {
    if (scope.kind === 'platform') return this.repo.allConfigs()
    if (scope.kind === 'school') return this.repo.configsOfSchool(scope.schoolId)
    return this.repo.configsOfTeacher(scope.teacherId)
  }

  private async views(configs: readonly HeadcountConfigRecord[], entries: readonly HeadcountEntryRecord[]): Promise<HeadcountEntryView[]> {
    if (entries.length === 0) return []
    const byId = new Map(configs.map((c) => [c.id, c]))
    const schools = await this.repo.schoolOfConfigs(configs)
    return entries.flatMap((e): HeadcountEntryView[] => {
      const c = byId.get(e.configId)
      if (!c) return []
      return [
        {
          configId: c.id,
          studentId: e.studentId,
          classroomId: c.classroomId,
          subjectId: c.subjectId,
          levelId: c.educationLevelId,
          schoolId: schools.get(c.id) ?? null,
          teacherId: c.teacherId,
          configUpdatedAt: c.updatedAt,
          academicYear: c.academicYear,
          activeOtrs: c.activeOtrs,
          tov: e.marks.tov,
          targets: e.marks.targets,
          actuals: e.marks.actuals,
          etr: e.marks.etr,
          rs: e.marks.rs,
          rsRecordedAt: e.rsRecordedAt,
          dropped: e.dropped,
        },
      ]
    })
  }
}
