import { Controller, Get, Inject, Param, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common'

import { Roles } from '../../../common/guards/decorators'
import { NoStoreInterceptor, ok } from '../../../common/http'
import type { RequestWithAuth } from '../../../common/scope/auth-context'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { COMMAND_CENTER_READ } from '../command-center.constants'
import { ConditionalGetInterceptor } from '../http/etag.interceptor'
import { overloadTo429, SafeIdPipe, SessionIdPipe, subjectCodeOf } from '../http/request'
import { viewerOf } from '../http/viewer'
import { DrillService } from './drill.service'

/**
 * Drill-down routes 4 to 11 under `/command-center`. Admin, teacher and school admin (a school admin without a school is 403).
 * Every scope miss is a 404 "Not Found." from the service. Bodies are `{ data }`; every answer is `no-store` with a weak ETag.
 * OWNER: drill implementer (this file and `drill.service.ts`).
 */
@Controller('command-center')
@Roles('admin', 'teacher', 'school_admin')
@UseGuards(RateLimitGuard)
@RateLimit(COMMAND_CENTER_READ)
@UseInterceptors(NoStoreInterceptor, ConditionalGetInterceptor)
export class DrillController {
  constructor(@Inject(DrillService) private readonly drill: DrillService) {}

  @Get('school/:id')
  async school(@Req() req: RequestWithAuth, @Param('id', SafeIdPipe) id: string) {
    const viewer = viewerOf(req)
    return ok(await overloadTo429(() => this.drill.school(viewer, id)))
  }

  @Get('school/:sid/teacher/:uid')
  async teacher(@Req() req: RequestWithAuth, @Param('sid', SafeIdPipe) sid: string, @Param('uid', SafeIdPipe) uid: string) {
    const viewer = viewerOf(req)
    return ok(await overloadTo429(() => this.drill.teacher(viewer, sid, uid)))
  }

  @Get('classroom/:id')
  async classroom(@Req() req: RequestWithAuth, @Param('id', SafeIdPipe) id: string) {
    const viewer = viewerOf(req)
    return ok(await overloadTo429(() => this.drill.classroom(viewer, id)))
  }

  @Get('headcount/:configId')
  async headcount(@Req() req: RequestWithAuth, @Param('configId', SafeIdPipe) configId: string) {
    const viewer = viewerOf(req)
    return ok(await overloadTo429(() => this.drill.headcount(viewer, configId)))
  }

  /** Declared before `student/:id` is irrelevant (different segment counts), but `subject` and `week` stay literal segments. */
  @Get('student/:id')
  async student(@Req() req: RequestWithAuth, @Param('id', SafeIdPipe) id: string) {
    const viewer = viewerOf(req)
    return ok(await overloadTo429(() => this.drill.student(viewer, id)))
  }

  @Get('student/:id/subject')
  async studentSubject(@Req() req: RequestWithAuth, @Param('id', SafeIdPipe) id: string, @Query('code') code?: unknown) {
    const viewer = viewerOf(req)
    return ok(await overloadTo429(() => this.drill.studentSubject(viewer, id, subjectCodeOf(code))))
  }

  @Get('student/:id/week')
  async studentWeek(@Req() req: RequestWithAuth, @Param('id', SafeIdPipe) id: string, @Query('start') start?: unknown, @Query('end') end?: unknown) {
    const viewer = viewerOf(req)
    return ok(await overloadTo429(() => this.drill.studentWeek(viewer, id, start, end)))
  }

  @Get('session/:sessionId')
  async session(@Req() req: RequestWithAuth, @Param('sessionId', SessionIdPipe) sessionId: string) {
    const viewer = viewerOf(req)
    return ok(await overloadTo429(() => this.drill.session(viewer, sessionId)))
  }
}
