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
  Param,
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
  BijakAttemptSavePayloadSchema,
  BijakAttemptSelfMarkRequestSchema,
  BijakAttemptStartRequestSchema,
  BijakAttemptSubmitPayloadSchema,
  type BijakAttemptSavePayload,
  type BijakAttemptSelfMarkRequest,
  type BijakAttemptStartRequest,
  type BijakAttemptSubmitPayload,
  IdSchema,
} from '@pp/contract'
import type { Request, Response } from 'express'
import type { Observable } from 'rxjs'
import { z } from 'zod'

import { ApiError } from '../../../common/errors/api-error'
import { Roles } from '../../../common/guards/decorators'
import { NoStoreInterceptor } from '../../../common/http/no-store.interceptor'
import { ok } from '../../../common/http/respond'
import { requestIdOf } from '../../../common/request/request-id'
import { AUTH_CONTEXT_KEY, type AuthContext, type RequestWithAuth } from '../../../common/scope/auth-context'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe'
import { ATTEMPT_RATE, BIJAK_ATTEMPTS_MESSAGES as MSG, MAX_PHOTO_BYTES } from './attempts.constants'
import { BijakAttemptsService, type CallerInfo } from './attempts.service'

type AuthedRequest = Request & RequestWithAuth

/** The text fields of the photo upload (the file part is read by multer). */
const PHOTO_FIELDS = new ZodValidationPipe(z.object({ partId: IdSchema }))

function authOf(req: AuthedRequest): AuthContext {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  return auth
}

function infoOf(req: Request): CallerInfo {
  return { ip: req.ip ?? req.socket.remoteAddress ?? null, requestId: requestIdOf(req) ?? null }
}

/** Reads the one multipart `file` (at most 5 MB) and turns multer errors into the contract's 422. */
@Injectable()
export class PhotoInterceptor implements NestInterceptor {
  private readonly inner: NestInterceptor
  constructor() {
    const Interceptor = FileInterceptor('file', {
      limits: { files: 1, fields: 4, fieldSize: 1024, parts: 6, headerPairs: 50, fileSize: MAX_PHOTO_BYTES },
    })
    this.inner = new Interceptor({})
  }

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    try {
      return await this.inner.intercept(ctx, next)
    } catch (err) {
      if (err instanceof PayloadTooLargeException) throw ApiError.of('VALIDATION_ERROR', { fields: { file: MSG.photoType } })
      if (err instanceof BadRequestException) throw ApiError.of('VALIDATION_ERROR', { fields: { file: 'The file field is required.' } })
      throw err
    }
  }
}

/**
 * Bijak SPM attempts (BE-16). Students only: the ACTIVE role must be `student`, which is also what an
 * admin or school admin acts as inside Mod Pelajar (their rows are stamped `is_test`). Teachers and
 * every other role get 403 (D43). Ownership is checked in the service (another user's attempt is 403
 * "Akses ditolak", D54b). Everything answers `Cache-Control: no-store`: it is a pupil's own work.
 * CSRF on the writes is enforced by the global session guard.
 */
