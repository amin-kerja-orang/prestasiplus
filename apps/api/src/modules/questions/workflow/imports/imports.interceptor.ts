import {
  BadRequestException,
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  PayloadTooLargeException,
} from '@nestjs/common'
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express'
import { QUESTION_IMPORT_CODE_ROW_MESSAGES, QUESTION_IMPORT_MAX_BYTES, QUESTION_IMPORT_MESSAGES } from '@pp/contract'
import type { Observable } from 'rxjs'

import { ApiError } from '../../../../common/errors/api-error'
import { IMPORT_ZIP } from './imports.constants'

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
        // A multer problem (an unexpected part such as a `zipFile` on the Guru route, a malformed body) is not a missing file: ERR-REQ-01.
        // The missing-file text "Sila pilih fail CSV." is the service's, when the `csvFile` part is simply absent.
        throw ApiError.of('VALIDATION_ERROR', { fields: { csvFile: QUESTION_IMPORT_CODE_ROW_MESSAGES.requestInvalid } })
      }
      throw err
    }
  }
}

const InnerWithZip = FileFieldsInterceptor(
  [
    { name: 'csvFile', maxCount: 1 },
    { name: 'zipFile', maxCount: 1 },
  ],
  { limits: { files: 2, fields: 4, fieldSize: 1024, parts: 7, headerPairs: 50, fileSize: IMPORT_ZIP.maxBytes } },
)

/**
 * Admin import: `csvFile` plus the optional `zipFile` (memory storage). Multer has ONE size ceiling for both parts, so it is the ZIP's 20 MB; the
 * CSV is held to 5 MB by the service (`readFile`) right after. A body over 20 MB is cut off and cannot be told apart by field: it answers on both
 * (`csvFile` with the 5 MB text, `zipFile` with ERR-REQ-01).
 */
@Injectable()
export class CsvZipUploadInterceptor implements NestInterceptor {
  private readonly inner = new InnerWithZip({})

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    try {
      return await this.inner.intercept(ctx, next)
    } catch (err) {
      if (err instanceof PayloadTooLargeException) {
        throw ApiError.of('VALIDATION_ERROR', { fields: { csvFile: QUESTION_IMPORT_MESSAGES.fileType, zipFile: QUESTION_IMPORT_CODE_ROW_MESSAGES.requestInvalid } })
      }
      if (err instanceof BadRequestException) {
        // A multer problem (an unexpected part such as a `zipFile` on the Guru route, a malformed body) is not a missing file: ERR-REQ-01.
        // The missing-file text "Sila pilih fail CSV." is the service's, when the `csvFile` part is simply absent.
        throw ApiError.of('VALIDATION_ERROR', { fields: { csvFile: QUESTION_IMPORT_CODE_ROW_MESSAGES.requestInvalid } })
      }
      throw err
    }
  }
}
