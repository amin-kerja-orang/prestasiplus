import { Injectable } from '@nestjs/common'
import {
  CIKGU_GENERAL_REPLY,
  CIKGU_PRACTICE_REPLY,
  cikguCannedMarks,
  cikguMarkingReply,
  type CikguLevelCode,
} from '@pp/contract'

import type {
  CikguAiPort,
  CikguAiText,
  CikguChatReplyInput,
  CikguMarkEssayInput,
  CikguMarkEssayOutput,
  CikguRphPlanInput,
} from './ai.port'
import { rphContent } from './rules'

/**
 * The `mock` AI provider: the canned logic of the frontend mock (`canned.ts`), deterministic and offline. It reports no
 * token counts, so the service applies the mock estimate (`120 + ceil(codepoints(message) / 4)` in, `ceil(codepoints(reply) / 4)` out).
 * Every reply equals the SRS 8.2 texts character for character.
 */
@Injectable()
export class MockCikguAi implements CikguAiPort {
  chatReply(input: CikguChatReplyInput): Promise<CikguAiText> {
    return Promise.resolve({ text: input.route === 'practice' ? CIKGU_PRACTICE_REPLY : CIKGU_GENERAL_REPLY })
  }

  markEssay(input: CikguMarkEssayInput): Promise<CikguMarkEssayOutput> {
    const marks = cikguCannedMarks(input.rubric.max)
    return Promise.resolve({ marks, reply: cikguMarkingReply(input.rubric, marks) })
  }

  rphPlan(input: CikguRphPlanInput): Promise<CikguAiText> {
    const level = input.level as CikguLevelCode
    return Promise.resolve({
      text: rphContent({
        subjectName: input.subjectName,
        level,
        tajuk: input.tajuk,
        className: input.className,
        dateLabel: input.dateLabel,
        durationMinutes: input.durationMinutes,
        timeSlot: input.timeSlot,
        tema: input.tema,
        pengajaranKeperluan: input.pengajaranKeperluan,
      }),
    })
  }
}
