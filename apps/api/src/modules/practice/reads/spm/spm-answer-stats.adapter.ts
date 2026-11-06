import { Inject, Injectable } from '@nestjs/common'

import { idFromString } from '../../../../db/ids'
import { PrismaService } from '../../../../db/prisma.service'
import { BijakAttemptHistoryReads } from '../../../bijak/attempts'
import { SPM_ANSWER_MODES, SPM_SESSION_MODES, type SpmAnswerStats, type SpmAnswerStatsSource } from '../../../spm'

/**
 * `SpmAnswerStatsSource` over the single answer store (S3-T07 part F, rulings Q1 to Q4; S5 owns `practice_answers`).
 *
 * - `answered` / `correct`: `practice_answers` rows of the SPM modes (`SPM_ANSWER_MODES`, legacy `past_year` and `ramalan` included),
 *   all answers and no session filter (XS-8). A part that carries marks counts as correct only at full marks (XS-5): the self-mark
 *   keeps `is_correct` in step, and the marks guard makes it hold even for a row whose flag was left behind.
 * - `sessions`: completed `practice_sessions` of the SPM session modes plus the closed Bijak sittings (read through the attempts
 *   owner), so an abandoned or swept session never counts although a Kuiz keeps its rows (Q3).
 *
 * Read-only. Rows written under Mod Pelajar (`is_test`) count only with `includeTest`.
 */
@Injectable()
export class PracticeSpmAnswerStats implements SpmAnswerStatsSource {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BijakAttemptHistoryReads) private readonly attempts: BijakAttemptHistoryReads,
  ) {}

  async statsFor(userId: string, options: { includeTest: boolean }): Promise<SpmAnswerStats> {
    const uid = idFromString(userId)
    const modes = [...SPM_ANSWER_MODES]
    const db = this.prisma.client
    const [answers, sessions, sittings] = await Promise.all([
      db.$queryRaw<{ answered: bigint; correct: bigint }[]>`
        SELECT count(*) AS answered,
               count(*) FILTER (WHERE is_correct AND (marks_max IS NULL OR coalesce(marks_awarded, 0) >= marks_max)) AS correct
          FROM practice_answers
         WHERE user_id = ${uid}::bigint AND mode = ANY(${modes}::text[]) AND (${options.includeTest}::boolean OR NOT is_test)`,
      db.practiceSession.count({
        where: { userId: uid, status: 'completed', mode: { in: [...SPM_SESSION_MODES] }, ...(options.includeTest ? {} : { isTest: false }) },
      }),
      this.attempts.closedCount(userId, { includeTest: options.includeTest }),
    ])
    return { answered: Number(answers[0]?.answered ?? 0), correct: Number(answers[0]?.correct ?? 0), sessions: sessions + sittings }
  }
}
