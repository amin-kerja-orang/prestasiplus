import { Body, Controller, Get, Inject, Post, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common'
import {
  QUESTION_SET_AUDIO_KBAT_CSV_TEXT,
  QUESTION_SET_AUDIO_KBAT_TEMPLATE,
  QuestionSetStudentListSchema,
} from '@pp/contract'
import type { Response } from 'express'

import { Roles } from '../../../common/guards/decorators'
import { listMeta, NoStoreInterceptor, ok, okList } from '../../../common/http'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { CLOCK, type Clock } from '../../../db/clock'
import { Actor, type ClassActor } from '../actor'
import { DskpService } from './dskp.service'
import { tableDocx } from './docx'
import { PaperUploadInterceptor } from './paper-upload.interceptor'
import type { RawPart } from './question-papers'
import { QuestionPapersService } from './question-papers.service'
import { QUESTION_SET_LIMITS } from './question-sets.constants'
import { QuestionSetsService } from './question-sets.service'

/**
 * Sends a file download with the exact Content-Type of the contract (Express `res.set` would append its own
 * charset), a `nosniff` header and the attachment name.
 */
function send(res: Response, file: { contentType: string; fileName: string }, bytes: Buffer): void {
  res.status(200)
  res.setHeader('Content-Type', file.contentType)
  res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`)
  res.setHeader('Content-Length', String(bytes.length))
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.end(bytes)
}

/** Student list "Set Soalan Guru" (S34): any signed-in user. */
@Controller('set-soalan-saya')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class StudentQuestionSetsController {
  constructor(
    @Inject(QuestionSetsService) private readonly sets: QuestionSetsService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Get()
  @RateLimit(QUESTION_SET_LIMITS.read)
  async list(@Actor() actor: ClassActor) {
    const items = await this.sets.listForStudent(actor, this.clock.now())
    return QuestionSetStudentListSchema.parse(okList(items, listMeta(1, Math.max(1, items.length), items.length)))
  }
}

/** Teacher question tools: paper upload (S22), Audio KBAT templates (S21) and the DSKP inline creates (S18). */
@Controller('guru')
@Roles('teacher', 'admin')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class TeacherQuestionToolsController {
  constructor(
    @Inject(QuestionPapersService) private readonly papers: QuestionPapersService,
    @Inject(DskpService) private readonly dskp: DskpService,
  ) {}

  @Post('question-papers')
  @RateLimit(QUESTION_SET_LIMITS.paper)
  @UseInterceptors(PaperUploadInterceptor)
  async uploadPaper(@Actor() actor: ClassActor, @Body() body: unknown, @UploadedFiles() files: RawPart[] | undefined) {
    return ok(await this.papers.submit(actor, body, files))
  }

  @Get('audio-kbat/template')
  @RateLimit(QUESTION_SET_LIMITS.read)
  csv(@Res() res: Response): void {
    send(res, QUESTION_SET_AUDIO_KBAT_TEMPLATE.csv, Buffer.from(QUESTION_SET_AUDIO_KBAT_CSV_TEXT, 'utf8'))
  }

  @Get('audio-kbat/template-word')
  @RateLimit(QUESTION_SET_LIMITS.read)
  word(@Res() res: Response): void {
    const w = QUESTION_SET_AUDIO_KBAT_TEMPLATE.word
    send(res, w, tableDocx(w.title, w.intro, [w.headings, w.example]))
  }

  @Post('dskp/bidang')
  @RateLimit(QUESTION_SET_LIMITS.write)
  async bidang(@Actor() actor: ClassActor, @Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    return this.inline(res, await this.dskp.createBidang(actor, body))
  }

  @Post('dskp/sk')
  @RateLimit(QUESTION_SET_LIMITS.write)
  async sk(@Actor() actor: ClassActor, @Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    return this.inline(res, await this.dskp.createSk(actor, body))
  }

  @Post('dskp/sp')
  @RateLimit(QUESTION_SET_LIMITS.write)
  async sp(@Actor() actor: ClassActor, @Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    return this.inline(res, await this.dskp.createSp(actor, body))
  }

  /** The live site answers a refusal with HTTP 200 and a bare `{ error }`; a created row is the default 201. */
  private inline<T extends object>(res: Response, result: T): T {
    if ('error' in result) res.status(200)
    return result
  }
}
