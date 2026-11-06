import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { GURU_STRUCTURED_PAGE_SIZE, GuruStructuredCreateRequestSchema, GuruStructuredUpdateRequestSchema } from '@pp/contract'

import { Roles } from '../../../common/guards'
import { listMeta, ok } from '../../../common/http/respond'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { GuruSubmissionsService, STRUCTURED_ID_PREFIX } from '../../intake/files/guru-submissions.service'
import { QuestionsService } from '../questions.service'
import { Actor, type HttpActor } from './actor'
import { QUESTIONS_WRITE_LIMIT } from './admin.controller'
import { parseBody, parseGuruStructuredList } from './parse'
import { guruStructuredDetailView, guruStructuredRowView } from './views'

/**
 * API-GUR-26 (R1-GUR-44b): the teacher mount over the same read service as the admin structured reads. Read-only; approved questions a pupil is
 * served plus the CALLER's own `review` structured submissions (S6-T17, lead ruling B), 20 per page. Order of the union: own submissions first
 * (newest first), then approved questions (newest first); `meta.totalItems` is the union count. Another teacher's submission is never returned
 * (404 on the detail). `student` and `school_admin` get 403 from the role guard.
 */
@Roles('teacher', 'admin')
@Controller('guru/structured-questions')
export class GuruStructuredQuestionsController {
  constructor(
    @Inject(QuestionsService) private readonly questions: QuestionsService,
    @Inject(GuruSubmissionsService) private readonly submissions: GuruSubmissionsService,
  ) {}

  @Get()
  async list(@Actor() actor: HttpActor, @Query() query: unknown) {
    const { filter, status } = parseGuruStructuredList(query)
    const own = { subjectId: filter.subjectId, educationLevelId: filter.educationLevelId }
    const offset = (filter.page - 1) * GURU_STRUCTURED_PAGE_SIZE
    // Each own row sits under its real status: an accepted item whose question the approved side lists shows there (once); a published but
    // hidden one (inactive, needs a diagram) is an own `approved` row; the rest are `review`.
    const accepted = await this.submissions.ownAcceptedQuestions(actor.userId)
    const served = [...(await this.questions.servedStructuredAmong(accepted.all))]
    const scope = { status, served, published: accepted.published } as const
    const ownTotal = await this.submissions.countOwnStructured(actor.userId, own, scope)
    const ownRows = await this.submissions.listOwnStructured(actor.userId, own, offset, GURU_STRUCTURED_PAGE_SIZE, scope)
    const approved =
      status === 'review'
        ? { rows: [], total: 0 }
        : await this.questions.listGuruStructured({ ...filter, offset: Math.max(0, offset - ownTotal), limit: GURU_STRUCTURED_PAGE_SIZE - ownRows.length })
    const rows = [
      ...ownRows.map((r, i) => ({ ...r, number: offset + i + 1 })),
      ...approved.rows.map((q, i) => guruStructuredRowView(q, offset + ownRows.length + i + 1)),
    ]
    return { data: rows, meta: listMeta(filter.page, GURU_STRUCTURED_PAGE_SIZE, ownTotal + approved.total) }
  }

  @Get(':id')
  async get(@Actor() actor: HttpActor, @Param('id') id: string) {
    if (id.startsWith(STRUCTURED_ID_PREFIX)) return ok(await this.submissions.getStructured(actor.userId, id))
    return ok(guruStructuredDetailView(await this.questions.getGuruStructured(id)))
  }
}

/**
 * API-GUR-17, structured variant (S6-T17, ADD-13): a teacher (or Admin Pusat) submits a structured question as ONE guru intake batch with ONE
 * structured item. Own items only (another owner's id is 404); an edit or delete of an item the admin already accepted is 409.
 */
@Roles('teacher', 'admin')
@Controller('guru/intake/structured')
@UseGuards(RateLimitGuard)
export class GuruStructuredSubmissionsController {
  constructor(@Inject(GuruSubmissionsService) private readonly submissions: GuruSubmissionsService) {}

  @Post()
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async create(@Actor() actor: HttpActor, @Body() body: unknown) {
    return ok(await this.submissions.submitStructured(actor, parseBody(GuruStructuredCreateRequestSchema, body)))
  }

  @Put(':id')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async update(@Actor() actor: HttpActor, @Param('id') id: string, @Body() body: unknown) {
    // Ownership first (404), then "still editable" (409), then the body (422).
    await this.submissions.assertStructuredOpen(actor.userId, id)
    return ok(await this.submissions.updateStructured(actor, id, parseBody(GuruStructuredUpdateRequestSchema, body)))
  }

  @Delete(':id')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async remove(@Actor() actor: HttpActor, @Param('id') id: string) {
    await this.submissions.removeStructured(actor, id)
    return ok({ removed: 1 as const })
  }
}
