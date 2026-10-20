import { Body, Controller, Get, HttpCode, Inject, Param, Put, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import { ok } from '../../../../common/http/respond'
import { type RequestWithAuth, ScopeContext } from '../../../../common/scope'
import { RateLimit, RateLimitGuard } from '../../../../common/throttle'
import { READS_WRITE_LIMITS, MESSAGES } from './rules'
import { StructuredService } from './structured.service'
import { SpmTargetsService } from './targets.service'

type Req = Request & RequestWithAuth

const callerOf = (req: Req) => {
  const scope = ScopeContext.fromRequest(req)
  return { userId: scope.userId, isTest: scope.isTest }
}

/**
 * SPM targets (S15, #18 and #19). Any signed-in role, always the caller's own targets. The default-deny
 * guard answers 401 without a session and the global CSRF guard answers 403 on the PUT without the token.
 */
@Controller('spm-targets')
@UseGuards(RateLimitGuard)
export class SpmTargetsController {
  constructor(@Inject(SpmTargetsService) private readonly targets: SpmTargetsService) {}

  @Get()
  async list(@Req() req: Req) {
    return ok(await this.targets.list(callerOf(req)))
  }

  @Put()
  @HttpCode(200)
  @RateLimit(READS_WRITE_LIMITS.targets)
  async save(@Body() body: unknown, @Req() req: Req) {
    const saved = await this.targets.save(callerOf(req), body)
    // The flash message is a sibling of `data`, as the mock sends it.
    return { data: saved, status: MESSAGES.targetsSaved }
  }
}

/** Structured questions (S10, Q3, #15 to #17). Any signed-in role; the attempt is stored for the caller only. */
@Controller('practice/structured')
@UseGuards(RateLimitGuard)
export class StructuredController {
  constructor(@Inject(StructuredService) private readonly structured: StructuredService) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    return this.structured.list(query)
  }

  @Get(':id')
  async detail(@Param('id') id: string, @Query() query: Record<string, unknown>) {
    return ok(await this.structured.detail(id, query))
  }

  @Post(':id/attempts')
  @HttpCode(201)
  @RateLimit(READS_WRITE_LIMITS.attempts)
  async attempt(@Param('id') id: string, @Body() body: unknown, @Req() req: Req) {
    return ok(await this.structured.attempt(callerOf(req), id, body))
  }
}
