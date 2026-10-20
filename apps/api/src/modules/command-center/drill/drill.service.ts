import { Inject, Injectable } from '@nestjs/common'
import type {
  CommandCenterClass,
  CommandCenterHeadcountDetail,
  CommandCenterSchool,
  CommandCenterSessionDetail,
  CommandCenterSessionList,
  CommandCenterStudent,
  CommandCenterTeacher,
} from '@pp/contract'

import { CLOCK, type Clock } from '../../../db/clock'
import { notImplemented } from '../http/errors'
import type { Viewer } from '../http/viewer'
import { CommandCenterRepository } from '../shared/command-center.repository'
import { ScopeService } from '../shared/scope.service'

/**
 * DRILL slice (routes 4 to 11). OWNER: drill implementer. Every method starts with `const scope = await this.scopes.scopeOf(viewer)`
 * and the matching `assert*InScope` (404 on a miss) BEFORE any other validation (the week range is checked after scope).
 * Add builders as `drill/*.builder.ts`; the headcount detail uses `HEADCOUNT_PORT` (404 while it answers null).
 */
@Injectable()
export class DrillService {
  constructor(
    @Inject(CommandCenterRepository) readonly repo: CommandCenterRepository,
    @Inject(ScopeService) readonly scopes: ScopeService,
    @Inject(CLOCK) readonly clock: Clock,
  ) {}

  async school(viewer: Viewer, schoolId: string): Promise<CommandCenterSchool> {
    void viewer
    void schoolId
    return notImplemented('GET /command-center/school/:id')
  }

  async teacher(viewer: Viewer, schoolId: string, teacherId: string): Promise<CommandCenterTeacher> {
    void viewer
    void schoolId
    void teacherId
    return notImplemented('GET /command-center/school/:sid/teacher/:uid')
  }

  async classroom(viewer: Viewer, classId: string): Promise<CommandCenterClass> {
    void viewer
    void classId
    return notImplemented('GET /command-center/classroom/:id')
  }

  async headcount(viewer: Viewer, configId: string): Promise<CommandCenterHeadcountDetail> {
    void viewer
    void configId
    return notImplemented('GET /command-center/headcount/:configId')
  }

  async student(viewer: Viewer, studentId: string): Promise<CommandCenterStudent> {
    void viewer
    void studentId
    return notImplemented('GET /command-center/student/:id')
  }

  /** `code` is trimmed or undefined; unknown or absent code = empty list (200). */
  async studentSubject(viewer: Viewer, studentId: string, code: string | undefined): Promise<CommandCenterSessionList> {
    void viewer
    void studentId
    void code
    return notImplemented('GET /command-center/student/:id/subject')
  }

  /** `start`/`end` are the raw query values: call `dateRangeOf(start, end)` from `http/request.ts` after the scope check. */
  async studentWeek(viewer: Viewer, studentId: string, start: unknown, end: unknown): Promise<CommandCenterSessionList> {
    void viewer
    void studentId
    void start
    void end
    return notImplemented('GET /command-center/student/:id/week')
  }

  /** `sessionId` is '' when the path text is not a valid id shape (404). */
  async session(viewer: Viewer, sessionId: string): Promise<CommandCenterSessionDetail> {
    void viewer
    void sessionId
    return notImplemented('GET /command-center/session/:sessionId')
  }
}
