import { Controller, Get, Inject, Param, Query, Req } from '@nestjs/common'
import { CurriculumLearningMapQuerySchema, CurriculumTopicsQuerySchema } from '@pp/contract'
import type { Request } from 'express'

import { listMeta, ok, okList } from '../../common/http/respond'
import { type RequestWithAuth, ScopeContext } from '../../common/scope'
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe'
import { CurriculumLearnerService } from './learner.service'
import type { LearningMapQuery, TopicsQuery } from './types'

const unpaged = <T>(items: T[]) => okList(items, listMeta(1, Math.max(1, items.length), items.length))

/**
 * Learner reads (SRS #25 to #29). Any role with a session may call them: the default-deny guard
 * answers 401 without one. Per-user progress comes from the progress provider (BR-19).
 */
@Controller()
export class CurriculumLearnerController {
  constructor(@Inject(CurriculumLearnerService) private readonly learner: CurriculumLearnerService) {}

  @Get('education-levels')
  async levels() {
    return unpaged(await this.learner.educationLevels())
  }

  @Get('subjects')
  async subjects(@Query('educationLevelId') educationLevelId?: unknown) {
    return unpaged(await this.learner.subjects(typeof educationLevelId === 'string' ? educationLevelId : undefined))
  }

  @Get('topics')
  async topics(@Query(new ZodValidationPipe(CurriculumTopicsQuerySchema)) query: TopicsQuery) {
    return unpaged(await this.learner.topics(query))
  }

  @Get('topics/:id')
  async topic(@Param('id') id: string, @Req() req: Request & RequestWithAuth) {
    return ok(await this.learner.topic(id, ScopeContext.fromRequest(req).userId))
  }

  @Get('learning-map')
  async learningMap(
    @Query(new ZodValidationPipe(CurriculumLearningMapQuerySchema)) query: LearningMapQuery,
    @Req() req: Request & RequestWithAuth,
  ) {
    return ok(await this.learner.learningMap(query, ScopeContext.fromRequest(req).userId))
  }
}
