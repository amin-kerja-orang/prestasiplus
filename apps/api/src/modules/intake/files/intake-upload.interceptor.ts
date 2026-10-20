import { BadRequestException, type CallHandler, type ExecutionContext, Inject, Injectable, type NestInterceptor, PayloadTooLargeException } from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { INTAKE_FILE_MESSAGES, INTAKE_UPLOAD_FIELD } from '@pp/contract'
import type { Observable } from 'rxjs'

import { ApiError } from '../../../common/errors/api-error'
import { FilesConfig } from '../../files/files.config'
import { IntakeFilesConfig } from './intake-files.config'

/**
 * Reads the multipart body into memory with hard limits (BE-37): `INTAKE_MAX_FILE_MB` per part, at most
 * `INTAKE_MAX_FILES_PER_BATCH` + 1 file parts (the service refuses one more than the batch allows with the
 * proper message), few text fields, few parts. Multer errors become the contract's 422 on `fields.files`: too
 * large gives the size message in MB, too many files the count message, anything else (wrong field name,
 * malformed body) the type message.
 */
@Injectable()
export class IntakeUploadInterceptor implements NestInterceptor {
  private readonly inner: NestInterceptor
  private readonly maxMb: number
  private readonly maxFiles: number

  constructor(
    @Inject(FilesConfig) files: FilesConfig,
    @Inject(IntakeFilesConfig) config: IntakeFilesConfig,
  ) {
    this.maxMb = Math.floor(files.intakeMaxBytes / (1024 * 1024))
    this.maxFiles = config.maxFilesPerBatch
    // maxCount is one above the multer file limit, so the limit ("Too many files") always fires first.
    const Interceptor = FilesInterceptor(INTAKE_UPLOAD_FIELD, this.maxFiles + 2, {
      limits: {
        fileSize: files.intakeMaxBytes,
        files: this.maxFiles + 1,
        fields: 4,
        fieldSize: 1024,
        parts: this.maxFiles + 1 + 4,
        headerPairs: 50,
      },
    })
    this.inner = new Interceptor({})
  }

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    try {
      return await this.inner.intercept(ctx, next)
    } catch (err) {
      if (err instanceof PayloadTooLargeException) {
        throw ApiError.of('VALIDATION_ERROR', { fields: { files: INTAKE_FILE_MESSAGES.size(this.maxMb) } })
      }
      if (err instanceof BadRequestException) {
        const tooMany = /too many files/i.test(err.message)
        throw ApiError.of('VALIDATION_ERROR', {
          fields: { files: tooMany ? INTAKE_FILE_MESSAGES.tooManyFiles(this.maxFiles) : INTAKE_FILE_MESSAGES.type },
        })
      }
      throw err
    }
  }
}
