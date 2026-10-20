import { Controller, Get, Inject, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Request } from 'express'

import { Roles } from '../../common/guards'
import { NoStoreInterceptor } from '../../common/http/no-store.interceptor'
import { ok } from '../../common/http/respond'
import { type RequestWithAuth, ScopeContext } from '../../common/scope'
import { RateLimit, RateLimitGuard, type RateLimitSpec } from '../../common/throttle'
import { HeatmapService } from './heatmap.service'

type Req = Request & RequestWithAuth

/**
 * Per-user ceiling of the heatmap read. Own bucket; the ceiling reuses the documented practice read
 * variable (`THROTTLE_PRACTICE_READ_PER_MINUTE`, default 120) so no new environment variable is needed.
 */
export const HEATMAP_LIMITS = {
  read: { bucket: 'heatmap.read', env: 'THROTTLE_PRACTICE_READ_PER_MINUTE', default: 120, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>

/**
 * M25 route #1 (BE-48): `GET /api/buku-nota/heatmap`, the caller's own weak-topic heatmap. Roles student
 * and admin only (BR-M25-01): no session 401 `UNAUTHORIZED` (default-deny guard), any other active role 403
 * `FORBIDDEN`. Any query parameter is ignored (V-M25-01): the data is always the session user's.
 * Answer data, so `Cache-Control: no-store`.
 */
@Controller('buku-nota')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class HeatmapController {
  constructor(@Inject(HeatmapService) private readonly heatmap: HeatmapService) {}

  @Get('heatmap')
  @Roles('student', 'admin')
  @RateLimit(HEATMAP_LIMITS.read)
  async get(@Req() req: Req) {
    const scope = ScopeContext.fromRequest(req)
    return ok(await this.heatmap.forCaller({ userId: scope.userId, isTest: scope.isTest }))
  }
}
