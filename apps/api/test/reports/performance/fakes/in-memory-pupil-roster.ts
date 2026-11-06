import type { PupilRosterPort, PupilRosterScope } from '../../../../src/modules/reports/performance/ports'
import type { InMemoryDirectory } from './in-memory-directory'

/**
 * In-memory `PupilRosterPort` mirroring XS-1 (`XS_PUPIL_SQL`): a student account, active, not suspended, Tingkatan 1-5 (grade 7..11).
 * A school scope also limits to the school; a teacher scope is not narrowed here (the service intersects with the class members).
 */
export class InMemoryPupilRoster implements PupilRosterPort {
  constructor(private readonly directory: InMemoryDirectory) {}

  async xsPupilIds(scope: PupilRosterScope): Promise<string[]> {
    const ids = scope.kind === 'school' ? await this.directory.pupilIdsOfSchool(scope.schoolId) : this.directory.allPupilIds()
    const users = await this.directory.users(ids)
    return ids.filter((id) => {
      const u = users.get(id)
      return u !== undefined && u.isStudent && u.isActive && u.isSuspended !== true && u.grade !== null && u.grade >= 7 && u.grade <= 11
    })
  }
}
