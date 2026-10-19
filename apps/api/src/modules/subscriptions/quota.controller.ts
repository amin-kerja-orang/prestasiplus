import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Injectable,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { STUDENT_IMPORT_MAX_BYTES, STUDENT_IMPORT_MESSAGES } from '@pp/contract'
import type { Request } from 'express'
import { catchError, throwError, type Observable } from 'rxjs'

import { Roles } from '../../common/guards/decorators'
import { NoStoreInterceptor, ok } from '../../common/http'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { CurrentCaller, type Caller } from '../users/caller'
import { QuotaService } from './quota.service'
import { StudentImportService } from './student-import.service'
import { SUBSCRIPTION_LIMITS } from './subscriptions.constants'
import { tooLarge } from './subscriptions.errors'

/** multer `LIMIT_FIELD_VALUE` (a text field over `fieldSize`) arrives as a 400 "Field value too long". */
const isFieldTooLong = (err: HttpException): boolean => err.getStatus() === 400 && /field value too long/i.test(err.message)

/** A multer size limit (413) becomes the contract `PAYLOAD_TOO_LARGE` error with the student-import copy. */
@Injectable()
export class StudentImportTooLargeInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((err: unknown) =>
        err instanceof HttpException && (err.getStatus() === 413 || isFieldTooLong(err))
          ? throwError(() => tooLarge(STUDENT_IMPORT_MESSAGES.tooLarge))
          : throwError(() => err),
      ),
    )
  }
}

interface UploadedText {
  buffer: Buffer
}

/**
 * School quota and the DELIMa student import (BE-25 part A). Central admin only (a school_admin gets
 * 403, as the contract and the mock). `no-store`: the import answers about minors' accounts.
 */
@Controller('admin')
@Roles('admin')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class QuotaController {
  constructor(
    private readonly quota: QuotaService,
    private readonly imports: StudentImportService,
  ) {}

  @Get('schools/:id/quota')
  @RateLimit(SUBSCRIPTION_LIMITS.read)
  async schoolQuota(@Param('id') id: string) {
    return ok(await this.quota.ofSchool(id))
  }

  /** JSON, or multipart/form-data with the file in `csvFile` (a file or field over 1 MB is 413). */
  @Post('students/import')
  @HttpCode(200)
  @RateLimit(SUBSCRIPTION_LIMITS.import)
  @UseInterceptors(
    StudentImportTooLargeInterceptor,
    FileInterceptor('csvFile', { limits: { fileSize: STUDENT_IMPORT_MAX_BYTES, files: 1, fieldSize: STUDENT_IMPORT_MAX_BYTES, fields: 10 } }),
  )
  async importStudents(@CurrentCaller() caller: Caller, @Req() req: Request, @Body() raw: unknown, @UploadedFile() file?: UploadedText) {
    const multipart = Boolean(req.is('multipart/form-data'))
    const body = multipart
      ? { ...(typeof raw === 'object' && raw !== null ? raw : {}), ...(file ? { csvFile: file.buffer.toString('utf8') } : {}) }
      : raw
    const { result, status } = await this.imports.run(caller, body, multipart)
    return { data: result, status }
  }
}
