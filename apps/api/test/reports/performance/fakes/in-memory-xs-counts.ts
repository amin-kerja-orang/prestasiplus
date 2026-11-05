import { PRIMARY_SCHOOL_TYPES } from '../../../../src/modules/schools/schools.constants'
import type { XsCountedPupils, XsCountsPort, XsCountsScope } from '../../../../src/modules/reports/performance/ports'
import type { InMemoryDirectory } from './in-memory-directory'

/**
 * In-memory `XsCountsPort` over the fake directory: the XS-1 and XS-3 rules of `school-admin/xs-queries.ts` written out once for the
 * fixtures (R1 `docs/prd/r1/20-guru-admin-sekolah.md` section 5, `50-data-model-erd.md` section 5.3).
 *
 * - XS-1: holds the student role, active, not suspended, `grade` 7..11, has a school; platform leaves out primary-school pupils (D72).
 * - XS-3: a teacher of the school, approved (not pending), active, not suspended, not a school admin.
 */
export class InMemoryXsCounts implements XsCountsPort {
  constructor(private readonly directory: InMemoryDirectory) {}

  async pupils(scope: XsCountsScope): Promise<XsCountedPupils> {
    const primary = new Set(this.directory.schoolList.filter((s) => (PRIMARY_SCHOOL_TYPES as readonly string[]).includes(s.type)).map((s) => s.id))
    const ids = this.directory.pupilList
      .filter(
        (p) =>
          p.isStudent &&
          p.isActive &&
          p.isSuspended !== true &&
          p.grade !== null &&
          p.grade >= 7 &&
          p.grade <= 11 &&
          p.schoolId !== null &&
          (scope.kind === 'school' ? p.schoolId === scope.schoolId : !primary.has(p.schoolId)),
      )
      .map((p) => p.id)
      .sort(compareIds)
    return { count: ids.length, ids }
  }

  async teachers(schoolId: string): Promise<XsCountedPupils> {
    const ids = this.directory.teacherList
      .filter((t) => t.schoolId === schoolId && t.pending !== true && t.isActive !== false && t.isSuspended !== true && t.isSchoolAdmin !== true)
      .map((t) => t.id)
      .sort(compareIds)
    return { count: ids.length, ids }
  }

  async teacherCount(schoolId: string): Promise<number> {
    return (await this.teachers(schoolId)).count
  }
}

/** Numeric ids by value (the table's bigint order); the unit fixtures' symbolic ids (`s1-p2`) fall back to text order. */
function compareIds(a: string, b: string): number {
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) return BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0
  return a < b ? -1 : a > b ? 1 : 0
}
