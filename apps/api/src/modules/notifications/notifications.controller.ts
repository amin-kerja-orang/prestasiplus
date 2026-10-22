import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import { NotificationBulkRequestSchema, NotificationListQuerySchema } from '@pp/contract'
import type { Request } from 'express'
import type { z } from 'zod'

import { ApiError } from '../../common/errors/api-error'
import { NoStoreInterceptor, ok } from '../../common/http'
import { AUTH_CONTEXT_KEY, type RequestWithAuth } from '../../common/scope/auth-context'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { StrictZodValidationPipe } from '../../common/validation/strict-body'
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe'
import { NOTIFICATION_LIMITS_RATE as LIMITS } from './notifications.constants'
import { NotificationsService } from './notifications.service'

type Req = Request & RequestWithAuth

function me(req: Req): string {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  return auth.userId
}

/** A repeated key (`?page=1&page=2`) arrives as an array: the first string wins; anything else is ignored. */
const first = (v: unknown): string | undefined => {
  const x = Array.isArray(v) ? v[0] : v
  return typeof x === 'string' ? x : undefined
}

/** Query values are never a 422 (contract): odd or repeated values are coerced, then parsed. */
const listQueryOf = (raw: Record<string, unknown>): z.infer<typeof NotificationListQuerySchema> =>
  new ZodValidationPipe(NotificationListQuerySchema).transform({ filter: first(raw.filter), type: first(raw.type), page: first(raw.page) })

const bulkIds = (raw: unknown): string[] => new ZodValidationPipe(NotificationBulkRequestSchema).transform(raw ?? {}).ids

/** `bulk-read` in STRICT mode (BE-33 AC1c, #99): an unknown key such as `userId` is a 422 naming it. The owner is always the session user. */
const strictBulkRead = new StrictZodValidationPipe(NotificationBulkRequestSchema)
const bulkReadIds = (raw: unknown): string[] => strictBulkRead.transform(raw ?? {}).ids

/** The signed-in user's inbox (any role, own items only). Every answer is `no-store`. */
@Controller('me/notifications')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RateLimit(LIMITS.read)
  list(@Req() req: Req, @Query() raw: Record<string, unknown>) {
    return this.notifications.list(me(req), listQueryOf(raw))
  }

  @Get('unread-count')
  @RateLimit(LIMITS.read)
  async unreadCount(@Req() req: Req) {
    return ok(await this.notifications.unreadCount(me(req)))
  }

  @Post('read-all')
  @HttpCode(200)
  @RateLimit(LIMITS.write)
  async readAll(@Req() req: Req) {
    return ok(await this.notifications.readAll(me(req)))
  }

  @Post('bulk-read')
  @HttpCode(200)
  @RateLimit(LIMITS.write)
  async bulkRead(@Req() req: Req, @Body() raw: unknown) {
    return ok(await this.notifications.bulkRead(me(req), bulkReadIds(raw)))
  }

  @Post('bulk-delete')
  @HttpCode(200)
  @RateLimit(LIMITS.write)
  async bulkDelete(@Req() req: Req, @Body() raw: unknown) {
    return ok(await this.notifications.bulkDelete(me(req), bulkIds(raw)))
  }

  @Post(':id/read')
  @HttpCode(200)
  @RateLimit(LIMITS.write)
  async markRead(@Req() req: Req, @Param('id') id: string) {
    return ok(await this.notifications.markRead(me(req), id))
  }

  @Delete(':id')
  @HttpCode(200)
  @RateLimit(LIMITS.write)
  async remove(@Req() req: Req, @Param('id') id: string) {
    return ok(await this.notifications.remove(me(req), id))
  }
}
