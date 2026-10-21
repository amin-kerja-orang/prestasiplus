import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Request } from 'express'

import { NoStoreInterceptor } from '../../common/http/no-store.interceptor'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { ok } from '../../common/http/respond'
import { type RequestWithAuth, ScopeContext } from '../../common/scope'
import { SPM_LIMITS } from './config'
import { type MockCaller, SpmMockService } from './mock.service'

type Req = Request & RequestWithAuth

function callerOf(req: Req): MockCaller {
  const scope = ScopeContext.fromRequest(req)
  return { userId: scope.userId, isTest: scope.isTest }
}

/**
 * SPM mock exams (M06-08 to M06-12). Any signed-in role; only the owner opens a mock (anyone else gets 404).
 * Every answer is `Cache-Control: no-store` (the result carries the keys). The platform throttler defaults apply;
 * no module limit is built (open question 10).
 */
@Controller('spm-mocks')
@UseInterceptors(NoStoreInterceptor)
export class SpmMocksController {
  constructor(@Inject(SpmMockService) private readonly mocks: SpmMockService) {}

  @Get()
  async list(@Req() req: Req) {
    return ok(await this.mocks.list(callerOf(req)))
  }

  @Post()
  @UseGuards(RateLimitGuard)
  @RateLimit(SPM_LIMITS.mockCreate)
  async create(@Body() body: unknown, @Req() req: Req) {
    return ok(await this.mocks.create(callerOf(req), body))
  }

  @Get(':id')
  async view(@Param('id') id: string, @Req() req: Req) {
    return ok(await this.mocks.view(callerOf(req), id))
  }

  @Post(':id/submit')
  @HttpCode(200)
  async submit(@Param('id') id: string, @Body() body: unknown, @Req() req: Req) {
    return ok(await this.mocks.submit(callerOf(req), id, body))
  }

  @Get(':id/result')
  async result(@Param('id') id: string, @Req() req: Req) {
    return ok(await this.mocks.result(callerOf(req), id))
  }
}
