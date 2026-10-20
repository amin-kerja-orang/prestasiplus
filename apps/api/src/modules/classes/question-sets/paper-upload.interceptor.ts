import {
  BadRequestException,
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  PayloadTooLargeException,
} from '@nestjs/common'
import { AnyFilesInterceptor } from '@nestjs/platform-express'
import { QUESTION_SET_PAPER_MESSAGES, questionSetPaperFileText } from '@pp/contract'
import type { Request } from 'express'
import type { Observable } from 'rxjs'

import { ApiError } from '../../../common/errors/api-error'
import { displayName } from './question-papers'
import { PAPER_MULTER_LIMITS } from './question-sets.constants'

const SEEN = Symbol('paper-file-names')
type WithNames = Request & { [SEEN]?: string[] }

/**
 * Reads the multipart body of `POST /guru/question-papers` into memory with hard limits, so a body over a
 * limit is cut off at that size and never buffered whole (the rate limit and the role ran before this).
 * Parser failures become the contract's 422 on `fields.files`: a file over 20 MB names itself (the name is
 * noted by `fileFilter` before its bytes stream), more than the allowed number of parts says "Maksimum 5 fail.".
 * A text field over its size limit is reported on its own field.
 */
@Injectable()
export class PaperUploadInterceptor implements NestInterceptor {
  private readonly inner: NestInterceptor

  constructor() {
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
    const req = ctx.switchToHttp().getRequest<WithNames>()
    try {
      return await this.inner.intercept(ctx, next)
    } catch (err) {
      if (err instanceof PayloadTooLargeException) {
        const name = req[SEEN]?.at(-1)
        throw ApiError.of('VALIDATION_ERROR', {
          fields: { files: name === undefined ? QUESTION_SET_PAPER_MESSAGES.files : questionSetPaperFileText(name) },
        })
      }
      if (err instanceof BadRequestException) {
        const message = err.message
        if (/too many files|unexpected field/i.test(message)) {
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
