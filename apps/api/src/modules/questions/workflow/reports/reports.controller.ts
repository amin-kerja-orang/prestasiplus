import { ModuleRef } from '@nestjs/core'
import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common'

import { NoStoreInterceptor } from '../../../../common/http'
import { RateLimit, RateLimitGuard } from '../../../../common/throttle'
import { Actor, AdminOnly, type WorkflowActor } from '../actor'
import { REPORT_ARCHIVE_REASON, REPORT_LIMITS } from './reports.constants'
import { QuestionReportsService } from './reports.service'

/**
 * Question reports (BE-10 AC 3, 4, 9, 11). `POST` and `GET /mine` take any signed-in user (the
 * session guard answers 401 and, on a write, CSRF 403); list and patch are Admin Pusat only. Bodies
 * are read raw and validated in the service (a missing report is 404 before a bad body is 422).
 * `mine` is declared before `:id`.
 */
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
@Controller('question-reports')
export class QuestionReportsController {
  constructor(
    @Inject(QuestionReportsService) private readonly reports: QuestionReportsService,
    // Resolved on use: the lifecycle imports the reports module, so a constructor token here would be a circular import.
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
  ) {}

  @Post()
  @RateLimit(REPORT_LIMITS.write)
  create(@Actor() actor: WorkflowActor, @Body() body: unknown) {
    return this.reports.create(actor, body)
  }

  @Get('mine')
  mine(@Actor() actor: WorkflowActor) {
    return this.reports.mine(actor)
  }

  @Get()
  @AdminOnly()
  list(@Query('status') status: unknown) {
    return this.reports.list(status)
  }

  @Patch(':id')
  @AdminOnly()
  @RateLimit(REPORT_LIMITS.write)
  update(@Actor() actor: WorkflowActor, @Param('id') id: string, @Body() body: unknown) {
    // "Arkib" on the row: the real lifecycle archive (table, status event) in the same transaction as the report update.
    // An already archived question is left as it is (the move would be a 409).
    return this.reports.update(actor, id, body, async (questionId) => {
      // Loaded on use: the lifecycle imports this module, so a static import of the service would be circular.
      const { QuestionWorkflowService } = await import('../question-workflow.service')
      const workflow = this.moduleRef.get(QuestionWorkflowService, { strict: false })
      const info = await workflow.bank.getStatus(questionId)
      if (info && info.status !== 'archived') await workflow.transition(questionId, 'archived', actor, { reason: REPORT_ARCHIVE_REASON })
    })
  }
}
