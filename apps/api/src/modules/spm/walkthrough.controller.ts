import {
  type CallHandler,
  Body,
  Controller,
  type ExecutionContext,
  HttpCode,
  Inject,
  Injectable,
  type NestInterceptor,
  PayloadTooLargeException,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { SPM_WALKTHROUGH_MAX_IMAGE_BYTES } from '@pp/contract'
import type { Request } from 'express'
import type { Observable } from 'rxjs'

import { NoStoreInterceptor } from '../../common/http/no-store.interceptor'
import { WalkthroughService } from './walkthrough.service'

/** Marker the interceptor leaves on the request when the upload was cut off by the size limit. */
const TOO_LARGE = Symbol('spm.walkthrough.imageTooLarge')

/**
 * Multipart reader of the walkthrough: ONE image part in memory (never written to disk), at most 5 MB. A file over
 * the limit is a business error (HTTP 200 `{ ok: false, error: "Gambar tidak sah." }`), not a 413: the interceptor
 * turns the multer refusal into a marker and lets the handler answer.
 */
@Injectable()
export class WalkthroughUploadInterceptor implements NestInterceptor {
  private readonly inner: NestInterceptor

  constructor() {
    const Interceptor = FileInterceptor('image', {
      limits: { files: 1, fields: 8, fileSize: SPM_WALKTHROUGH_MAX_IMAGE_BYTES, fieldSize: 16 * 1024, parts: 10, headerPairs: 50 },
    })
    this.inner = new Interceptor({})
  }

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    try {
      return await this.inner.intercept(ctx, next)
    } catch (err) {
      if (err instanceof PayloadTooLargeException) {
        ;(ctx.switchToHttp().getRequest() as Record<symbol, unknown>)[TOO_LARGE] = true
        return next.handle()
      }
      throw err
    }
  }
}

/**
 * The simulated walkthrough (M06-13). Any signed-in role. The body is RAW `{ ok, walkthrough | error }` (no `data`
 * envelope) and every business error is HTTP 200; only an unlisted subject is 422.
 */
@Controller('spm-walkthrough')
@UseInterceptors(NoStoreInterceptor)
export class WalkthroughController {
  constructor(@Inject(WalkthroughService) private readonly walkthrough: WalkthroughService) {}

  @Post('solve')
  @HttpCode(200)
  @UseInterceptors(WalkthroughUploadInterceptor)
  solve(@UploadedFile() file: { size?: number; mimetype?: string } | undefined, @Body() body: unknown, @Req() req: Request) {
    const b = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
    return this.walkthrough.solve({
      subject: b.subject,
      questionText: b.question_text,
      image: file ? { size: file.size ?? 0, mimetype: file.mimetype ?? '' } : undefined,
      imageTooLarge: (req as unknown as Record<symbol, unknown>)[TOO_LARGE] === true,
    })
  }
}
