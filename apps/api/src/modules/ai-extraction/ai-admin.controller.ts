import { Body, Controller, createParamDecorator, type ExecutionContext, Get, HttpCode, Inject, Post, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common'
import { AiSettingsUpdateSchema, AiTestRequestSchema, AiUsageQuerySchema, type AiSettingsUpdate, type AiUsageQuery } from '@pp/contract'
import type { Request } from 'express'

import { Roles } from '../../common/guards/decorators'
import { NoStoreInterceptor, ok, okList } from '../../common/http'
import { requestIdOf } from '../../common/request/request-id'
import { type RequestWithAuth, ScopeContext } from '../../common/scope'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe'
import { AiAdminService, type AdminActor } from './ai-admin.service'
import { AI_LIMITS } from './ai.constants'

/** The acting admin, for the audit row and the cost log. */
const Admin = createParamDecorator((_data: unknown, ctx: ExecutionContext): AdminActor => {
  const req = ctx.switchToHttp().getRequest<Request & RequestWithAuth>()
  const scope = ScopeContext.fromRequest(req)
  return { userId: scope.userId, role: scope.role, requestId: requestIdOf(req) ?? null, ip: req.ip ?? req.socket.remoteAddress ?? null, isTest: scope.isTest }
})

/**
 * `/ai/*` (BE-36). Admin Pusat only: the global guards give 401 without a session and 403 without CSRF on PUT/POST
 * (`CSRF_INVALID`); `@Roles('admin')` gives 403 to every other role. Every answer is `no-store` (cost figures, actor ids).
 * Reads and writes are rate limited per user (429 `RATE_LIMITED`). No answer ever contains a key, a base URL or a
 * provider setting.
 */
@Controller('ai')
@Roles('admin')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class AiAdminController {
  constructor(@Inject(AiAdminService) private readonly service: AiAdminService) {}

  @Get('status')
  @RateLimit(AI_LIMITS.read)
  async status() {
    return ok(await this.service.status())
  }

  @Get('usage')
  @RateLimit(AI_LIMITS.read)
  async usage(@Query(new ZodValidationPipe(AiUsageQuerySchema)) query: AiUsageQuery) {
    const { rows, meta } = await this.service.usage(query)
    return okList(rows, meta)
  }

  @Put('settings')
  @RateLimit(AI_LIMITS.write)
  async settings(@Admin() actor: AdminActor, @Body(new ZodValidationPipe(AiSettingsUpdateSchema)) body: AiSettingsUpdate) {
    return ok(await this.service.updateSettings(actor, body))
  }

  @Post('test')
  @HttpCode(200)
  @RateLimit(AI_LIMITS.write)
  async test(@Admin() actor: AdminActor, @Body(new ZodValidationPipe(AiTestRequestSchema)) _body: unknown) {
    void _body
    return ok(await this.service.test(actor))
  }
}
