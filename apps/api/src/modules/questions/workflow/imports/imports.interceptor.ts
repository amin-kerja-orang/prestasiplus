import {
  BadRequestException,
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  PayloadTooLargeException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { QUESTION_IMPORT_MAX_BYTES, QUESTION_IMPORT_MESSAGES } from '@pp/contract'
import type { Observable } from 'rxjs'

import { ApiError } from '../../../../common/errors/api-error'

const Inner = FileInterceptor('csvFile', {
  limits: { files: 1, fields: 4, fieldSize: 1024, parts: 6, headerPairs: 50, fileSize: QUESTION_IMPORT_MAX_BYTES },
})

/**
 * Reads the multipart body (memory storage, cut off at 5 MB, so a bigger body is never buffered
 * whole). Multer errors become the contract's 422 on `fields.csvFile`: too large gives the file
 * message, anything else (wrong field name, extra file, malformed body) gives "Sila pilih fail CSV.".
 * Guards (session, CSRF, role, rate limit) have already run.
 */
@Injectable()
export class CsvUploadInterceptor implements NestInterceptor {
  private readonly inner = new Inner({})

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    try {
      return await this.inner.intercept(ctx, next)
    } catch (err) {
      if (err instanceof PayloadTooLargeException) {
        throw ApiError.of('VALIDATION_ERROR', { fields: { csvFile: QUESTION_IMPORT_MESSAGES.fileType } })
      }
      if (err instanceof BadRequestException) {
        throw ApiError.of('VALIDATION_ERROR', { fields: { csvFile: QUESTION_IMPORT_MESSAGES.fileRequired } })
      }
      throw err
    }
  }
}
