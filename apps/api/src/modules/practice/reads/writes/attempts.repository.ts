import { Inject, Injectable } from '@nestjs/common'

import { idFromString, idToString } from '../../../../db/ids'
import { PrismaService } from '../../../../db/prisma.service'

/** `structured_attempts` (DATA-M05-06, legacy, read only) and the structured `exam_attempts` rows: the best score per question. */
@Injectable()
export class StructuredAttemptsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  /**
   * The caller's best attempt per question (highest awarded total, latest wins a tie), for the list cards. The max of the two stores:
   * the legacy `structured_attempts` rows (no longer written, S5-T11 ruling R1) and the new structured `exam_attempts` (submitted, score
   * and max from the saved result, which carries the pupil's self-marks, so a self-mark raises the best).
   */
  async bestFor(userId: string, questionIds: readonly string[]): Promise<Map<string, { awarded: number; max: number }>> {
    if (questionIds.length === 0) return new Map()
    const rows = await this.db.$queryRaw<{ question_id: bigint; awarded: number; max: number }[]>`
      SELECT DISTINCT ON (question_id) question_id, awarded, max FROM (
        SELECT question_id, total_awarded::numeric AS awarded, total_max::numeric AS max, submitted_at
        FROM structured_attempts
        WHERE user_id = ${idFromString(userId)}::bigint AND question_id = ANY(${questionIds.map(idFromString)}::bigint[])
        UNION ALL
        SELECT (a.composition -> 0 -> 'questionIds' ->> 0)::bigint AS question_id, r.score AS awarded, r.max_score AS max, a.submitted_at
        FROM exam_attempts a
        JOIN attempt_results r ON r.attempt_id = a.id
        WHERE a.user_id = ${idFromString(userId)}::bigint AND a.paper_kind = 'structured' AND a.status = 'submitted'
          AND (a.composition -> 0 -> 'questionIds' ->> 0)::bigint = ANY(${questionIds.map(idFromString)}::bigint[])
      ) best
      ORDER BY question_id, awarded DESC, submitted_at DESC`
    return new Map(rows.map((r) => [idToString(r.question_id), { awarded: Number(r.awarded), max: Number(r.max) }]))
  }
}
