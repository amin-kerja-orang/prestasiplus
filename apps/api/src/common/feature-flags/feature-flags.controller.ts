import { Body, Controller, createParamDecorator, Get, Param, Put, UseInterceptors, type ExecutionContext } from '@nestjs/common'
import { FeatureToggleUpdateRequestSchema, type FeatureToggle, type FeatureToggleUpdateRequest } from '@pp/contract'
import type { Request } from 'express'

import { Roles } from '../guards'
import { NoStoreInterceptor, ok } from '../http'
import { requestIdOf } from '../request/request-id'
import { type RequestWithAuth, ScopeContext } from '../scope'
import { ZodValidationPipe } from '../validation/zod-validation.pipe'
import { type FeatureActor, FeatureFlagsService } from './feature-flags.service'

const Actor = createParamDecorator((_data: unknown, ctx: ExecutionContext): FeatureActor => {
  const req = ctx.switchToHttp().getRequest<Request & RequestWithAuth>()
  const scope = ScopeContext.fromRequest(req)
  return { userId: scope.userId, role: scope.role, requestId: requestIdOf(req) ?? null, ip: req.ip ?? req.socket.remoteAddress ?? null, isTest: scope.isTest }
})

/** API-ADM-09 Kawalan Ciri: Admin Pusat only. CSRF on the PUT is enforced by the session guard. */
@Roles('admin')
@UseInterceptors(NoStoreInterceptor)
@Controller('admin/feature-toggles')
export class FeatureFlagsController {
  constructor(private readonly flags: FeatureFlagsService) {}

  @Get()
  async list(): Promise<{ data: FeatureToggle[] }> {
    return ok(await this.flags.list())
  }

  @Put(':key')
  async toggle(
    @Actor() actor: FeatureActor,
    @Param('key') key: string,
    @Body(new ZodValidationPipe(FeatureToggleUpdateRequestSchema)) body: FeatureToggleUpdateRequest,
  ): Promise<{ data: FeatureToggle }> {
    return ok(await this.flags.setEnabled(actor, key, body.enabled))
  }
}
