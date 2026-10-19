import {
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
  FileRefSchema,
  UploadFileQuerySchema,
  type FileRef,
  type UploadFileQuery,
} from '@pp/contract'
import type { Request, Response } from 'express'
import { catchError, type Observable, throwError } from 'rxjs'

import { ApiError } from '../../common/errors/api-error'
import { Public } from '../../common/guards/decorators'
import { SESSION_RESOLVER, type SessionResolver } from '../../common/guards/session-resolver'
import { ok } from '../../common/http/respond'
import { requestIdOf } from '../../common/request/request-id'
import { AUTH_CONTEXT_KEY, type AuthContext, type RequestWithAuth } from '../../common/scope/auth-context'
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe'
import { EXTENSION_OF, type DetectedMime } from './content-inspect'
import { FilesConfig } from './files.config'
import { type CallerInfo, FilesService, isFilePurpose, mayUpload, sizeMessageFor } from './files.service'
import { UploadThrottle } from './upload-throttle'

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
 * Runs before the body is read: a role that may not upload the purpose is refused (403) and the
 * per-user rate limit is applied, so neither costs a 10 MB buffer. Global guards (session, CSRF) run first.
 */
@Injectable()
export class UploadGuard implements CanActivate {
  constructor(@Inject(UploadThrottle) private readonly throttle: UploadThrottle) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>()
    const auth = authOf(req)
    const purpose = req.query.purpose
    this.throttle.hit(auth.userId)
    if (isFilePurpose(purpose) && !mayUpload(purpose, auth.active.role)) throw ApiError.of('FORBIDDEN')
    return true
  }
}

/** Rate limit for deletes (same per-user window as uploads). */
@Injectable()
export class DeleteGuard implements CanActivate {
  constructor(@Inject(UploadThrottle) private readonly throttle: UploadThrottle) {}

  canActivate(ctx: ExecutionContext): boolean {
    this.throttle.hit(authOf(ctx.switchToHttp().getRequest<AuthedRequest>()).userId)
    return true
  }
}

/** Multer's "file too large" (413) becomes the contract's 422 `fields.file`; the other multer errors are 422 too. */
@Injectable()
export class UploadErrorInterceptor implements NestInterceptor {
  constructor(@Inject(FilesConfig) private readonly config: FilesConfig) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>()
    return next.handle().pipe(
      catchError((err: unknown) => {
        if (err instanceof PayloadTooLargeException) {
          const purpose = isFilePurpose(req.query.purpose) ? req.query.purpose : 'avatar'
          return throwError(() => ApiError.of('VALIDATION_ERROR', { fields: { file: sizeMessageFor(purpose, this.config.maxUploadBytes) } }))
        }
        return throwError(() => err)
      }),
    )
  }
}

@Controller('files')
export class FilesController {
  constructor(
    @Inject(FilesService) private readonly files: FilesService,
    @Inject(SESSION_RESOLVER) private readonly resolver: SessionResolver,
  ) {}

  @Post()
  @HttpCode(201)
  @UseGuards(UploadGuard)
  @UseInterceptors(UploadErrorInterceptor, FileInterceptor('file'))
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
   * which is resolved here (401 without one, 404 for a file the caller may not see).
   */
  @Public()
  @Get(':id')
  async download(@Param('id') id: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    const auth = await this.resolver.resolve(req)
    const file = await this.files.read(id, auth)
    const mime = file.mime as DetectedMime
    const inline = mime !== 'application/pdf'
    res
      .status(200)
      .set({
        'Content-Type': mime,
        'Content-Length': String(file.bytes.length),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=300',
        Vary: 'Cookie',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="file-${file.id}.${EXTENSION_OF[mime]}"`,
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
