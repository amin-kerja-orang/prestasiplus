import { Controller, Get, Param, Query, UseGuards, UseInterceptors } from '@nestjs/common'
import { ExistingStudentsQuerySchema, StudentSearchQuerySchema } from '@pp/contract'
import type { z } from 'zod'

import { Roles } from '../../common/guards/decorators'
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe'
import { CurrentCaller, type Caller } from './caller'
import { NoStoreInterceptor } from '../../common/http'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { USER_LIMITS } from './users.constants'
import { UsersService } from './users.service'

/**
 * Lookups on user data (student picker, teachers, students of a school). All personal data of
 * minors or staff: `no-store`, rate limited per user, scoped by the caller's role.
 */
@Controller()
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class LookupsController {
  constructor(private readonly users: UsersService) {}

  /** Staff only: student, teacher, school_admin and admin; a student, parent or sponsor gets 403. */
  @Get('students/search')
  @Roles('admin', 'school_admin', 'teacher')
  @RateLimit(USER_LIMITS.read)
  async searchStudents(
    @CurrentCaller() caller: Caller,
    @Query(new ZodValidationPipe(StudentSearchQuerySchema)) query: z.infer<typeof StudentSearchQuerySchema>,
  ) {
    return { data: await this.users.searchStudents(caller, query.q) }
  }

  @Get('admin/teachers')
  @Roles('admin', 'school_admin')
  @RateLimit(USER_LIMITS.read)
  async teachers(@CurrentCaller() caller: Caller) {
    return { data: await this.users.teachers(caller) }
  }

  /** `[]` for now: the classes table arrives with BE-17 (mock shape, no 404 for an unknown teacher). */
  @Get('admin/teachers/:id/classrooms')
  @Roles('admin', 'school_admin')
  @RateLimit(USER_LIMITS.read)
  classrooms() {
    return { data: [] as never[] }
  }

  @Get('admin/schools/:id/students')
  @Roles('admin', 'school_admin')
  @RateLimit(USER_LIMITS.read)
  async schoolStudents(
    @CurrentCaller() caller: Caller,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(ExistingStudentsQuerySchema)) query: z.infer<typeof ExistingStudentsQuerySchema>,
  ) {
    return { data: await this.users.schoolStudents(caller, id, query.search, query.classLevel) }
  }
}
