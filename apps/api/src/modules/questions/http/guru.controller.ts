import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { QuestionGuruCreateRequestSchema, QuestionGuruUpdateRequestSchema } from '@pp/contract'

import { AuditService } from '../../../common/audit'
import { Roles } from '../../../common/guards'
import { listMeta, ok } from '../../../common/http/respond'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { questionNotFound } from '../errors'
import { QuestionsService } from '../questions.service'
import { Actor, type HttpActor } from './actor'
import { QuestionAudit } from './audit'
import { QUESTIONS_WRITE_LIMIT } from './admin.controller'
import { GURU_PAGE_SIZE, parseBody, parseGuruPage } from './parse'
import { guruDetailView, guruSummaryView } from './views'

/**
 * Guru contribution routes: a teacher (or Admin Pusat) works on the questions they own. Another
 * owner's id is 404, never 403, so ids cannot be probed. A submission is saved as `review`.
 */
@Roles('teacher', 'admin')
@Controller('guru/questions')
@UseGuards(RateLimitGuard)
export class GuruQuestionsController {
  constructor(
    @Inject(QuestionsService) private readonly questions: QuestionsService,
    @Inject(AuditService) audit: AuditService,
  ) {
    this.audit = new QuestionAudit(audit)
  }

  private readonly audit: QuestionAudit

  /** 404 unless the question exists and the caller created it (before any body is read). */
  private async assertOwn(id: string, actor: HttpActor): Promise<void> {
    const info = await this.questions.getStatus(id)
    if (info.createdById !== actor.userId) throw questionNotFound()
  }

  @Get()
  async list(@Actor() actor: HttpActor, @Query() query: unknown) {
    const res = await this.questions.listOwn(actor.userId, parseGuruPage(query), GURU_PAGE_SIZE)
    return { data: res.rows.map(guruSummaryView), meta: listMeta(res.page, res.pageSize, res.total) }
  }

  @Get(':id')
  async get(@Actor() actor: HttpActor, @Param('id') id: string) {
    return ok(guruDetailView(await this.questions.getOwn(id, actor.userId)))
  }

  @Post()
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async create(@Actor() actor: HttpActor, @Body() body: unknown) {
    const input = parseBody(QuestionGuruCreateRequestSchema, body)
    const created = await this.questions.createGuru(input, actor.userId)
    await this.audit.created(actor, created.id, created.version.status)
    return ok(guruDetailView(created))
  }

  @Put(':id')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async update(@Actor() actor: HttpActor, @Param('id') id: string, @Body() body: unknown) {
    await this.assertOwn(id, actor)
    const input = parseBody(QuestionGuruUpdateRequestSchema, body)
    const updated = await this.questions.updateOwn(id, input, actor.userId)
    await this.audit.updated(actor, updated.id)
    return ok(guruDetailView(updated))
  }

  @Delete(':id')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async remove(@Actor() actor: HttpActor, @Param('id') id: string) {
    await this.questions.removeOwn(id, actor.userId)
    await this.audit.deleted(actor, id)
    return ok({ removed: 1 as const })
  }
}
