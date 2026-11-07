import { Inject, Injectable } from '@nestjs/common'
import type { BijakAttemptKind } from '@pp/contract'

import { idFromString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'

/** The statuses of a closed sitting (an `abandoned` or `in_progress` attempt is never history). */
export const CLOSED_ATTEMPT_STATUSES = ['submitted', 'auto_submitted'] as const

/** One closed sitting as the SPM history reads it. Marks are the result's (null without a result row). */
export interface ClosedAttemptRow {
  id: string
  paperKind: BijakAttemptKind
  /** Curriculum subject code snapshot of the attempt. */
  subjectCode: string
  subjectName: string
  startedAt: Date
  deadlineAt: Date | null
  /** `submitted_at`, else `updated_at` for a row that has none. */
  completedAt: Date
  score: number | null
  maxScore: number | null
  coins: number | null
}

interface RawRow {
  id: string
  paper_kind: string
  subject: string
  subject_name: string
  started_at: Date
  deadline_at: Date | null
  completed_at: Date
  score: string | null
  max_score: string | null
  coins: number | null
}

export interface ClosedAttemptFilter {
  includeTest: boolean
}

/**
 * Read port of the Bijak attempts owner (M28, S3-T04) for the SPM hub and history (S3-T07 part F): the CLOSED sittings of
 * a user. Read-only; the other modules never query `exam_attempts` themselves.
 */
@Injectable()
export class BijakAttemptHistoryReads {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Count of closed sittings (`submitted`, `auto_submitted`). Rows written under Mod Pelajar count only with `includeTest`. */
  closedCount(userId: string, filter: ClosedAttemptFilter): Promise<number> {
    return this.prisma.client.examAttempt.count({
      where: {
        userId: idFromString(userId),
        status: { in: [...CLOSED_ATTEMPT_STATUSES] },
        ...(filter.includeTest ? {} : { isTest: false }),
      },
    })
  }

  /** The newest `limit` closed sittings: completed (submitted) time descending, then id descending. */
  async closedNewest(userId: string, filter: ClosedAttemptFilter, limit: number): Promise<ClosedAttemptRow[]> {
    const uid = idFromString(userId)
    const closed = [...CLOSED_ATTEMPT_STATUSES]
    const rows = await this.prisma.client.$queryRaw<RawRow[]>`
      SELECT a.id::text AS id, a.paper_kind, a.subject, a.subject_name, a.started_at, a.deadline_at,
             coalesce(a.submitted_at, a.updated_at) AS completed_at,
             r.score::text AS score, r.max_score::text AS max_score, r.coins
        FROM exam_attempts a
        LEFT JOIN attempt_results r ON r.attempt_id = a.id
       WHERE a.user_id = ${uid}::bigint AND a.status = ANY(${closed}::text[])
         AND (${filter.includeTest}::boolean OR NOT a.is_test)
       ORDER BY coalesce(a.submitted_at, a.updated_at) DESC, a.id DESC
       LIMIT ${limit}::int`
    return rows.map((r) => ({
      id: r.id,
      paperKind: r.paper_kind as BijakAttemptKind,
      subjectCode: r.subject,
      subjectName: r.subject_name,
      startedAt: r.started_at,
      deadlineAt: r.deadline_at,
      completedAt: r.completed_at,
      score: r.score === null ? null : Number(r.score),
      maxScore: r.max_score === null ? null : Number(r.max_score),
      coins: r.coins,
    }))
  }
}
