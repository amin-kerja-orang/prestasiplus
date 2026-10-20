import { Controller, Get, Inject, Param, Query, Req } from '@nestjs/common'
import type { Request } from 'express'

import { ok } from '../../../../common/http/respond'
import { type RequestWithAuth, ScopeContext } from '../../../../common/scope'
import { PracticeAnalyticsService } from './analytics.service'

type Req = Request & RequestWithAuth

/** First value of a query parameter, or undefined (arrays and objects take the first string). */
function one(query: Record<string, unknown>, key: string): string | undefined {
  const v = query[key]
  if (typeof v === 'string') return v
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0]
  return undefined
}

const me = (req: Req): string => ScopeContext.fromRequest(req).userId

/**
 * Analytics views (SRS M05 #9 to #14, screens S6 to S9, S11, S12). Any signed-in role (the default-deny
 * guard answers 401); every figure is the caller's own. Read-only: no CSRF header and no rate limit.
 */
@Controller('practice')
export class PracticeAnalyticsController {
  constructor(@Inject(PracticeAnalyticsService) private readonly analytics: PracticeAnalyticsService) {}

  @Get('revision')
  async revision(@Req() req: Req) {
    return ok(await this.analytics.revisionOverview(me(req)))
  }

  @Get('revision/:code')
  async revisionSubject(@Param('code') code: string, @Req() req: Req) {
    return ok(await this.analytics.revisionSubject(me(req), code))
  }

  @Get('progress')
  async progress(@Query() query: Record<string, unknown>, @Req() req: Req) {
    return ok(await this.analytics.progress(me(req), one(query, 'period')))
  }

  @Get('history')
  async history(@Query() query: Record<string, unknown>, @Req() req: Req) {
    return this.analytics.history(me(req), one(query, 'period'), one(query, 'page'))
  }

  @Get('corrections')
  async corrections(@Query() query: Record<string, unknown>, @Req() req: Req) {
    return ok(await this.analytics.corrections(me(req), one(query, 'month')))
  }

  @Get('mastery')
  async mastery(@Req() req: Req) {
    return ok(await this.analytics.mastery(me(req)))
  }
}
