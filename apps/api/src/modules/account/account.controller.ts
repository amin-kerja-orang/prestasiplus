import {
  BadRequestException,
  Body,
  type CallHandler,
  Controller,
  type ExecutionContext,
  Get,
  HttpCode,
  Inject,
  Injectable,
  type NestInterceptor,
  PayloadTooLargeException,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  ACCOUNT_AUTH_MESSAGES,
  ACCOUNT_MESSAGES,
  ACCOUNT_PICTURE_MAX_KB,
  ACCOUNT_PICTURE_MESSAGES,
  ACCOUNT_REGISTER_PENDING_MESSAGE,
  ACCOUNT_REGISTER_PENDING_STATUS,
  AccountPasswordEmailRequestSchema,
  AccountPasswordResetIcRequestSchema,
  AccountPasswordResetRequestSchema,
  type AccountPlatformStats,
  type AccountRegisterPending,
  type AccountSettings,
  type AccountUserMe,
  type Session,
} from '@pp/contract'
import type { Request, Response } from 'express'
import type { Observable } from 'rxjs'

import { ApiError } from '../../common/errors/api-error'
import { Public } from '../../common/guards/decorators'
import { NoStoreInterceptor } from '../../common/http/no-store.interceptor'
import { ok } from '../../common/http/respond'
import { requestIdOf } from '../../common/request/request-id'
import { AUTH_CONTEXT_KEY, type AuthContext, type RequestWithAuth } from '../../common/scope/auth-context'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe'
import { CLOCK, type Clock } from '../../db/clock'
import { AuthConfig } from '../auth/auth.config'
import type { RequestInfo, SessionGrant } from '../auth/auth.service'
import { setSessionCookie } from '../auth/cookies'
import { ACCOUNT_LIMITS } from './account.constants'
import { invalid } from './account.errors'
import { PasswordResetService } from './password-reset.service'
import { ProfileService, type PictureUpload } from './profile.service'
import { RegistrationService } from './registration.service'
import { SettingsService, StatsService } from './settings.service'

type AuthedRequest = Request & RequestWithAuth

function authOf(req: AuthedRequest): AuthContext {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  return auth
}

function infoOf(req: Request): RequestInfo {
  const ua = req.headers['user-agent']
  return {
    ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
    userAgent: typeof ua === 'string' ? ua : null,
    requestId: requestIdOf(req) ?? null,
  }
}

abstract class Cookies {
  constructor(
    protected readonly config: AuthConfig,
    protected readonly clock: Clock,
  ) {}

  protected setCookie(res: Response, grant: SessionGrant): void {
    setSessionCookie(res, this.config, grant.token, grant.expiresAt, this.clock.now())
  }
}

/**
 * Public account routes under `/auth`: registration and the three password reset routes. Every
 * response is `no-store` (it carries a session or a token, D57b), errors included.
 */
@Controller('auth')
@Public()
@UseInterceptors(NoStoreInterceptor)
export class AccountPublicController extends Cookies {
  constructor(
    @Inject(RegistrationService) private readonly registration: RegistrationService,
    @Inject(PasswordResetService) private readonly resets: PasswordResetService,
    @Inject(AuthConfig) config: AuthConfig,
    @Inject(CLOCK) clock: Clock,
  ) {
    super(config, clock)
  }

  /** The body is parsed inside the service, next to the checks that need the database, so one response lists every field error. */
  @Post('register')
  @UseGuards(RateLimitGuard)
  @RateLimit(ACCOUNT_LIMITS.register)
  async register(
    @Body() raw: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ data: Session | AccountRegisterPending }> {
    const grant = await this.registration.register(raw, infoOf(req))
    // A teacher waits for a school_admin: no session, no cookie.
    if (grant === 'pending') return ok({ status: ACCOUNT_REGISTER_PENDING_STATUS, message: ACCOUNT_REGISTER_PENDING_MESSAGE })
    this.setCookie(res, grant)
    return ok(grant.session)
  }

  @Post('password/email')
  @HttpCode(200)
  async email(
    @Body(new ZodValidationPipe(AccountPasswordEmailRequestSchema)) body: { email: string },
    @Req() req: Request,
  ): Promise<{ data: { status: string } }> {
    return ok(await this.resets.requestLink(body, infoOf(req)))
  }

  @Post('password/reset')
  @HttpCode(200)
  async reset(
    @Body(new ZodValidationPipe(AccountPasswordResetRequestSchema)) body: { token: string; email: string; password: string; passwordConfirmation?: string | undefined },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ data: Session; status: string }> {
    const grant = await this.resets.reset(body, infoOf(req))
    this.setCookie(res, grant)
    return { data: grant.session, status: ACCOUNT_AUTH_MESSAGES.resetDone }
  }

