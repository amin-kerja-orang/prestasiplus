import { Body, Controller, Get, HttpCode, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import { CONTENT_MESSAGES, SupportTicketCreateRequestSchema } from '@pp/contract'
import type { Request } from 'express'

import { ApiError } from '../../common/errors/api-error'
import { Public, Roles } from '../../common/guards/decorators'
import { NoStoreInterceptor, ok } from '../../common/http'
import { requestIdOf } from '../../common/request/request-id'
import { AUTH_CONTEXT_KEY, type RequestWithAuth } from '../../common/scope/auth-context'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { strictFieldsOf } from '../../common/validation/strict-body'
import { hasNul } from '../content/audio/null-char'
import { invalid } from './support.errors'
import { SUPPORT_LIMITS } from './support.constants'
import { SupportService, type Actor } from './support.service'

type Req = Request & RequestWithAuth

function actorOf(req: Req): Actor {
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

/** A query value read tolerantly: the first string of a repeated key, nothing for an odd value (never a 422). */
const one = (v: unknown): string | undefined => (typeof v === 'string' ? v : Array.isArray(v) ? v.find((x): x is string => typeof x === 'string') : undefined)

/** The create body in STRICT mode (BE-33 AC1c, #98): an unknown key such as `status` or `userId` is a 422 naming it. */
const StrictSupportTicketCreateRequestSchema = SupportTicketCreateRequestSchema.strict()

/** A body that is not a JSON object is treated as empty (both fields then fail as required). */
const objectOf = (raw: unknown): Record<string, unknown> =>
  typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}

/**
 * M22 support tickets. Every answer is `no-store` (a ticket is personal). The own list and the create are
 * for any signed-in user (the global guards give 401 and CSRF 403); the queue is admin only and read-only (D27).
 */
@Controller()
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get('tiket')
  @RateLimit(SUPPORT_LIMITS.read)
  async listOwn(@Req() req: Req, @Query() query: Record<string, unknown>) {
    return this.support.listOwn(actorOf(req), one(query.status))
  }

  /** The owner is the session user; a `userId` (or any other unknown key) in the body is refused with 422 (strict, #98). */
  @Post('tiket')
  @HttpCode(201)
  @RateLimit(SUPPORT_LIMITS.create)
  async create(@Req() req: Req, @Body() raw: unknown) {
    const body = objectOf(raw)
    const parsed = StrictSupportTicketCreateRequestSchema.safeParse(body)
    const fields: Record<string, string> = parsed.success ? {} : strictFieldsOf(parsed.error.issues)
    // A NUL character cannot be stored (Postgres raises): refuse it on the field instead of a 500.
    for (const key of ['subject', 'body'] as const) if (hasNul(body[key])) fields[key] = CONTENT_MESSAGES.fieldInvalid
    if (!parsed.success || Object.keys(fields).length > 0) throw invalid(fields)
    return ok(await this.support.create(actorOf(req), parsed.data))
  }

  @Get('admin/tiket')
  @Roles('admin')
  @RateLimit(SUPPORT_LIMITS.read)
  async queue(@Query() query: Record<string, unknown>) {
    return this.support.queue(one(query.status))
  }

  @Get('admin/tiket/open-count')
  @Roles('admin')
  @RateLimit(SUPPORT_LIMITS.read)
  async openCount() {
    return ok(await this.support.openCount())
  }
}

/** `GET /api/config/support`: public (the help box of the guide page), counted per client address. */
@Controller('config')
@UseGuards(RateLimitGuard)
export class SupportConfigController {
  constructor(private readonly support: SupportService) {}

  @Get('support')
  @Public()
  @RateLimit(SUPPORT_LIMITS.config)
  async supportConfig() {
    return ok(await this.support.supportConfig())
  }
}
