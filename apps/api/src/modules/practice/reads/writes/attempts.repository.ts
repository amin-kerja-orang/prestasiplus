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
}
