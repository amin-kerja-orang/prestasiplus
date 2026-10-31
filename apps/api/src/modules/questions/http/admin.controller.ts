import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { QUESTION_MESSAGES, QuestionCreateRequestSchema, QuestionUpdateRequestSchema } from '@pp/contract'

import { AuditService } from '../../../common/audit'
import { Roles } from '../../../common/guards'
import { ok } from '../../../common/http/respond'
import { RateLimit, RateLimitGuard, type RateLimitSpec } from '../../../common/throttle'
import { QuestionsService } from '../questions.service'
import { Actor, type HttpActor } from './actor'
import { QuestionAudit } from './audit'
import { adminMeta, flash, parseAdminList, parseBody, parseBulk, parseFilterBulk } from './parse'
import { detailView, questionView, rowView } from './views'

/** D57: writes are rate limited per user. Env `THROTTLE_QUESTIONS_WRITE_PER_MINUTE`, else 60. */
export const QUESTIONS_WRITE_LIMIT = {
  bucket: 'questions-write',
  env: 'THROTTLE_QUESTIONS_WRITE_PER_MINUTE',
  default: 60,
  per: 'user',
} as const satisfies RateLimitSpec

/**
 * Admin routes of the question bank (SRS M04 #1 to #7): the `admin` role only (Admin Pusat). CSRF on
 * every mutation is enforced by the session guard. `summary` and `bulk-action` are declared before
 * `:id` so they are never read as ids.
 */
@Roles('admin')
@Controller('questions')
@UseGuards(RateLimitGuard)
export class AdminQuestionsController {
  constructor(
    @Inject(QuestionsService) private readonly questions: QuestionsService,
    @Inject(AuditService) audit: AuditService,
  ) {
    this.audit = new QuestionAudit(audit)
  }

  private readonly audit: QuestionAudit

  @Get()
  async list(@Query() query: unknown) {
    const filter = parseAdminList(query)
    const res = await this.questions.list(filter)
    return { data: res.rows.map(rowView), meta: adminMeta(res.page, res.pageSize, res.total, res.counts) }
  }

  @Get('summary')
  async summary() {
    return ok(await this.questions.summary())
  }

  @Post('bulk-action')
  @HttpCode(200)
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async bulk(@Actor() actor: HttpActor, @Body() body: unknown) {
    const input = parseBulk(body)
    const { affected, ids, failed } = await this.questions.bulkAction(input.action, input.ids, actor)
    await this.audit.bulk(actor, input.action, new Set(input.ids).size, affected, ids)
    return flash({ affected, failed }, QUESTION_MESSAGES.bulkUpdated(affected))
  }

  /**
   * AC-03.3, V2 "Luluskan Hasil Tapisan" / "Arkib Semua": the action on the rows of the current filter. Declared before `:id`.
   * Strict body; `expectedCount` must be the count the client showed (409 otherwise); one run applies at most `FILTER_ACTION_CAP` rows.
   */
  @Post('bulk-action/filter')
  @HttpCode(200)
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async bulkFilter(@Actor() actor: HttpActor, @Body() body: unknown) {
    const input = parseFilterBulk(body)
    const out = await this.questions.bulkByFilter(input, actor)
    if (!out.dryRun) await this.audit.bulkFilter(actor, input.action, input.filter, out.matched, out.processed, out.affected, out.ids)
    const { ids: _ids, ...data } = out
    void _ids
    const status = out.dryRun
      ? `${String(out.eligible)} soalan boleh diproses daripada ${String(out.matched)} hasil tapisan.`
      : input.action === 'approved'
        ? QUESTION_MESSAGES.filterApproved(out.affected)
        : input.filterEmpty
          ? QUESTION_MESSAGES.filterArchivedAll(out.affected)
          : QUESTION_MESSAGES.filterArchived(out.affected)
    return flash(data, status)
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return ok(detailView(await this.questions.getAdmin(id)))
  }

  @Post()
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async create(@Actor() actor: HttpActor, @Body() body: unknown) {
    const input = parseBody(QuestionCreateRequestSchema, body)
    const created = await this.questions.create(input, actor)
    await this.audit.created(actor, created.id, created.version.status)
    return flash(questionView(created), QUESTION_MESSAGES.added)
  }

  @Put(':id')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async update(@Actor() actor: HttpActor, @Param('id') id: string, @Body() body: unknown) {
    // A missing record is 404 before a bad body is 422, like the mock.
    await this.questions.getStatus(id)
    const input = parseBody(QuestionUpdateRequestSchema, body)
    const updated = await this.questions.update(id, input, actor)
    await this.audit.updated(actor, updated.id)
    return flash(questionView(updated), QUESTION_MESSAGES.updated)
  }

  @Delete(':id')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async remove(@Actor() actor: HttpActor, @Param('id') id: string) {
    await this.questions.remove(id, actor)
    await this.audit.deleted(actor, id)
    return flash({ deleted: 1 as const }, QUESTION_MESSAGES.deleted)
  }
}

