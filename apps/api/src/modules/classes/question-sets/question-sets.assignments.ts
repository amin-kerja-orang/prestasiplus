import { Inject, Injectable } from '@nestjs/common'

import type { AssignmentResolution } from '../../practice'
import { QuestionSetsService } from './question-sets.service'

/**
 * The question_set half of BE-12's `PracticeAssignmentSource.resolve` (BE-18). The missions module's
 * adapter delegates `kind === 'question_set'` here. Rules (mock M05 seams + BR-M10-18): the set must be
 * visible to the student (actively enrolled in its class, status published, or scheduled and due at `at`,
 * never draft), else `not_found`; served question ids are the set items in `position` order whose question
 * is still eligible (published, active) - a deactivated question is skipped, never deleted from the set;
 * `timeLimitSec` = timeLimitMinutes x 60 or null; `maxAttempts` as stored (0 = unlimited).
 */
@Injectable()
export class QuestionSetAssignments {
  constructor(@Inject(QuestionSetsService) private readonly service: QuestionSetsService) {}

  async resolve(input: { userId: string; id: string; at: Date }): Promise<AssignmentResolution> {
    const set = await this.service.visibleSetFor(input.userId, input.id, input.at)
    if (!set) return { status: 'not_found' }
    const items = await this.service.eligibleItems([set])
    return {
      status: 'ok',
      subjectId: set.subjectId,
      questionIds: items.get(set.id) ?? [],
      timeLimitSec: set.timeLimitMinutes === null ? null : set.timeLimitMinutes * 60,
      maxAttempts: set.maxAttempts,
    }
  }
}
