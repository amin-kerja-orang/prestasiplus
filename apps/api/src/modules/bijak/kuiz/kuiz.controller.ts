import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import {
  BijakKuizCheckRequestSchema,
  BijakKuizFinishRequestSchema,
  BijakKuizPaperQuerySchema,
  BijakKuizStartRequestSchema,
  type BijakKuizCheckRequest,
  type BijakKuizFinishRequest,
  type BijakKuizStartRequest,
} from '@pp/contract'
import type { Request } from 'express'

import { NoStoreInterceptor } from '../../../common/http'
import { Roles } from '../../../common/guards'
import { type RequestWithAuth, ScopeContext } from '../../../common/scope'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe'
import { BIJAK_KUIZ_LIMITS } from './kuiz.constants'
import { type KuizCaller, KuizService } from './kuiz.service'

type Req = Request & RequestWithAuth

function callerOf(req: Req): KuizCaller {
  const scope = ScopeContext.fromRequest(req)
  return { userId: scope.userId, isTest: scope.isTest }
}

/**
 * Bijak SPM Simulasi Kuiz (R1-B16). Student role only (an admin or school admin acts as a student only in Mod Pelajar and
 * what they write is test data); a teacher, parent or sponsor gets 403. CSRF on the POSTs is enforced by the session guard.
 * Answers are never cached. No response carries the answer key before the check.
 */
@Controller('bijak/kuiz')
@Roles('student')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class KuizController {
  constructor(@Inject(KuizService) private readonly kuiz: KuizService) {}

  @Post('sessions')
  @RateLimit(BIJAK_KUIZ_LIMITS.start)
  async start(@Req() req: Req, @Body(new ZodValidationPipe(BijakKuizStartRequestSchema)) body: BijakKuizStartRequest) {
    return { data: await this.kuiz.start(callerOf(req), body) }
  }

  @Post('sessions/:id/check')
  @HttpCode(200)
  @RateLimit(BIJAK_KUIZ_LIMITS.check)
  async check(@Req() req: Req, @Param('id') id: string, @Body(new ZodValidationPipe(BijakKuizCheckRequestSchema)) body: BijakKuizCheckRequest) {
    return { data: await this.kuiz.check(callerOf(req), id, body) }
  }

  @Post('sessions/:id/finish')
  @HttpCode(200)
  @RateLimit(BIJAK_KUIZ_LIMITS.finish)
  async finish(@Req() req: Req, @Param('id') id: string, @Body(new ZodValidationPipe(BijakKuizFinishRequestSchema)) body: BijakKuizFinishRequest) {
    return { data: await this.kuiz.finish(callerOf(req), id, body.timeSpent) }
  }

  @Get('papers/:id')
  @RateLimit(BIJAK_KUIZ_LIMITS.read)
  async paper(@Req() req: Req, @Param('id') id: string, @Query(new ZodValidationPipe(BijakKuizPaperQuerySchema)) query: { page?: number }) {
    return { data: await this.kuiz.paperPage(callerOf(req), id, query.page) }
  }

  @Post('papers/:id/check')
  @HttpCode(200)
  @RateLimit(BIJAK_KUIZ_LIMITS.check)
  async paperCheck(@Req() req: Req, @Param('id') id: string, @Body(new ZodValidationPipe(BijakKuizCheckRequestSchema)) body: BijakKuizCheckRequest) {
    return { data: await this.kuiz.paperCheck(callerOf(req), id, body) }
  }
}
