import { Inject, Injectable } from '@nestjs/common'

import { idFromString, idToString } from '../../../../db/ids'
import { PrismaService } from '../../../../db/prisma.service'

export interface NewAttempt {
  userId: string
  questionId: string
  questionVersionNo: number
  scope: 'spm' | null
  track: 'bahasa' | null
  answers: { subQuestionId: string; text: string }[]
  marks: { subQuestionId: string; awarded: number; max: number }[]
  totalAwarded: number
  totalMax: number
  submittedAt: Date
  isTest: boolean
}

/** `structured_attempts` (DATA-M05-06): the only doorway to the table. */
@Injectable()
export class StructuredAttemptsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  /** Stores one attempt (not idempotent: every call is a new row) and returns its id as a decimal string. */
  async add(a: NewAttempt): Promise<string> {
    const rows = await this.db.$queryRaw<{ id: bigint }[]>`
      INSERT INTO structured_attempts
        (user_id, question_id, question_version_no, scope, track, answers, marks, total_awarded, total_max, submitted_at, is_test)
      VALUES
        (${idFromString(a.userId)}::bigint, ${idFromString(a.questionId)}::bigint, ${a.questionVersionNo}::int, ${a.scope}::text, ${a.track}::text,
         ${JSON.stringify(a.answers)}::jsonb, ${JSON.stringify(a.marks)}::jsonb, ${a.totalAwarded}::int, ${a.totalMax}::int,
         ${a.submittedAt}::timestamptz, ${a.isTest}::boolean)
      RETURNING id`
    const row = rows[0]
    if (!row) throw new Error('structured_attempts insert returned no row')
    return idToString(row.id)
  }

  /**
   * The caller's best attempt per question (highest awarded total, latest wins a tie), for the list cards.
   * Reading only: the table stops being written later (S5-T11 ruling).
   */
  async bestFor(userId: string, questionIds: readonly string[]): Promise<Map<string, { awarded: number; max: number }>> {
    if (questionIds.length === 0) return new Map()
    const rows = await this.db.$queryRaw<{ question_id: bigint; total_awarded: number; total_max: number }[]>`
      SELECT DISTINCT ON (question_id) question_id, total_awarded, total_max
      FROM structured_attempts
      WHERE user_id = ${idFromString(userId)}::bigint AND question_id = ANY(${questionIds.map(idFromString)}::bigint[])
      ORDER BY question_id, total_awarded DESC, submitted_at DESC`
    return new Map(rows.map((r) => [idToString(r.question_id), { awarded: r.total_awarded, max: r.total_max }]))
  }
}