  @Post('password/reset-ic')
  @HttpCode(200)
  async resetIc(
    @Body(new ZodValidationPipe(AccountPasswordResetIcRequestSchema)) body: { email: string; icNumber: string },
    @Req() req: Request,
  ): Promise<{ data: { token: string } }> {
    return ok(await this.resets.resetByIc(body, infoOf(req)))
  }
}

/** multer errors of the picture part become the contract's 422 on `profilePicture`. */
@Injectable()
export class PictureInterceptor implements NestInterceptor {
  private readonly inner: NestInterceptor

  constructor() {
    const Interceptor = FileInterceptor('profilePicture', {
      limits: { files: 1, fields: 2, fileSize: ACCOUNT_PICTURE_MAX_KB * 1024, fieldSize: 1024, parts: 4, headerPairs: 50 },
    })
    this.inner = new Interceptor({})
  }

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    try {
      return await this.inner.intercept(ctx, next)
    } catch (err) {
      if (err instanceof PayloadTooLargeException) throw invalid({ profilePicture: ACCOUNT_PICTURE_MESSAGES.size })
      if (err instanceof BadRequestException) throw invalid({ profilePicture: ACCOUNT_PICTURE_MESSAGES.required })
      throw err
    }
  }
}

/**
 * The signed-in user's own account: `/me`, `/me/password`, `/me/picture`, `/me/settings`. Any role;
 * everything acts on the session user only. Personal data: every response is `no-store`. Writes are
 * rate limited per user (D57a).
 */
@Controller('me')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class MeController extends Cookies {
  constructor(
    @Inject(ProfileService) private readonly profile: ProfileService,
    @Inject(SettingsService) private readonly settings: SettingsService,
    @Inject(AuthConfig) config: AuthConfig,
    @Inject(CLOCK) clock: Clock,
  ) {
    super(config, clock)
  }

  @Get()
  async me(@Req() req: AuthedRequest): Promise<{ data: AccountUserMe }> {
    return ok(await this.profile.me(authOf(req)))
  }

  @Put()
  @RateLimit(ACCOUNT_LIMITS.write)
  async update(@Body() raw: unknown, @Req() req: AuthedRequest): Promise<{ data: AccountUserMe; status: string }> {
    return { data: await this.profile.updateProfile(authOf(req), raw, infoOf(req)), status: ACCOUNT_MESSAGES.profileSaved }
  }

  @Put('password')
  @RateLimit(ACCOUNT_LIMITS.write)
  async password(
    @Body() raw: unknown,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ data: { status: string } }> {
    const rotated = await this.profile.changePassword(authOf(req), raw, infoOf(req))
    this.setCookie(res, rotated)
    return ok({ status: ACCOUNT_MESSAGES.passwordChanged })
  }

  @Post('picture')
  @HttpCode(200)
  @RateLimit(ACCOUNT_LIMITS.write)
  @UseInterceptors(PictureInterceptor)
  async picture(
    @UploadedFile() file: { buffer?: Buffer; mimetype?: string } | undefined,
    @Req() req: AuthedRequest,
  ): Promise<{ data: { avatarUrl: string }; status: string }> {
    const upload: PictureUpload | undefined = file?.buffer ? { buffer: file.buffer, mimetype: file.mimetype ?? '' } : undefined
    return { data: await this.profile.setPicture(authOf(req), upload, infoOf(req)), status: ACCOUNT_MESSAGES.pictureSaved }
  }

  @Get('settings')
  async getSettings(@Req() req: AuthedRequest): Promise<{ data: AccountSettings }> {
    return ok(await this.settings.get(authOf(req).userId))
  }

  @Put('settings')
  @RateLimit(ACCOUNT_LIMITS.write)
  async saveSettings(@Body() raw: unknown, @Req() req: AuthedRequest): Promise<{ data: AccountSettings; status: string }> {
    return { data: await this.settings.save(authOf(req).userId, raw), status: ACCOUNT_MESSAGES.settingsSaved }
  }
}

/** `GET /public/stats`: public counters of the login page, per client address rate limited. */
@Controller('public')
@Public()
@UseGuards(RateLimitGuard)
export class PublicStatsController {
  constructor(@Inject(StatsService) private readonly stats: StatsService) {}

  @Get('stats')
  @RateLimit(ACCOUNT_LIMITS.stats)
  async get(): Promise<{ data: AccountPlatformStats }> {
    return ok(await this.stats.get())
  }
}
