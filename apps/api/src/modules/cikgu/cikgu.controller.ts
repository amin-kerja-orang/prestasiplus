import { Body, Controller, Get, HttpCode, Param, Post, Query, Res, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common'
import { CIKGU_MESSAGE_TOO_LONG, CIKGU_PBD_CSV_FILENAME } from '@pp/contract'
import type { Response } from 'express'

import { Roles } from '../../common/guards/decorators'
import { NoStoreInterceptor, ok } from '../../common/http'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { Actor } from './actor'
import { ChatRawErrorFilter } from './chat-error.filter'
import { CIKGU_LIMITS } from './cikgu.constants'
import { CikguService, type CikguActor } from './cikgu.service'

/**
 * `POST /api/cikgu/send` (S1): any signed-in role. RAW bodies (no `{data}` envelope, snake_case), as the live site:
 * 200 `{thread_id, reply, tier, turns_remaining, tool_hops, tokens}`, 401 `{}`, 422 `{}`, 429 `{"quota_exhausted":true}`.
 * Every answer is `no-store` (the text is a minor's). See `ChatRawErrorFilter` for the other raw errors.
 */
@Controller('cikgu')
@UseFilters(ChatRawErrorFilter)
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class CikguChatController {
  constructor(private readonly cikgu: CikguService) {}

  @Post('send')
  @HttpCode(200)
  @RateLimit(CIKGU_LIMITS.send)
  async send(@Actor() actor: CikguActor, @Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const out = await this.cikgu.send(actor, body)
    switch (out.kind) {
      case 'blank':
        res.status(422)
        return {}
      case 'too_long':
        res.status(422)
        return { error: CIKGU_MESSAGE_TOO_LONG, code: 'VALIDATION_ERROR' }
      case 'quota':
        res.status(429)
        return { quota_exhausted: true }
      case 'ok':
        return out.body
    }
  }
}

/**
 * The nine teacher tools (T2 to T10): role `teacher` or `admin` (guest 401, any other role 403). Every answer is
 * `no-store` (class names, essays, pupils' names and scores); reads and writes are rate limited per user (D57).
 */
@Controller('cikgu')
@Roles('teacher', 'admin')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class CikguToolsController {
  constructor(private readonly cikgu: CikguService) {}

  @Get('rph')
  @RateLimit(CIKGU_LIMITS.read)
  listRph(@Actor() actor: CikguActor, @Query() query: Record<string, unknown>) {
    return this.cikgu.listRph(actor, query)
  }

  @Post('rph')
  @RateLimit(CIKGU_LIMITS.write)
  async createRph(@Actor() actor: CikguActor, @Body() body: unknown) {
    return ok(await this.cikgu.createRph(actor, body))
  }

  @Get('rph/:id')
  @RateLimit(CIKGU_LIMITS.read)
  async getRph(@Actor() actor: CikguActor, @Param('id') id: string) {
    return ok(await this.cikgu.getRph(actor, id))
  }

  @Get('essays')
  @RateLimit(CIKGU_LIMITS.read)
  listEssays(@Actor() actor: CikguActor, @Query() query: Record<string, unknown>) {
    return this.cikgu.listEssays(actor, query)
  }

  @Get('essays/:id')
  @RateLimit(CIKGU_LIMITS.read)
  async getEssay(@Actor() actor: CikguActor, @Param('id') id: string) {
    return ok(await this.cikgu.getEssay(actor, id))
  }

  @Get('pbd')
  @RateLimit(CIKGU_LIMITS.read)
  pbdQueue(@Actor() actor: CikguActor, @Query() query: Record<string, unknown>) {
    return this.cikgu.pbdQueue(actor, query)
  }

  @Post('pbd/rollup')
  @HttpCode(200)
  @RateLimit(CIKGU_LIMITS.write)
  async rollup(@Actor() actor: CikguActor, @Body() body: unknown) {
    return ok(await this.cikgu.rollup(actor, body))
  }

  @Post('pbd/bulk-approve')
  @HttpCode(200)
  @RateLimit(CIKGU_LIMITS.write)
  async bulkApprove(@Actor() actor: CikguActor, @Body() body: unknown) {
    return ok(await this.cikgu.bulkApprove(actor, body))
  }

  @Get('pbd/export.csv')
  @RateLimit(CIKGU_LIMITS.export)
  async exportCsv(@Actor() actor: CikguActor, @Res({ passthrough: true }) res: Response): Promise<string> {
    const csv = await this.cikgu.exportCsv(actor)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${CIKGU_PBD_CSV_FILENAME}"`)
    return csv
  }
}
