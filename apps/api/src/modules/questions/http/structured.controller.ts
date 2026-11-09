import { Body, Controller, Get, Inject, Param, Put, Query, UseGuards } from '@nestjs/common'
import { StructuredRubricUpdateRequestSchema, STRUCTURED_RUBRIC_MESSAGES } from '@pp/contract'

import { AuditService } from '../../../common/audit'
import { Roles } from '../../../common/guards'
import { listMeta, ok } from '../../../common/http/respond'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { QuestionsService } from '../questions.service'
import { Actor, type HttpActor } from './actor'
import { QUESTIONS_WRITE_LIMIT } from './admin.controller'
import { QuestionAudit } from './audit'
import { flash, parseBody, parseStructuredList } from './parse'
import { structuredDetailView, structuredRowView } from './views'

/** Structured-question reads (SRS M04): the `admin` role only. `meta.stats` covers the whole store. */
@Roles('admin')
@Controller('structured-questions')
@UseGuards(RateLimitGuard)
export class StructuredQuestionsController {
  private readonly audit: QuestionAudit

  constructor(
    @Inject(QuestionsService) private readonly questions: QuestionsService,
    @Inject(AuditService) audit: AuditService,
  ) {
    this.audit = new QuestionAudit(audit)
  }

  @Get()
  async list(@Query() query: unknown) {
    const res = await this.questions.listStructured(parseStructuredList(query))
    return {
      data: res.rows.map(structuredRowView),
      meta: { ...listMeta(res.page, res.pageSize, res.total), stats: res.stats },
    }
  }

  /** V2 Panel Subjektif Sunting: scheme and rubric points. Declared before `:id` so `rubric` is never read as an id. */
  @Get(':id/rubric')
  async rubric(@Param('id') id: string) {
    return ok(await this.questions.getStructuredRubric(id))
  }

  @Put(':id/rubric')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async saveRubric(@Actor() actor: HttpActor, @Param('id') id: string, @Body() body: unknown) {
    // A missing record is 404 before a bad body is 422, like the question PUT.
    await this.questions.getStructuredRubric(id)
    const input = parseBody(StructuredRubricUpdateRequestSchema, body)
    const saved = await this.questions.saveStructuredRubric(id, input.subs, actor)
    await this.audit.updated(actor, id)
    return flash(saved, STRUCTURED_RUBRIC_MESSAGES.saved)
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return ok(structuredDetailView(await this.questions.getStructured(id)))
  }
}
