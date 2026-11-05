import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common'
import { FlagDismissRequestSchema, RegroupRequestSchema, RegroupWorklistQuerySchema } from '@pp/contract'

import { Roles } from '../../../common/guards'
import { NoStoreInterceptor } from '../../../common/http'
import { ApiError } from '../../../common/errors/api-error'
import { listMeta, ok } from '../../../common/http/respond'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { isIdString } from '../../../db/ids'
import { RegroupService } from '../regroup.service'
import { Actor, type HttpActor } from './actor'
import { QUESTIONS_WRITE_LIMIT } from './admin.controller'
import { parseBody, parseQuery } from './parse'
import { SERVABILITY_READ_LIMIT } from './servability.controller'

/**
 * S1-T07 (60 section 2.17.4): "Bukan masalah" (API-Q-12), the regroup work-list (API-Q-13), the regroup (API-Q-24) and its undo (API-Q-36).
 * Admin Pusat only; CSRF on every mutation by the session guard; writes share the question write bucket, the read the servability read bucket.
 * The paths sit under `admin/questions`, apart from the `questions/:id` routes of the admin controller.
 */
@Roles('admin')
@Controller('admin/questions')
@UseGuards(RateLimitGuard)
export class RegroupController {
  constructor(@Inject(RegroupService) private readonly regroup: RegroupService) {}

  @Get('regroup-worklist')
  @UseInterceptors(NoStoreInterceptor)
  @RateLimit(SERVABILITY_READ_LIMIT)
  async worklist(@Query() query: unknown) {
    const q = parseQuery(RegroupWorklistQuerySchema, query)
    const res = await this.regroup.worklist({ subjectId: q.subjectId, educationLevelId: q.educationLevelId ?? q.levelId, flag: q.flag, page: q.page, pageSize: q.pageSize })
    return { data: res.rows, meta: { ...listMeta(q.page, q.pageSize, res.total), counts: res.counts } }
  }

  @Post('regroup')
  @HttpCode(200)
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async regroupQuestions(@Actor() actor: HttpActor, @Body() body: unknown) {
    const res = await this.regroup.regroup(parseBody(RegroupRequestSchema, body), actor)
    return { data: res.group, meta: { auditId: res.auditId } }
  }

  @Post('regroup/:auditId/undo')
  @HttpCode(200)
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async undo(@Actor() actor: HttpActor, @Param('auditId') auditId: string) {
    if (!isIdString(auditId)) throw ApiError.of('NOT_FOUND')
    return ok(await this.regroup.undo(auditId, actor))
  }

  @Post(':id/flags/dismiss')
  @HttpCode(200)
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async dismiss(@Actor() actor: HttpActor, @Param('id') id: string, @Body() body: unknown) {
    if (!isIdString(id)) throw ApiError.of('NOT_FOUND')
    return ok(await this.regroup.dismiss(id, parseBody(FlagDismissRequestSchema, body).flag, actor))
  }
}
