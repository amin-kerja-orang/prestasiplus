import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import { ParentInviteAcceptRequestSchema, ParentInviteTokenParamSchema, ParentLinkIdParamSchema, ParentLinkListQuerySchema } from '@pp/contract'
import type { Request } from 'express'
import type { z } from 'zod'

import { ApiError } from '../../common/errors/api-error'
import { Public, Roles } from '../../common/guards/decorators'
import { SESSION_RESOLVER, type SessionResolver } from '../../common/guards/session-resolver'
import { NoStoreInterceptor, ok } from '../../common/http'
import { requestIdOf } from '../../common/request/request-id'
import { AUTH_CONTEXT_KEY, type RequestWithAuth } from '../../common/scope/auth-context'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe'
import { PARENT_LIMITS } from './parents.constants'
import { ParentsService, type Actor, type AdminActor } from './parents.service'

type Req = Request & RequestWithAuth

function actorOf(req: Req): Actor {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  return {
    userId: auth.userId,
    role: auth.active.role,
    sessionRowId: auth.sessionRowId,
    scopeLevel: auth.active.scope.level,
    requestId: requestIdOf(req) ?? null,
    ip: req.ip ?? req.socket.remoteAddress ?? null,
  }
}

function adminOf(req: Req): AdminActor {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  const { scope } = auth.active
  const schoolId = (scope.level === 'school' || scope.level === 'class') && scope.schoolId ? scope.schoolId : null
  return { ...actorOf(req), schoolId, isAdmin: auth.active.role === 'admin' }
}

const linkIdOf = (raw: string): string => new ZodValidationPipe(ParentLinkIdParamSchema).transform({ linkId: raw }).linkId

const tokenOf = (raw: string): string => new ZodValidationPipe(ParentInviteTokenParamSchema).transform({ token: raw }).token

/**
 * L45 "Jemput Ibu Bapa" (BE-25 part B). Every answer is `no-store` (an invite token is a bearer
 * secret). The student routes and the accept route are role-guarded by the global guards, which run
 * before the token is looked up; the preview is public and limited per client address.
 */
@Controller()
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class ParentsController {
  constructor(
    private readonly parents: ParentsService,
    @Inject(SESSION_RESOLVER) private readonly sessions: SessionResolver,
  ) {}

  @Get('me/parent-invite')
  @Roles('student')
  @RateLimit(PARENT_LIMITS.read)
  async status(@Req() req: Req) {
    return ok(await this.parents.status(actorOf(req)))
  }

  /** `/generate` is the mock path (kept for the existing client); the contract path is the bare POST. */
  @Post(['me/parent-invite', 'me/parent-invite/generate'])
  @HttpCode(200)
  @Roles('student')
  @RateLimit(PARENT_LIMITS.issue)
  async generate(@Req() req: Req) {
    return ok(await this.parents.generate(actorOf(req)))
  }

  @Get('parent-invites/:token')
  @Public()
  @RateLimit(PARENT_LIMITS.preview)
  async preview(@Req() req: Req, @Param('token') token: string) {
    return ok(await this.parents.preview(tokenOf(token), await this.viewerRole(req)))
  }

  @Post('parent-invites/:token/accept')
  @HttpCode(200)
  @Roles('parent')
  @RateLimit(PARENT_LIMITS.accept)
  async accept(@Req() req: Req, @Param('token') token: string, @Body() raw: unknown) {
    const body = new ZodValidationPipe(ParentInviteAcceptRequestSchema).transform(raw ?? {})
    return ok(await this.parents.accept(actorOf(req), tokenOf(token), body.relationship))
  }

  // --- links ---------------------------------------------------------------------------------------

  @Get('me/parent-links')
  @Roles('student', 'parent')
  @RateLimit(PARENT_LIMITS.read)
  async myLinks(@Req() req: Req) {
    return ok(await this.parents.myLinks(actorOf(req)))
  }

  @Delete('me/parent-links/:linkId')
  @HttpCode(204)
  @Roles('student', 'parent')
  @RateLimit(PARENT_LIMITS.unlink)
  async removeMine(@Req() req: Req, @Param('linkId') linkId: string): Promise<void> {
    await this.parents.removeMine(actorOf(req), linkIdOf(linkId))
  }

  @Get('admin/parent-links')
  @Roles('admin', 'school_admin')
  @RateLimit(PARENT_LIMITS.read)
  async adminLinks(@Req() req: Req, @Query(new ZodValidationPipe(ParentLinkListQuerySchema)) query: z.infer<typeof ParentLinkListQuerySchema>) {
    return this.parents.adminLinks(adminOf(req), query)
  }

  @Delete('admin/parent-links/:linkId')
  @HttpCode(204)
  @Roles('admin', 'school_admin')
  @RateLimit(PARENT_LIMITS.unlink)
  async removeAdmin(@Req() req: Req, @Param('linkId') linkId: string): Promise<void> {
    await this.parents.removeAdmin(adminOf(req), linkIdOf(linkId))
  }

  /** The active role of the optional session on the public preview; no or a bad session is a guest. */
  private async viewerRole(req: Req): Promise<string | null> {
    try {
      return (await this.sessions.resolve(req))?.active.role ?? null
    } catch {
      return null
    }
  }
}