@Controller('bijak')
@Roles('student')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class BijakAttemptsController {
  constructor(@Inject(BijakAttemptsService) private readonly attempts: BijakAttemptsService) {}

  @Get('papers/:paperId/in-progress')
  async inProgress(@Param('paperId') paperId: string, @Req() req: AuthedRequest) {
    return ok(await this.attempts.findInProgress(authOf(req).userId, paperId.slice(0, 64)))
  }

  @Post('attempts')
  @RateLimit(ATTEMPT_RATE.lifecycle)
  async start(
    @Body(new ZodValidationPipe(BijakAttemptStartRequestSchema)) body: BijakAttemptStartRequest,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const out = await this.attempts.start(authOf(req), body, infoOf(req))
    res.status(out.created ? 201 : 200)
    return ok({ attemptId: out.attemptId })
  }

  @Get('attempts/:id')
  async view(@Param('id') id: string, @Req() req: AuthedRequest) {
    return ok(await this.attempts.view(authOf(req).userId, id))
  }

  @Put('attempts/:id/answers')
  @RateLimit(ATTEMPT_RATE.save)
  async save(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(BijakAttemptSavePayloadSchema)) body: BijakAttemptSavePayload,
    @Req() req: AuthedRequest,
  ) {
    return ok(await this.attempts.save(authOf(req).userId, id, body))
  }

  @Post('attempts/:id/submit')
  @HttpCode(200)
  @RateLimit(ATTEMPT_RATE.lifecycle)
  async submit(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(BijakAttemptSubmitPayloadSchema)) body: BijakAttemptSubmitPayload,
    @Req() req: AuthedRequest,
  ) {
    return ok(await this.attempts.submit(authOf(req), id, body, infoOf(req)))
  }

  @Post('attempts/:id/abandon')
  @HttpCode(204)
  @RateLimit(ATTEMPT_RATE.lifecycle)
  async abandon(@Param('id') id: string, @Req() req: AuthedRequest): Promise<void> {
    await this.attempts.abandon(authOf(req), id, infoOf(req))
  }

  @Post('attempts/:id/questions/:questionId/check')
  @HttpCode(200)
  @RateLimit(ATTEMPT_RATE.check)
  async check(
    @Param('id') id: string,
    @Param('questionId', new ZodValidationPipe(IdSchema)) questionId: string,
    @Body() body: unknown,
    @Req() req: AuthedRequest,
  ) {
    // The body is optional: absent or `{}` means "no autosave payload".
    const empty = body === undefined || body === null || (typeof body === 'object' && Object.keys(body).length === 0)
    const payload = empty ? undefined : new ZodValidationPipe(BijakAttemptSavePayloadSchema).transform(body)
    return ok(await this.attempts.check(authOf(req).userId, id, questionId, payload))
  }

  @Get('attempts/:id/result')
  async result(@Param('id') id: string, @Req() req: AuthedRequest) {
    return ok(await this.attempts.result(authOf(req).userId, id))
  }

  /** R1-B12: the pupil's own mark for one part (Semakan). */
  @Post('attempts/:id/self-mark')
  @HttpCode(200)
  @RateLimit(ATTEMPT_RATE.save)
  async selfMark(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(BijakAttemptSelfMarkRequestSchema)) body: BijakAttemptSelfMarkRequest,
    @Req() req: AuthedRequest,
  ) {
    return ok(await this.attempts.selfMark(authOf(req), id, body))
  }

  /** R1-B15: "Cuba Lagi" - a new blank sitting of the same paper. */
  @Post('attempts/:id/retry')
  @HttpCode(201)
  @RateLimit(ATTEMPT_RATE.lifecycle)
  async retry(@Param('id') id: string, @Req() req: AuthedRequest) {
    return ok(await this.attempts.retry(authOf(req), id, infoOf(req)))
  }

  /** R1-B15: "Lihat semakan lepas" - the caller's closed sittings of a paper. */
  @Get('papers/:paperId/attempts')
  async pastSittings(@Param('paperId') paperId: string, @Req() req: AuthedRequest) {
    return ok(await this.attempts.pastSittings(authOf(req).userId, paperId.slice(0, 64)))
  }

  @Get('history')
  async history(@Req() req: AuthedRequest) {
    return ok(await this.attempts.history(authOf(req).userId))
  }

  @Post('attempts/:id/photos')
  @HttpCode(201)
  @RateLimit(ATTEMPT_RATE.photo)
  @UseInterceptors(PhotoInterceptor)
  async photo(
    @Param('id') id: string,
    @Body() body: { partId?: unknown },
    @UploadedFile() file: { buffer?: Buffer; originalname?: string } | undefined,
    @Req() req: AuthedRequest,
  ) {
    const { partId } = PHOTO_FIELDS.transform({ partId: body?.partId })
    const upload = file?.buffer ? { buffer: file.buffer, ...(file.originalname ? { originalname: file.originalname } : {}) } : undefined
    return ok(await this.attempts.addPhoto(authOf(req), id, partId, upload, infoOf(req)))
  }
}
