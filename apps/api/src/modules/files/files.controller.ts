import {
  BadRequestException,
  type CallHandler,
  type CanActivate,
  Controller,
  Delete,
  type ExecutionContext,
  Get,
  HttpCode,
  Inject,
  Injectable,
  type NestInterceptor,
  Param,
  PayloadTooLargeException,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  FILE_MESSAGES,
  FILE_PURPOSES,
  FileRefSchema,
  UploadFileQuerySchema,
  type FilePurpose,
  type FileRef,
  type UploadFileQuery,
} from '@pp/contract'
import type { Request, Response } from 'express'
import type { Observable } from 'rxjs'

import { ApiError } from '../../common/errors/api-error'
import { Public } from '../../common/guards/decorators'
import { SESSION_RESOLVER, type SessionResolver } from '../../common/guards/session-resolver'
import { ok } from '../../common/http/respond'
import { requestIdOf } from '../../common/request/request-id'
import { AUTH_CONTEXT_KEY, type AuthContext, type RequestWithAuth } from '../../common/scope/auth-context'
import { AuthConfig } from '../auth/auth.config'
import { sessionTokenOf } from '../auth/cookies'
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe'
import { EXTENSION_OF, type DetectedMime } from './content-inspect'
import { FilesConfig } from './files.config'
import { type CallerInfo, FilesService, isFilePurpose, limitFor, mayUpload, sizeMessageFor } from './files.service'
import { DownloadThrottle, UploadThrottle } from './upload-throttle'

type AuthedRequest = Request & RequestWithAuth

function authOf(req: AuthedRequest): AuthContext {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  return auth
}

function infoOf(req: Request): CallerInfo {
  return { ip: req.ip ?? req.socket.remoteAddress ?? null, requestId: requestIdOf(req) ?? null }
}

/**
 * Runs BEFORE the body is read, so a refused request costs no buffer. Global guards (session, CSRF) ran
 * first. Order: rate limit (every attempt counts), then a known `purpose` (422 `fields.purpose`), then the
 * role for that purpose (403).
 */
@Injectable()
export class UploadGuard implements CanActivate {
  constructor(@Inject(UploadThrottle) private readonly throttle: UploadThrottle) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>()
    const auth = authOf(req)
    this.throttle.hit(auth.userId)
    const purpose = req.query.purpose
    if (!isFilePurpose(purpose)) {
      throw ApiError.of('VALIDATION_ERROR', { fields: { purpose: FILE_MESSAGES.purposeInvalid } })
    }
    if (!mayUpload(purpose, auth.active.role)) throw ApiError.of('FORBIDDEN')
    return true
  }
}

/** Rate limit for deletes (the same per-user window as uploads). */
@Injectable()
export class DeleteGuard implements CanActivate {
  constructor(@Inject(UploadThrottle) private readonly throttle: UploadThrottle) {}

  canActivate(ctx: ExecutionContext): boolean {
    this.throttle.hit(authOf(ctx.switchToHttp().getRequest<AuthedRequest>()).userId)
    return true
  }
}

const MULTER_LIMITS = { files: 1, fields: 4, fieldSize: 1024, parts: 6, headerPairs: 50 } as const

/**
 * Reads the multipart body with a size limit PER PURPOSE (its own rule, capped by MAX_UPLOAD_MB), so a
 * body over the limit is cut off at that size and never buffered whole. Multer errors become the
 * contract's 422: too large gives the purpose's size message, anything else (wrong field name, extra
 * file, malformed body) gives the "required" message on `fields.file`.
 */
@Injectable()
export class UploadInterceptor implements NestInterceptor {
  private readonly byPurpose = new Map<FilePurpose, NestInterceptor>()

  constructor(@Inject(FilesConfig) private readonly config: FilesConfig) {
    for (const purpose of FILE_PURPOSES) {
      const Interceptor = FileInterceptor('file', {
        limits: { ...MULTER_LIMITS, fileSize: limitFor(purpose, config.maxUploadBytes) },
      })
      this.byPurpose.set(purpose, new Interceptor({}))
    }
  }

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = ctx.switchToHttp().getRequest<Request>()
    const purpose = req.query.purpose
    const inner = isFilePurpose(purpose) ? this.byPurpose.get(purpose) : undefined
    if (!inner || !isFilePurpose(purpose)) {
      throw ApiError.of('VALIDATION_ERROR', { fields: { purpose: FILE_MESSAGES.purposeInvalid } })
    }
    try {
      return await inner.intercept(ctx, next)
    } catch (err) {
      if (err instanceof PayloadTooLargeException) {
        throw ApiError.of('VALIDATION_ERROR', { fields: { file: sizeMessageFor(purpose, this.config.maxUploadBytes) } })
      }
      if (err instanceof BadRequestException) {
        throw ApiError.of('VALIDATION_ERROR', { fields: { file: FILE_MESSAGES.required } })
      }
      throw err
    }
  }
}

@Controller('files')
export class FilesController {
  constructor(
    @Inject(FilesService) private readonly files: FilesService,
    @Inject(SESSION_RESOLVER) private readonly resolver: SessionResolver,
    @Inject(DownloadThrottle) private readonly reads: DownloadThrottle,
    @Inject(AuthConfig) private readonly authConfig: AuthConfig,
  ) {}

  @Post()
  @HttpCode(201)
  @UseGuards(UploadGuard)
  @UseInterceptors(UploadInterceptor)
  async upload(
    @Query(new ZodValidationPipe(UploadFileQuerySchema)) query: UploadFileQuery,
    @UploadedFile() file: { buffer?: Buffer } | undefined,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ data: FileRef }> {
    res.setHeader('Cache-Control', 'no-store')
    const upload = file?.buffer ? { buffer: file.buffer } : undefined
    const ref = await this.files.upload(authOf(req), query.purpose, upload, infoOf(req))
    return ok(FileRefSchema.parse(ref))
  }

  /**
   * Public at the guard level because `cms_image` is public; every other purpose needs a session,
   * which is resolved here (401 without one, 404 for a file the caller may not see). The read is
   * rate limited per user, or per address for an anonymous caller.
   */
  @Public()
  @Get(':id')
  async download(@Param('id') id: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown'
    let auth: AuthContext | null = null
    if (sessionTokenOf(req, this.authConfig) === undefined) {
      // No session cookie: throttle by address BEFORE any session lookup, so a cookie-less flood costs no database work.
      this.reads.hit({ ip })
    } else {
      auth = await this.resolver.resolve(req)
      this.reads.hit(auth ? { userId: auth.userId } : { ip })
    }
    const file = await this.files.read(id, auth)
    const mime = file.mime as DetectedMime
    const inline = mime !== 'application/pdf'
    res
      .status(200)
      .set({
        'Content-Type': mime,
        'Content-Length': String(file.bytes.length),
        'X-Content-Type-Options': 'nosniff',
        // Only the public purpose may be reused from the browser cache without asking; the rest revalidate.
        'Cache-Control': file.purpose === 'cms_image' ? 'private, max-age=300' : 'private, no-cache',
        Vary: 'Cookie',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="file-${file.publicId}.${EXTENSION_OF[mime]}"`,
        // Defence in depth if a browser ever renders the bytes as a document.
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cross-Origin-Resource-Policy': 'same-site',
      })
      .end(file.bytes)
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(DeleteGuard)
  async remove(@Param('id') id: string, @Req() req: AuthedRequest): Promise<void> {
    await this.files.remove(authOf(req), id, infoOf(req))
  }
}
