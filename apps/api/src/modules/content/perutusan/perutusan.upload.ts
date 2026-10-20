import { BadRequestException, type CallHandler, type ExecutionContext, Injectable, type NestInterceptor, PayloadTooLargeException } from '@nestjs/common'
import { FileFieldsInterceptor } from '@nestjs/platform-express'
import { contentFileRefused } from '@pp/contract'
import type { Observable } from 'rxjs'

import { ApiError } from '../../../common/errors/api-error'
import {
  BODY_FIELD_BYTES,
  FILE_REFUSED_FALLBACK,
  MAX_DOCUMENTS,
  MAX_IMAGES,
  PERUTUSAN_MAX_DOCUMENT_BYTES,
} from './perutusan.constants'

/** The file field names a client may use: `images` as the browser form sends it, `images[]` as the contract writes it. */
const FIELDS = [
  { name: 'images', maxCount: MAX_IMAGES },
  { name: 'images[]', maxCount: MAX_IMAGES },
  { name: 'documents', maxCount: MAX_DOCUMENTS },
  { name: 'documents[]', maxCount: MAX_DOCUMENTS },
]

const TEXT_FIELD_COUNT = 12

/**
 * Reads the multipart body of `POST /perutusan` into memory with hard limits, before any file is judged: the byte cap of
 * the biggest allowed file (5 MB, documents; the 2 MB image cap is checked on the content), a file count, a text-field
 * size and a part count. It runs after the global guards and the rate limiter, so only an authorised writer ever reaches
 * it. A multer refusal (too large, too many files, an unexpected file field, a broken body) becomes the contract 422 with
 * the per-file message of the mock under `fields.form`.
 */
@Injectable()
export class PerutusanUploadInterceptor implements NestInterceptor {
  private readonly inner: NestInterceptor

  constructor() {
    const Interceptor = FileFieldsInterceptor(FIELDS, {
      limits: {
        files: MAX_IMAGES + MAX_DOCUMENTS,
        fileSize: PERUTUSAN_MAX_DOCUMENT_BYTES,
        fields: TEXT_FIELD_COUNT,
        fieldSize: BODY_FIELD_BYTES,
        parts: MAX_IMAGES + MAX_DOCUMENTS + TEXT_FIELD_COUNT,
        headerPairs: 50,
      },
    })
    this.inner = new Interceptor({})
  }

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    try {
      return await this.inner.intercept(ctx, next)
    } catch (err) {
      if (err instanceof PayloadTooLargeException || err instanceof BadRequestException) {
        throw ApiError.of('VALIDATION_ERROR', { fields: { form: contentFileRefused(FILE_REFUSED_FALLBACK) } })
      }
      throw err
    }
  }
}
