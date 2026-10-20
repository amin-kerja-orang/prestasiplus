import { Inject, Injectable } from '@nestjs/common'

import { PracticeService } from '../practice'
import type { PkskPracticeCompletion, PkskPracticeCompletionResult, PkskPracticePort } from './ports'

/** The real `PkskPracticePort`: BE-12 `PracticeService.completePksk` (mode `pksk` session, wallet and streak credit). */
@Injectable()
export class PkskPracticeAdapter implements PkskPracticePort {
  constructor(@Inject(PracticeService) private readonly practice: PracticeService) {}

  completeDirect(input: PkskPracticeCompletion): Promise<PkskPracticeCompletionResult> {
    return this.practice.completePksk({
      userId: input.userId,
      isTest: input.isTest,
      domainCode: input.domainCode,
      level: input.level,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      answers: input.answers,
    })
  }
}
