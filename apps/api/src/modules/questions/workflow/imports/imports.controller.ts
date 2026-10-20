import { Body, Controller, Get, HttpCode, Inject, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { QUESTION_IMPORT_TEMPLATE_CONTENT_TYPE, QUESTION_IMPORT_TEMPLATE_FILENAME } from '@pp/contract'
import type { Response } from 'express'

import { NoStoreInterceptor } from '../../../../common/http/no-store.interceptor'
import { RateLimit, RateLimitGuard } from '../../../../common/throttle'
import { Actor, AdminOnly, AdminOrGuru, type WorkflowActor } from '../actor'
import { IMPORT_LIMITS } from './imports.constants'
import { CsvUploadInterceptor } from './imports.interceptor'
import { QuestionImportsService, type UploadedCsv } from './imports.service'

function sendTemplate(res: Response, text: string): void {
  res
    .status(200)
    .set({
      'Content-Type': `${QUESTION_IMPORT_TEMPLATE_CONTENT_TYPE}; charset=utf-8`,
      'Content-Disposition': `attachment; filename="${QUESTION_IMPORT_TEMPLATE_FILENAME}"`,
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

  @Post()
  @HttpCode(201)
  @RateLimit(IMPORT_LIMITS.write)
  @UseInterceptors(CsvUploadInterceptor)
  create(@Actor() actor: WorkflowActor, @UploadedFile() file: UploadedCsv | undefined, @Body() body: unknown) {
    return this.imports.importAdmin(actor, file, body)
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
