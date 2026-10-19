import { Body, Controller, Delete, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common'
import {
  EnterModeRequestSchema,
  LoginRequestSchema,
  type EnterModeRequest,
  type LoginRequest,
  type Session,
  type SwitchRoleRequest,
  SwitchRoleRequestSchema,
} from '@pp/contract'
import type { Request, Response } from 'express'

import { Public } from '../../common/guards/decorators'
import { ok } from '../../common/http/respond'
import { requestIdOf } from '../../common/request/request-id'
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe'
import { CLOCK, type Clock } from '../../db/clock'
import { AuthConfig } from './auth.config'
import { AuthService, type RequestInfo, type SessionGrant } from './auth.service'
import { clearSessionCookie, sessionTokenOf, setSessionCookie } from './cookies'
import { PostgresSessionResolver } from './session-resolver.service'

function infoOf(req: Request): RequestInfo {
  const ua = req.headers['user-agent']
  return {
    ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
    userAgent: typeof ua === 'string' ? ua : null,
    requestId: requestIdOf(req) ?? null,
  }
}

/** Responses carry the CSRF token: they must never be cached (D57b). */
function noStore(res: Response): void {
  res.setHeader('Cache-Control', 'no-store')
}

abstract class SessionResponder {
  constructor(
    protected readonly config: AuthConfig,
    protected readonly clock: Clock,
  ) {}

  /** Sets the new cookie and returns the `{ data: Session }` body. */
  protected send(res: Response, grant: SessionGrant): { data: Session } {
    noStore(res)
    setSessionCookie(res, this.config, grant.token, grant.expiresAt, this.clock.now())
    return ok(grant.session)
  }
}

@Controller('auth')
export class AuthController extends SessionResponder {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(PostgresSessionResolver) private readonly resolver: PostgresSessionResolver,
    @Inject(AuthConfig) config: AuthConfig,
    @Inject(CLOCK) clock: Clock,
  ) {
    super(config, clock)
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(LoginRequestSchema)) body: LoginRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ data: Session }> {
    const grant = await this.auth.login(body, infoOf(req), sessionTokenOf(req, this.config))
    return this.send(res, grant)
  }

  /**
   * Public so that a dead or missing session still gets 204 (idempotent). When a valid session
   * exists the resolver checks `X-CSRF-Token` first (403 CSRF_INVALID).
   */
  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const state = await this.resolver.resolveState(req)
    await this.auth.logout(sessionTokenOf(req, this.config), state, infoOf(req))
    noStore(res)
    clearSessionCookie(res, this.config)
  }
}

@Controller('session')
export class SessionController extends SessionResponder {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(PostgresSessionResolver) private readonly resolver: PostgresSessionResolver,
    @Inject(AuthConfig) config: AuthConfig,
    @Inject(CLOCK) clock: Clock,
  ) {
    super(config, clock)
  }

  @Get()
  async current(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ data: Session }> {
    const state = await this.resolver.require(req)
    noStore(res)
    return ok(state.session)
  }

  @Post('role')
  @HttpCode(200)
  async switchRole(
    @Body(new ZodValidationPipe(SwitchRoleRequestSchema)) body: SwitchRoleRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ data: Session }> {
    const state = await this.resolver.require(req)
    return this.send(res, await this.auth.switchRole(state, body.role, infoOf(req)))
  }

  @Post('mode')
  @HttpCode(200)
  async enterMode(
    @Body(new ZodValidationPipe(EnterModeRequestSchema)) _body: EnterModeRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ data: Session }> {
    const state = await this.resolver.require(req)
    return this.send(res, await this.auth.enterMode(state, infoOf(req)))
  }

  @Delete('mode')
  @HttpCode(200)
  async exitMode(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ data: Session }> {
    const state = await this.resolver.require(req)
    return this.send(res, await this.auth.exitMode(state, infoOf(req)))
  }
}
