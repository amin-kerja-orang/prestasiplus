import {
  BadRequestException,
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  PayloadTooLargeException,
} from '@nestjs/common'
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express'
import {
  QUESTION_IMPORT_CODE_ROW_MESSAGES,
  QUESTION_IMPORT_GURU_MAX_BYTES,
  QUESTION_IMPORT_GURU_MESSAGES,
  QUESTION_IMPORT_MAX_BYTES,
  QUESTION_IMPORT_MESSAGES,
} from '@pp/contract'
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

const GuruInner = FileInterceptor('csvFile', {
  // No text field is read (the file is the only part), so none is buffered.
  limits: { files: 1, fields: 0, fieldSize: 1024, parts: 2, headerPairs: 50, fileSize: QUESTION_IMPORT_GURU_MAX_BYTES },
})

/** The file plus multipart framing: a body whose Content-Length is over this cannot hold a 2 MB file (checked before multer reads anything). */
const GURU_CSV_MAX_BODY_BYTES = Math.ceil(QUESTION_IMPORT_GURU_MAX_BYTES * 1.05)

/**
 * The teacher's upload (API-GUR-19): a Content-Length over about 2.1 MB is refused before multer, the file is cut off at 2 MB and no text field
 * is buffered. A JSON body (`{ csv }`) passes through untouched; it is limited to the default 100 kb JSON parser (no bigger parser is opened for
 * this route), so the 2 MB limit applies to the multipart path only. Refusals are 422 `fields.csvFile`. The admin interceptor above is unchanged.
 */
@Injectable()
export class GuruCsvUploadInterceptor implements NestInterceptor {
  private readonly inner = new GuruInner({})

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const length = Number(ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>().headers['content-length'])
    if (Number.isFinite(length) && length > GURU_CSV_MAX_BODY_BYTES) {
      throw ApiError.of('VALIDATION_ERROR', { fields: { csvFile: QUESTION_IMPORT_GURU_MESSAGES.fileSize } })
    }
    try {
      return await this.inner.intercept(ctx, next)
    } catch (err) {
      if (err instanceof PayloadTooLargeException) {
        throw ApiError.of('VALIDATION_ERROR', { fields: { csvFile: QUESTION_IMPORT_GURU_MESSAGES.fileSize } })
      }
      if (err instanceof BadRequestException) {
        // An unexpected part (a `zipFile` on this route: no ZIP here) is not a missing file: ERR-REQ-01 (S1-T05 part 3).
        if (err.message === 'Too many files' || err.message === 'Unexpected file field') throw ApiError.of('VALIDATION_ERROR', { fields: { csvFile: QUESTION_IMPORT_CODE_ROW_MESSAGES.requestInvalid } })
        throw ApiError.of('VALIDATION_ERROR', { fields: { csvFile: QUESTION_IMPORT_GURU_MESSAGES.fileRequired } })
      }
      throw err
    }
  }
}
