import { Inject, Injectable } from '@nestjs/common'

import { PkskQuestionsService } from '../questions'
import type {
  PkskAnswerKey,
  PkskQuestionInput,
  PkskQuestionListFilter,
  PkskQuestionRecord,
  PkskQuestionRow,
  PkskQuestionsPort,
  PkskServed,
  PkskStats,
} from './ports'

/**
 * The real `PkskQuestionsPort`: BE-09 `PkskQuestionsService` (PKSK questions are tagged questions of the one bank, D12).
 * The wire statuses `pending | approved | rejected` map to review, published, archived inside that service.
 */
@Injectable()
export class PkskQuestionsAdapter implements PkskQuestionsPort {
  constructor(@Inject(PkskQuestionsService) private readonly questions: PkskQuestionsService) {}

  countApproved(level: 'T1' | 'T4'): Promise<Record<string, number>> {
    return this.questions.countApproved(level)
  }

  approvedPool(level: 'T1' | 'T4', domainCodes: readonly string[]): Promise<PkskServed[]> {
    return this.questions.approvedPool(level, domainCodes)
  }

  answerKeys(level: 'T1' | 'T4', ids: readonly string[]): Promise<PkskAnswerKey[]> {
    return this.questions.answerKeys(level, ids)
  }

  list(filter: PkskQuestionListFilter): Promise<{ rows: PkskQuestionRow[]; total: number }> {
    return this.questions.list(filter)
  }

  stats(): Promise<PkskStats> {
    return this.questions.stats()
  }

  get(id: string): Promise<PkskQuestionRecord | null> {
    return this.questions.get(id)
  }

  create(input: PkskQuestionInput, actorUserId: string): Promise<PkskQuestionRecord> {
    return this.questions.create(input, actorUserId)
  }

  update(id: string, input: PkskQuestionInput): Promise<PkskQuestionRecord | null> {
    return this.questions.update(id, input)
  }

  remove(ids: readonly string[]): Promise<number> {
    return this.questions.remove(ids)
  }

  setStatus(ids: readonly string[], status: PkskQuestionInput['status']): Promise<number> {
    return this.questions.setStatus(ids, status)
  }

  pkskIds(ids: readonly string[]): Promise<string[]> {
    return this.questions.pkskIds(ids)
  }
}
