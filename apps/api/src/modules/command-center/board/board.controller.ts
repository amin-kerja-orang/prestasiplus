import { Controller, Get, Inject, Param, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common'

import { Roles } from '../../../common/guards/decorators'
import { NoStoreInterceptor, ok } from '../../../common/http'
import type { RequestWithAuth } from '../../../common/scope/auth-context'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { COMMAND_CENTER_READ } from '../command-center.constants'
import { ConditionalGetInterceptor } from '../http/etag.interceptor'
import { overloadTo429, periodOf, SafeIdPipe } from '../http/request'
import { viewerOf } from '../http/viewer'
import { BoardService } from './board.service'

/**
 * Admin / school board routes (1, 2, 3, 18). `@Roles` gives 403 to other roles; the school of a school admin comes from the
 * session only (a `?schoolId=` is never read). Bodies are `{ data }`. Every answer is `no-store` with a weak ETag (304 on a match).
 * OWNER: board implementer (this file and `board.service.ts`).
 */
@Controller()
@Roles('admin', 'school_admin')
@UseGuards(RateLimitGuard)
@RateLimit(COMMAND_CENTER_READ)
@UseInterceptors(NoStoreInterceptor, ConditionalGetInterceptor)
export class BoardController {
  constructor(@Inject(BoardService) private readonly board: BoardService) {}

  @Get('admin/command-center/live-data')
  async liveData(@Req() req: RequestWithAuth) {
    const viewer = viewerOf(req)
    return ok(await overloadTo429(() => this.board.liveData(viewer)))
  }

  @Get('command-center/daily-activity')
  async dailyActivity(@Req() req: RequestWithAuth, @Query('period') period?: unknown) {
    const viewer = viewerOf(req)
    return ok(await overloadTo429(() => this.board.dailyActivity(viewer, periodOf(period))))
  }

  /** Admin only: a school admin or teacher is 403, an unknown school 404. */
  @Get('command-center/daily-activity/school/:id')
  @Roles('admin')
  async schoolDrill(@Req() req: RequestWithAuth, @Param('id', SafeIdPipe) id: string, @Query('period') period?: unknown) {
    const viewer = viewerOf(req)
    return ok(await overloadTo429(() => this.board.schoolDrill(viewer, id, periodOf(period))))
  }

  /** Admin only. Host readings, no secrets. */
  @Get('admin/server-status')
  @Roles('admin')
  async serverStatus() {
    return ok(await this.board.serverStatus())
  }
}
