import { Inject, Injectable } from '@nestjs/common'

import type { QuestionCountProvider } from '../curriculum'
import { QuestionsRepository } from './questions.repository'

/**
 * Feeds the learner catalogue (M03) with the number of ACTIVE questions: a live version that is
 * `approved` AND `questions.is_active` (Q-2). Registered once in `QuestionsModule.onModuleInit` with
 * `CurriculumPorts.provideQuestionCounts(...)`; no curriculum file is edited.
 */
@Injectable()
export class QuestionCountsAdapter implements QuestionCountProvider {
  constructor(@Inject(QuestionsRepository) private readonly repo: QuestionsRepository) {}

  activeByLevel(): Promise<ReadonlyMap<string, number>> {
    return this.repo.groupCount('level', { status: 'approved', active: true })
  }

  activeBySubject(): Promise<ReadonlyMap<string, number>> {
    return this.repo.groupCount('subject', { status: 'approved', active: true })
  }
}
