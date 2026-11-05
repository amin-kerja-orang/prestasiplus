import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common'
import { QUESTION_MESSAGES, QuestionBulkGroupRequestSchema, QuestionCreateRequestSchema, QuestionUpdateRequestSchema } from '@pp/contract'

import { AuditService } from '../../../common/audit'
import { Roles } from '../../../common/guards'
import { NoStoreInterceptor } from '../../../common/http'
import { ok } from '../../../common/http/respond'
import { RateLimit, RateLimitGuard, type RateLimitSpec } from '../../../common/throttle'
import { QuestionsService } from '../questions.service'
import { StimuliService } from '../stimuli.service'
import { Actor, type HttpActor } from './actor'
import { QuestionAudit } from './audit'
import { adminMeta, flash, invalid, parseAdminList, parseBody, parseBulk, parseFilterBulk } from './parse'
import { detailView, questionView, rowView } from './views'

/** D57: writes are rate limited per user. Env `THROTTLE_QUESTIONS_WRITE_PER_MINUTE`, else 60. */
export const QUESTIONS_WRITE_LIMIT = {
  bucket: 'questions-write',
  env: 'THROTTLE_QUESTIONS_WRITE_PER_MINUTE',
  default: 60,
  per: 'user',
} as const satisfies RateLimitSpec

/**
 * The admin list takes a free-text `search`. A 1 to 2 character or punctuation-only term cannot use the trigram index (migration 0106)
 * and scans the bank (about 1.8 s at 408k rows), so the route has its OWN per-user bucket instead of refusing short terms (V2 accepts
 * them). Env `THROTTLE_QUESTIONS_LIST_PER_MINUTE`, else 240 (REQ-B-061: 60 was reached by normal use, since the admin screens call
 * the list on every filter change and the Bank calls it several times per view). 240 matches the other per-user read ceilings
 * (notification inbox, wallet) and still caps a script's worst case at about 240 x 1.8 s of database time a minute per account.
 */
export const QUESTIONS_LIST_LIMIT = {
  bucket: 'questions-list',
  env: 'THROTTLE_QUESTIONS_LIST_PER_MINUTE',
  default: 240,
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
    @Inject(StimuliService) private readonly stimuli: StimuliService,
    @Inject(AuditService) audit: AuditService,
  ) {
    this.audit = new QuestionAudit(audit)
  }

  private readonly audit: QuestionAudit

  @Get()
  @RateLimit(QUESTIONS_LIST_LIMIT)
  async list(@Query() query: unknown) {
    const filter = parseAdminList(query)
    const res = await this.questions.list(filter)
    return { data: res.rows.map(rowView), meta: adminMeta(res.page, res.pageSize, res.total, res.counts) }
  }

  /** REQ-C-019: the Negeri options of the Studio filter, read from the source papers. Declared before `:id`. */
  @Get('filter-options')
  @UseInterceptors(NoStoreInterceptor)
  async filterOptions() {
    return ok(await this.questions.filterOptions())
  }

  @Get('summary')
  async summary() {
    return ok(await this.questions.summary())
  }

  @Post('bulk-action')
  @HttpCode(200)
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async bulk(@Actor() actor: HttpActor, @Body() body: unknown) {
    // S1-T01 (API-Q-04): `ids` and `groupId` together are refused before anything is parsed; `{action, groupId}` moves a whole stimulus group.
    const raw = typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {}
    if (raw.ids !== undefined && raw.groupId !== undefined) throw invalid({ groupId: QUESTION_MESSAGES.bothIdsAndGroup })
    if (raw.groupId !== undefined) {
      const group = parseBody(QuestionBulkGroupRequestSchema, body)
      const moved = await this.stimuli.bulkGroup(group.action, group.groupId, actor)
      await this.audit.bulk(actor, group.action, moved.affected, moved.affected, moved.ids, { groupId: group.groupId })
      return flash({ affected: moved.affected, failed: moved.failed }, QUESTION_MESSAGES.bulkUpdated(moved.affected))
    }
    const input = parseBulk(body)
    const { affected, ids, failed, skipped } = await this.stimuli.bulkWithGroups(input.action, input.ids, actor, (rest) => this.questions.bulkAction(input.action, rest, actor, { submitGate: true }))
    await this.audit.bulk(actor, input.action, new Set(input.ids).size, affected, ids)
    // R1E2E-10 minor 11 (Q16: skipped is information, not an error): a batch where every row was already Diterbitkan (nothing affected, at least one
    // skipped, NOTHING refused) must not flash "0 soalan berjaya dikemaskini."; it says why instead. Any refused row (`failed`) or any published row keeps
    // the count (lead decision; V2 has no wording for either case).
    const message = affected === 0 && failed.length === 0 && skipped !== undefined && skipped.length > 0 ? QUESTION_MESSAGES.bulkAlreadyApproved : QUESTION_MESSAGES.bulkUpdated(affected)
    return flash({ affected, failed, ...(skipped ? { skipped } : {}) }, message)
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

  /** API-Q-30: validates a scheme v2 body against a stored leaf. Read-only (nothing is saved), so no audit row. `partId` is the label path (`a.i`). */
  @Post(':id/parts/:partId/scheme/validate')
  @HttpCode(200)
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async validateScheme(@Param('id') id: string, @Param('partId') partId: string, @Body() body: unknown) {
    return ok(await this.questions.validateScheme(id, partId, body))
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

  /** V2 "Edit sebagai draf" (REQ-C-012): version n+1 as a draft, copied unchanged from the live version. Admin Pusat only. */
  @Post(':id/edit-as-draft')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async editAsDraft(@Actor() actor: HttpActor, @Param('id') id: string) {
    const out = await this.questions.editAsDraft(id, actor)
    await this.audit.editedAsDraft(actor, out.id, out.versionNo)
    return flash(out, QUESTION_MESSAGES.editAsDraft(out.id))
  }

  @Delete(':id')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async remove(@Actor() actor: HttpActor, @Param('id') id: string) {
    await this.questions.remove(id, actor)
    await this.audit.deleted(actor, id)
    return flash({ deleted: 1 as const }, QUESTION_MESSAGES.deleted)
  }
}

