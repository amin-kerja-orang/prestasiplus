import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { QuestionGuruCreateRequestSchema, QuestionGuruUpdateRequestSchema } from '@pp/contract'

import { Roles } from '../../../common/guards'
import { listMeta, ok } from '../../../common/http/respond'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { GuruSubmissionsService } from '../../intake/files/guru-submissions.service'
import { Actor, type HttpActor } from './actor'
import { QUESTIONS_WRITE_LIMIT } from './admin.controller'
import { GURU_PAGE_SIZE, parseBody, parseGuruPage } from './parse'

/**
 * Guru contribution routes (API-GUR-18, S6-T06): a teacher (or Admin Pusat) submits MCQs. A submission is an intake item of a `source = 'guru'`
 * batch (D113, L-6), not a question row; the list, detail, edit and delete work on the caller's OWN items. Another owner's id is 404, never 403,
 * so ids cannot be probed; an edit or delete of an item the admin already accepted is 409.
 */
@Roles('teacher', 'admin')
@Controller('guru/questions')
@UseGuards(RateLimitGuard)
export class GuruQuestionsController {
  constructor(@Inject(GuruSubmissionsService) private readonly submissions: GuruSubmissionsService) {}

  @Get()
  async list(@Actor() actor: HttpActor, @Query() query: unknown) {
    const res = await this.submissions.list(actor.userId, parseGuruPage(query), GURU_PAGE_SIZE)
    return { data: res.rows, meta: listMeta(res.page, res.pageSize, res.total) }
  }

  @Get(':id')
  async get(@Actor() actor: HttpActor, @Param('id') id: string) {
    return ok(await this.submissions.get(actor.userId, id))
  }

  @Post()
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async create(@Actor() actor: HttpActor, @Body() body: unknown) {
    return ok(await this.submissions.submit(actor, parseBody(QuestionGuruCreateRequestSchema, body)))
  }

  @Put(':id')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async update(@Actor() actor: HttpActor, @Param('id') id: string, @Body() body: unknown) {
    // Ownership first: another teacher's id is 404 before the body is read.
    await this.submissions.get(actor.userId, id)
    return ok(await this.submissions.update(actor, id, parseBody(QuestionGuruUpdateRequestSchema, body)))
  }

  @Delete(':id')
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async remove(@Actor() actor: HttpActor, @Param('id') id: string) {
    await this.submissions.remove(actor, id)
    return ok({ removed: 1 as const })
  }
}
