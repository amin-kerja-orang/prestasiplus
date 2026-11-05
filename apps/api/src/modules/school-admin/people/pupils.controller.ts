import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Inject,
  Injectable,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { SCHOOL_ADMIN_PUPIL_IMPORT_EXTENSIONS, SCHOOL_ADMIN_PUPIL_IMPORT_MAX_BYTES, SCHOOL_ADMIN_PUPIL_IMPORT_MESSAGES } from '@pp/contract'
import type { Response } from 'express'
import { catchError, throwError, type Observable } from 'rxjs'

import { ApiError, unsupportedMediaTypeMessage } from '../../../common/errors/api-error'
import { Roles } from '../../../common/guards/decorators'
import { NoStoreInterceptor, ok } from '../../../common/http'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import type { SchoolAdminReq } from '../school-admin.actor'
import { SCHOOL_ADMIN_LIMITS } from '../school-admin.constants'
import { PeopleHeadersGuard, PragmaNoCache } from './people-headers.guard'
import { peopleCtxOf } from './people.ctx'
import { PupilsService } from './pupils.service'

type Req = SchoolAdminReq

const tooLarge = (message: string): ApiError => new ApiError({ code: 'PAYLOAD_TOO_LARGE', status: 413, message })

/** A multer size limit (413, or the 400 "Field value too long") becomes the ERR-REQ-03 answer of the contract. */
@Injectable()
export class PupilImportTooLargeInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((err: unknown) =>
        err instanceof HttpException && !(err instanceof ApiError) && (err.getStatus() === 413 || (err.getStatus() === 400 && /field value too long/i.test(err.message)))
          ? throwError(() => tooLarge(SCHOOL_ADMIN_PUPIL_IMPORT_MESSAGES.tooLarge))
          : throwError(() => err),
      ),
    )
  }
}

/** The text of the file (multipart) or of the `csvFile` string (JSON). `undefined` = nothing was sent. */
function importTextOf(raw: unknown, file: { buffer: Buffer; originalname: string } | undefined): string | undefined {
  if (file) {
    const ext = /\.([^.]+)$/.exec(file.originalname)?.[1]?.toLowerCase() ?? ''
    if (!(SCHOOL_ADMIN_PUPIL_IMPORT_EXTENSIONS as readonly string[]).includes(ext)) {
      throw ApiError.of('UNSUPPORTED_MEDIA_TYPE', { message: unsupportedMediaTypeMessage(SCHOOL_ADMIN_PUPIL_IMPORT_EXTENSIONS.map((e) => e.toUpperCase())) })
    }
    return file.buffer.toString('utf8')
  }
  const text = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>).csvFile : undefined
  if (typeof text !== 'string') return undefined
  if (Buffer.byteLength(text, 'utf8') > SCHOOL_ADMIN_PUPIL_IMPORT_MAX_BYTES) throw tooLarge(SCHOOL_ADMIN_PUPIL_IMPORT_MESSAGES.tooLarge)
  return text
}

/**
 * `/admin-sekolah/pelajar/*` (BE-21 Part A). The static segments `form-options`, `export.csv` and (POST) `import` are declared before `:id`.
 * Pupils have no toggle route (a pupil id on a teacher route is 404, and the reverse). `Idempotency-Key` is accepted and
 * ignored (deviation OQ-4). Every answer is `no-store`; the credential and CSV routes also send `Pragma: no-cache`,
 * on success and on error.
 */
@Controller('admin-sekolah/pelajar')
@Roles('school_admin')
@UseGuards(PeopleHeadersGuard, RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class PupilsController {
  constructor(@Inject(PupilsService) private readonly pupils: PupilsService) {}

  @Get()
  @RateLimit(SCHOOL_ADMIN_LIMITS.read)
  list(@Req() req: Req, @Query() query: Record<string, unknown>) {
    return this.pupils.list(peopleCtxOf(req), query)
  }

  @Get('form-options')
  @RateLimit(SCHOOL_ADMIN_LIMITS.read)
  async formOptions(@Req() req: Req) {
    return ok(await this.pupils.formOptions(peopleCtxOf(req)))
  }

  @Get('export.csv')
  @PragmaNoCache()
  @RateLimit(SCHOOL_ADMIN_LIMITS.export)
  async exportCsv(@Req() req: Req, @Query() query: Record<string, unknown>, @Res({ passthrough: true }) res: Response): Promise<string> {
    const out = await this.pupils.exportCsv(peopleCtxOf(req), query)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`)
    return out.csv
  }

  /** API-AS-06 (multipart `csvFile` + `level`, or JSON). Declared before `:id`. The body is never echoed; no password is returned. */
  @Post('import')
  @HttpCode(200)
  @RateLimit(SCHOOL_ADMIN_LIMITS.create)
  @UseInterceptors(
    PupilImportTooLargeInterceptor,
    FileInterceptor('csvFile', { limits: { fileSize: SCHOOL_ADMIN_PUPIL_IMPORT_MAX_BYTES, files: 1, fieldSize: SCHOOL_ADMIN_PUPIL_IMPORT_MAX_BYTES, fields: 10 } }),
  )
  importPupils(@Req() req: Req, @Query() query: Record<string, unknown>, @Body() raw: unknown, @UploadedFile() file?: { buffer: Buffer; originalname: string }) {
    const level = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>).level : undefined
    return this.pupils.importPupils(peopleCtxOf(req), { text: importTextOf(raw, file), level, query })
  }

  @Get(':id')
  @RateLimit(SCHOOL_ADMIN_LIMITS.read)
  async detail(@Req() req: Req, @Param('id') id: string) {
    return ok(await this.pupils.detail(peopleCtxOf(req), id))
  }

  @Post()
  @HttpCode(201)
  @PragmaNoCache()
  @RateLimit(SCHOOL_ADMIN_LIMITS.create)
  create(@Req() req: Req, @Body() body: unknown) {
    return this.pupils.create(peopleCtxOf(req), body)
  }

  @Put(':id')
  @RateLimit(SCHOOL_ADMIN_LIMITS.write)
  update(@Req() req: Req, @Param('id') id: string, @Body() body: unknown) {
    return this.pupils.update(peopleCtxOf(req), id, body)
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  @PragmaNoCache()
  @RateLimit(SCHOOL_ADMIN_LIMITS.reset)
  resetPassword(@Req() req: Req, @Param('id') id: string, @Body() body: unknown) {
    return this.pupils.resetPassword(peopleCtxOf(req), id, body)
  }
}
