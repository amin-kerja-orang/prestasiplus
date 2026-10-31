import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import { BijakGenerateRequestSchema, type BijakGenerateRequest } from '@pp/contract'
import type { Request } from 'express'

import { NoStoreInterceptor } from '../../../common/http'
import { Roles } from '../../../common/guards'
import { type RequestWithAuth, ScopeContext } from '../../../common/scope'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe'
import { BIJAK_PAPERS_LIMITS } from './papers.constants'
import { PapersService } from './papers.service'

type Req = Request & RequestWithAuth

/**
 * Bijak SPM papers (BE-15). Student role only: an admin or school admin reaches these routes only in
 * Mod Pelajar, where the session acts as a student and what it writes is test data. A teacher,
 * parent or sponsor gets 403 (D43, AC-01.4). CSRF on the POST is enforced by the session guard.
 * Responses carry no answer key, scheme or question id and are never cached.
 */
@Controller('bijak')
@Roles('student')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class PapersController {
  constructor(@Inject(PapersService) private readonly papers: PapersService) {}

  @Get('papers')
  @RateLimit(BIJAK_PAPERS_LIMITS.read)
  async list(@Req() req: Req) {
    return { data: await this.papers.listPapers(ScopeContext.fromRequest(req).userId) }
  }

  @Get('papers/:id')
  @RateLimit(BIJAK_PAPERS_LIMITS.read)
  async cover(@Req() req: Req, @Param('id') id: string) {
    return { data: await this.papers.getCover(ScopeContext.fromRequest(req).userId, id) }
  }

  @Get('contracts')
  @RateLimit(BIJAK_PAPERS_LIMITS.read)
  async contracts() {
    return { data: await this.papers.listContracts() }
  }

  @Get('subjects')
  @RateLimit(BIJAK_PAPERS_LIMITS.read)
  async subjects() {
    return { data: await this.papers.subjects() }
  }

  @Post('papers/generate')
  @RateLimit(BIJAK_PAPERS_LIMITS.generate)
  async generate(@Req() req: Req, @Body(new ZodValidationPipe(BijakGenerateRequestSchema)) body: BijakGenerateRequest) {
    const scope = ScopeContext.fromRequest(req)
    const canUseSpec = scope.isTest && scope.auth.roles.some((g) => g.role === 'admin')
    return { data: await this.papers.generate({ userId: scope.userId, isTest: scope.isTest, canUseSpec }, body) }
  }
}
