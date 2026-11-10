import { Body, Controller, Get, Inject, Param, Put, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import { ApiError } from '../../../../common/errors/api-error'
import { Roles } from '../../../../common/guards/decorators'
import { ok } from '../../../../common/http/respond'
import { requestIdOf } from '../../../../common/request/request-id'
import { AUTH_CONTEXT_KEY, type RequestWithAuth } from '../../../../common/scope/auth-context'
import { RateLimit, RateLimitGuard } from '../../../../common/throttle'
import { GAMES_LIMITS } from '../../games.constants'
import { AdminGamesService, type GamesAdminActor } from './admin-games.service'

type AdminRequest = Request & RequestWithAuth

function actorOf(req: AdminRequest): GamesAdminActor {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  const { scope } = auth.active
  return {
    userId: auth.userId,
    role: auth.active.role,
    sessionRowId: auth.sessionRowId,
    scopeLevel: scope.level,
    schoolId: scope.schoolId ?? null,
    isTest: auth.mode !== null,
    requestId: requestIdOf(req) ?? null,
    ip: req.ip ?? req.socket.remoteAddress ?? null,
  }
}

/** No body means no change. A body that is not a JSON object is refused with the plain 422 (ERR-REQ-01). */
function objectBody(raw: unknown): Record<string, unknown> {
  if (raw === undefined || raw === null) return {}
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  throw ApiError.of('VALIDATION_ERROR')
}

/** Tetapan Permainan (M16-51, M16-52, API-ADM-08, API-ADM-23): role `admin` only. */
@Controller('admin/games')
@Roles('admin')
@UseGuards(RateLimitGuard)
export class AdminGamesController {
  constructor(@Inject(AdminGamesService) private readonly admin: AdminGamesService) {}

  @Get()
  @RateLimit(GAMES_LIMITS.read)
  async overview() {
    return ok(await this.admin.overview())
  }

  @Put('settings')
  @RateLimit(GAMES_LIMITS.write)
  async settings(@Req() req: AdminRequest, @Body() body: unknown) {
    return ok(await this.admin.saveSettings(actorOf(req), objectBody(body)))
  }

  @Put(':gameKey/active')
  @RateLimit(GAMES_LIMITS.write)
  async setGameActive(@Req() req: AdminRequest, @Param('gameKey') gameKey: string, @Body() body: unknown) {
    return ok(await this.admin.setGameActive(actorOf(req), gameKey, objectBody(body)))
  }

  @Get('spin-segments')
  @RateLimit(GAMES_LIMITS.read)
  async spinSegments() {
    return ok(await this.admin.spinSegments())
  }

  @Put('spin-segments')
  @RateLimit(GAMES_LIMITS.write)
  async saveSpinSegments(@Req() req: AdminRequest, @Body() body: unknown) {
    return ok(await this.admin.saveSpinSegments(actorOf(req), objectBody(body)))
  }
}
