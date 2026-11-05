import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Res, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common'
import { QUESTION_IMPORT_ERROR_CSV_FILENAME, QUESTION_IMPORT_TEMPLATE_CONTENT_TYPE, QUESTION_IMPORT_TEMPLATE_FILENAME } from '@pp/contract'
import type { Response } from 'express'

import { NoStoreInterceptor } from '../../../../common/http/no-store.interceptor'
import { RateLimit, RateLimitGuard } from '../../../../common/throttle'
import { Actor, AdminOnly, AdminOrGuru, type WorkflowActor } from '../actor'
import { IMPORT_LIMITS } from './imports.constants'
import { CsvUploadInterceptor, CsvZipUploadInterceptor } from './imports.interceptor'
import { QuestionImportsService, type UploadedCsv } from './imports.service'

function sendTemplate(res: Response, text: string, filename: string = QUESTION_IMPORT_TEMPLATE_FILENAME): void {
  res
    .status(200)
    .set({
      'Content-Type': `${QUESTION_IMPORT_TEMPLATE_CONTENT_TYPE}; charset=utf-8`,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    })
    .send(Buffer.from(text, 'utf8'))
}

/** Admin Pusat routes of the CSV import (`/question-imports`). Admin Sekolah and every other role: 403. */
@AdminOnly()
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
@Controller('question-imports')
export class QuestionImportsController {
  constructor(@Inject(QuestionImportsService) private readonly imports: QuestionImportsService) {}

  @Get()
  list(@Query() query: unknown) {
    return this.imports.list(query)
  }

  // Static path: declared before any `:id` route.
  @Get('template')
  template(@Res() res: Response): void {
    sendTemplate(res, this.imports.template())
  }

  /** Error report of one run: `baris, question_key, medan, kod_ralat, mesej`. After the static `template`. */
  @Get(':id/errors')
  async errors(@Param('id') id: string, @Res() res: Response): Promise<void> {
    sendTemplate(res, await this.imports.errorsCsv(id), QUESTION_IMPORT_ERROR_CSV_FILENAME)
  }

  @Post()
  @HttpCode(201)
  @RateLimit(IMPORT_LIMITS.write)
  @UseInterceptors(CsvZipUploadInterceptor)
  create(@Actor() actor: WorkflowActor, @UploadedFiles() files: { csvFile?: UploadedCsv[]; zipFile?: UploadedCsv[] } | undefined, @Body() body: unknown) {
    return this.imports.importAdmin(actor, files?.csvFile?.[0], body, files?.zipFile?.[0])
  }
}

/** Guru contribution import (`/guru/questions/import|template`); an admin may use it too. */
@AdminOrGuru()
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
@Controller('guru/questions')
export class GuruQuestionImportController {
  constructor(@Inject(QuestionImportsService) private readonly imports: QuestionImportsService) {}

  @Get('template')
  template(@Res() res: Response): void {
    sendTemplate(res, this.imports.template())
  }

  @Post('import')
  @HttpCode(200)
  @RateLimit(IMPORT_LIMITS.write)
  @UseInterceptors(CsvUploadInterceptor)
  import(@Actor() actor: WorkflowActor, @UploadedFile() file: UploadedCsv | undefined) {
    return this.imports.importGuru(actor, file)
  }
}
