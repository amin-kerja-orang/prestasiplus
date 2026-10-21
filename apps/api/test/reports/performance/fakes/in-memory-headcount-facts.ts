import type {
  HeadcountEntryView,
  HeadcountFacts,
  HeadcountScope,
} from '../../../../src/modules/reports/performance/services/headcount-facts.types'

/** A headcount entry with neutral defaults (class 10, subject 1, school s1, teacher t1, two OTRs, nothing keyed). */
export function entry(over: Partial<HeadcountEntryView> & Pick<HeadcountEntryView, 'studentId'>): HeadcountEntryView {
  return {
    configId: '1',
    classroomId: '10',
    subjectId: '1',
    levelId: '10',
    schoolId: 's1',
    teacherId: 't1',
    configUpdatedAt: new Date('2026-09-01T10:00:00+08:00'),
    academicYear: 2026,
    activeOtrs: 2,
    tov: null,
    targets: [null, null],
    actuals: [null, null],
    etr: null,
    rs: null,
    rsRecordedAt: null,
    dropped: false,
    ...over,
  }
}

/** In-memory `HeadcountFacts`: filters by scope the way the real reader does and returns dropped entries too. */
export class InMemoryHeadcountFacts implements HeadcountFacts {
  private readonly rows: HeadcountEntryView[] = []

  add(...entries: HeadcountEntryView[]): this {
    this.rows.push(...entries)
    return this
  }

  private inScope(e: HeadcountEntryView, scope: HeadcountScope): boolean {
    if (scope.kind === 'platform') return true
    if (scope.kind === 'school') return e.schoolId === scope.schoolId
    return e.teacherId === scope.teacherId
  }

  async entriesOfStudent(studentId: string, scope: HeadcountScope): Promise<HeadcountEntryView[]> {
    return this.rows.filter((e) => e.studentId === studentId && this.inScope(e, scope))
  }
  async entriesOfClasses(classroomIds: readonly string[]): Promise<HeadcountEntryView[]> {
    return this.rows.filter((e) => classroomIds.includes(e.classroomId))
  }
  async entriesInScope(scope: HeadcountScope): Promise<HeadcountEntryView[]> {
    return this.rows.filter((e) => this.inScope(e, scope))
  }
}
