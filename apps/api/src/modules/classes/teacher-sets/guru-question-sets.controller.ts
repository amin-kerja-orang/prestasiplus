import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common'

import { Roles } from '../../../common/guards/decorators'
import { NoStoreInterceptor, ok } from '../../../common/http'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { Actor, type ClassActor } from '../actor'
import { QUESTION_SET_LIMITS } from '../question-sets/question-sets.constants'
import { GuruQuestionSetsService } from './guru-question-sets.service'

/**
 * Teacher Set Soalan (S6-T14, API-GUR-16, R1-GUR-8b): own sets only, role `teacher` only (an admin has no own sets). Every answer is
 * `no-store` (results name pupils, who are minors); writes need the CSRF header (global guard) and are rate limited per user (D57).
 * Route order matters: `bank` is declared before `:id`.
 */
@Controller('guru/question-sets')
@Roles('teacher')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class GuruQuestionSetsController {
  constructor(@Inject(GuruQuestionSetsService) private readonly sets: GuruQuestionSetsService) {}

  @Get()
  @RateLimit(QUESTION_SET_LIMITS.read)
  async list(@Actor() actor: ClassActor, @Query() query: Record<string, unknown>) {
    return this.sets.list(actor, query)
  }

  @Get('bank')
  @RateLimit(QUESTION_SET_LIMITS.read)
  async bank(@Query() query: Record<string, unknown>) {
    return this.sets.bank(query)
  }

  @Post()
  @RateLimit(QUESTION_SET_LIMITS.write)
  async create(@Actor() actor: ClassActor, @Body() body: unknown) {
    return ok(await this.sets.create(actor, body))
  }

  @Get(':id')
  @RateLimit(QUESTION_SET_LIMITS.read)
  async get(@Actor() actor: ClassActor, @Param('id') id: string) {
    return ok(await this.sets.get(actor, id))
  }

  @Put(':id')
  @RateLimit(QUESTION_SET_LIMITS.write)
  async update(@Actor() actor: ClassActor, @Param('id') id: string, @Body() body: unknown) {
    return ok(await this.sets.update(actor, id, body))
  }

  @Delete(':id')
  @RateLimit(QUESTION_SET_LIMITS.write)
  async remove(@Actor() actor: ClassActor, @Param('id') id: string) {
    return ok(await this.sets.remove(actor, id))
  }

  @Post(':id/status')
  @HttpCode(200)
  @RateLimit(QUESTION_SET_LIMITS.write)
  async status(@Actor() actor: ClassActor, @Param('id') id: string, @Body() body: unknown) {
    return ok(await this.sets.setStatus(actor, id, body))
  }

  @Post(':id/copy')
  @RateLimit(QUESTION_SET_LIMITS.write)
  async copy(@Actor() actor: ClassActor, @Param('id') id: string, @Body() body: unknown) {
    return ok(await this.sets.copy(actor, id, body))
  }

  @Get(':id/results')
  @RateLimit(QUESTION_SET_LIMITS.read)
  async results(@Actor() actor: ClassActor, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.sets.results(actor, id, query)
  }
}
