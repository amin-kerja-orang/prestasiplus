import { Inject, Injectable } from '@nestjs/common'

import { ClassesRepository } from '../classes'
import type { SchoolClassCountPort } from './school-admin.ports'

/**
 * `SCHOOL_CLASS_COUNT_PORT` over BE-17: the ACTIVE classes (classroom and school_class kinds) of one school, read through
 * `ClassesRepository.schoolClasses`, the same rows and the same `isActive` filter BE-19's classes port uses for its frame.
 * The caller passes the school admin's own school; nothing here reads a request.
 */
@Injectable()
export class SchoolClassesAdapter implements SchoolClassCountPort {
  constructor(@Inject(ClassesRepository) private readonly classes: ClassesRepository) {}

  async activeClasses(schoolId: string): Promise<number> {
    return (await this.classes.schoolClasses(schoolId)).filter((c) => c.isActive).length
  }
}
