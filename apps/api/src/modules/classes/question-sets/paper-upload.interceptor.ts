import {
  BadRequestException,
  Inject,
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  PayloadTooLargeException,
} from '@nestjs/common'
import { AnyFilesInterceptor } from '@nestjs/platform-express'
import { QUESTION_SET_PAPER_MESSAGES, questionSetPaperFileText } from '@pp/contract'
import type { Request, Response } from 'express'
import type { Observable } from 'rxjs'

import { ApiError } from '../../../common/errors/api-error'
import { AUTH_CONTEXT_KEY, type RequestWithAuth } from '../../../common/scope/auth-context'
import { PaperUploadSlots } from './paper-upload.slots'
import { displayName } from './question-papers'
import { PAPER_MAX_BODY_BYTES, PAPER_MULTER_LIMITS } from './question-sets.constants'

const SEEN = Symbol('paper-file-names')
type WithNames = Request & RequestWithAuth & { [SEEN]?: string[] }

/**
 * Reads the multipart body of `POST /guru/question-papers` into memory with hard limits, so a body over a
 * limit is cut off at that size and never buffered whole (the rate limit and the role ran before this).
 * Parser failures become the contract's 422 on `fields.files`: a file over 20 MB names itself (the name is
 * noted by `fileFilter` before its bytes stream), more than the allowed number of parts says "Maksimum 5 fail.".
 * A text field over its size limit is reported on its own field.
 *
 * Memory guards, before any byte is read: a `Content-Length` over `PAPER_MAX_BODY_BYTES` is refused with the
 * 422 `fields.files = "Maksimum 5 fail."` (the closest existing message: such a body cannot hold 5 valid files);
 * and one upload per user (a few in all) may be in flight, else 429 `RATE_LIMITED` with `Retry-After`. The slot
 * is released when the response closes, whatever the outcome.
 */
@Injectable()
export class PaperUploadInterceptor implements NestInterceptor {
  private readonly inner: NestInterceptor

  constructor(@Inject(PaperUploadSlots) private readonly slots: PaperUploadSlots) {
    const Interceptor = AnyFilesInterceptor({
      limits: { ...PAPER_MULTER_LIMITS },
      fileFilter: (req, file, cb) => {
        const r = req as WithNames
        ;(r[SEEN] ??= []).push(displayName(file.originalname))
        cb(null, true)
      },
    })
    this.inner = new Interceptor({})
  }

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const http = ctx.switchToHttp()
    const req = http.getRequest<WithNames>()
    const length = Number(req.headers['content-length'])
    if (Number.isFinite(length) && length > PAPER_MAX_BODY_BYTES) {
      throw ApiError.of('VALIDATION_ERROR', { fields: { files: QUESTION_SET_PAPER_MESSAGES.tooMany } })
    }
    const release = this.slots.acquire(req[AUTH_CONTEXT_KEY]?.userId ?? 'anonymous')
    http.getResponse<Response>().once('close', release)
    try {
      return await this.inner.intercept(ctx, next)
    } catch (err) {
      release()
      if (err instanceof PayloadTooLargeException) {
        const name = req[SEEN]?.at(-1)
        throw ApiError.of('VALIDATION_ERROR', {
          fields: { files: name === undefined ? QUESTION_SET_PAPER_MESSAGES.files : questionSetPaperFileText(name) },
        })
      }
      if (err instanceof BadRequestException) {
        const message = err.message
        if (/too many (files|parts|fields)|unexpected field/i.test(message)) {
          throw ApiError.of('VALIDATION_ERROR', { fields: { files: QUESTION_SET_PAPER_MESSAGES.tooMany } })
        }
        if (/field value too long/i.test(message)) {
          throw ApiError.of('VALIDATION_ERROR', { fields: { catatan: QUESTION_SET_PAPER_MESSAGES.note } })
        }
        throw ApiError.of('VALIDATION_ERROR', { fields: { files: QUESTION_SET_PAPER_MESSAGES.files } })
      }
      throw err
    }
  }
}
