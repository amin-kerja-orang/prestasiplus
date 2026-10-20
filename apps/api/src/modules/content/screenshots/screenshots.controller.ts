import {
  BadRequestException,
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
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { AnyFilesInterceptor } from '@nestjs/platform-express'
import { CONTENT_MESSAGES, SCREENSHOT_MAX_BYTES, SCREENSHOT_MAX_FILES } from '@pp/contract'
import type { Request } from 'express'
import type { Observable } from 'rxjs'

import { ApiError } from '../../../common/errors/api-error'
import { Roles } from '../../../common/guards/decorators'
import { NoStoreInterceptor } from '../../../common/http'
import { AUTH_CONTEXT_KEY, type RequestWithAuth } from '../../../common/scope/auth-context'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { actorOf, CONTENT_LIMITS } from '../shared/content-support'
import { ScreenshotsService, type UploadPart } from './screenshots.service'

type Req = Request & RequestWithAuth

const MULTER_LIMITS = {
  // One more than the maximum, so the service can answer with the "at most 20" message itself.
  files: SCREENSHOT_MAX_FILES + 1,
  fileSize: SCREENSHOT_MAX_BYTES,
  fields: 5,
  parts: SCREENSHOT_MAX_FILES + 6,
  headerPairs: 50,
} as const

/**
 * Reads the multipart body (parts named `files[]` or `files`) with the contract limits. It runs after the
 * global session, CSRF and role guards, so a refused caller costs no buffer. Multer errors become the
 * contract's 422 `fields.files`.
 */
@Injectable()
export class ScreenshotUploadInterceptor implements NestInterceptor {
  private readonly inner: NestInterceptor = new (AnyFilesInterceptor({ limits: MULTER_LIMITS }))({})

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    try {
      return await this.inner.intercept(ctx, next)
    } catch (err) {
      if (err instanceof PayloadTooLargeException) {
        throw ApiError.of('VALIDATION_ERROR', { message: CONTENT_MESSAGES.screenshotRefused, fields: { files: CONTENT_MESSAGES.screenshotRefused } })
      }
      if (err instanceof BadRequestException) {
        const tooMany = /too many|unexpected/i.test(err.message)
        throw ApiError.of('VALIDATION_ERROR', { fields: { files: tooMany ? CONTENT_MESSAGES.screenshotMaxFiles : CONTENT_MESSAGES.fieldRequired } })
      }
      throw err
    }
  }
}

/** Private screenshots (M09 #41 and #42): admin only, `no-store`. */
@Controller('admin/screenshots')
@Roles('admin')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class AdminScreenshotsController {
  constructor(@Inject(ScreenshotsService) private readonly screenshots: ScreenshotsService) {}

  @Get()
  @RateLimit(CONTENT_LIMITS.adminRead)
  list() {
    return this.screenshots.list()
  }

  @Post()
  @HttpCode(201)
  @RateLimit(CONTENT_LIMITS.adminWrite)
  @UseInterceptors(ScreenshotUploadInterceptor)
  upload(@Req() req: Req, @UploadedFiles() files: UploadPart[] | undefined) {
    const auth = req[AUTH_CONTEXT_KEY]
    if (!auth) throw ApiError.of('UNAUTHORIZED')
    const parts = (files ?? []).filter((f) => ['files[]', 'files', 'file'].includes((f as UploadPart & { fieldname?: string }).fieldname ?? 'files'))
    return this.screenshots.upload(auth, actorOf(req), parts)
  }
}
