import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, UseGuards } from '@nestjs/common'
import { QuestionGateCheckQuerySchema, QuestionStatusRequestSchema } from '@pp/contract'

import { ApiError } from '../../../../common/errors/api-error'
import { ok } from '../../../../common/http/respond'
import { RateLimit, RateLimitGuard } from '../../../../common/throttle'
import { QUESTIONS_WRITE_LIMIT } from '../../http/admin.controller'
import { fieldsOf } from '../../http/parse'
import { questionView } from '../../http/views'
import { QuestionsService } from '../../questions.service'
import { ServabilityService } from '../../serving'
import { Actor, AdminOrGuru, type WorkflowActor } from '../actor'
import { QuestionWorkflowService } from '../question-workflow.service'

const invalid = (error: import('zod').ZodError): ApiError => ApiError.of('VALIDATION_ERROR', { fields: fieldsOf(error) })

/**
 * R1-B05: `GET /questions/:id/gate-check` and `POST /questions/:id/status` (pipeline arch 3.1). Admin Pusat, and the owning Guru for
 * their own question (another Guru's id is 404, Admin Sekolah and the rest 403). The lifecycle table, roles, reasons and gates are
 * `LifecycleService`'s; this controller only parses, delegates and adds the servability report of an approval.
 */
@AdminOrGuru()
@Controller('questions')
@UseGuards(RateLimitGuard)
export class LifecycleController {
  constructor(
    @Inject(QuestionWorkflowService) private readonly workflow: QuestionWorkflowService,
    @Inject(QuestionsService) private readonly questions: QuestionsService,
    @Inject(ServabilityService) private readonly servability: ServabilityService,
  ) {}

  @Get(':id/gate-check')
  async gateCheck(@Actor() actor: WorkflowActor, @Param('id') id: string, @Query() query: unknown) {
    const parsed = QuestionGateCheckQuerySchema.safeParse(typeof query === 'object' && query !== null ? query : {})
    if (!parsed.success) throw invalid(parsed.error)
    return ok(await this.workflow.gateCheck(id, parsed.data.gate, actor))
  }

  @Post(':id/status')
  @HttpCode(200)
  @RateLimit(QUESTIONS_WRITE_LIMIT)
  async status(@Actor() actor: WorkflowActor, @Param('id') id: string, @Body() body: unknown) {
    const parsed = QuestionStatusRequestSchema.safeParse(typeof body === 'object' && body !== null && !Array.isArray(body) ? body : {})
    if (!parsed.success) throw invalid(parsed.error)
    await this.workflow.transition(id, parsed.data.to, actor, { reason: parsed.data.reason ?? null })
    const question = questionView(await this.questions.getAdmin(id))
    const servability = parsed.data.to === 'approved' ? await this.servability.report(id) : null
    return ok({ question, servability })
  }
}
