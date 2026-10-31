import { Inject, Injectable } from '@nestjs/common'
import { Prisma } from '../../../db/generated/client'

import { PrismaService } from '../../../db/prisma.service'
import { idFromString } from '../../../db/ids'
import { NOT_PRIMARY_LEVEL_SQL } from '../../questions/learner-visibility'
import type { TeacherQuestionStats, TeacherQuestionsProvider } from '../ports'

/** A question carrying a `pksk_domain` tag belongs to PKSK (M07), never to the teacher bank (same scope as `GET /guru/questions`). */
const NOT_PKSK = Prisma.sql`NOT EXISTS (SELECT 1 FROM question_tags pt WHERE pt.question_id = q.id AND pt.kind = 'pksk_domain')`

/**
 * The `used` count: owned questions with at least one real answer. Driven from the owned questions, one probe each on
 * `ix_practice_answers_question_id_real` (migration 0091) and `ix_structured_attempts_question_id`. The `LATERAL ... LIMIT 1`
 * shape keeps both probes correlated per question whatever the table statistics say: a plain `EXISTS ... OR EXISTS` lets the
 * planner hash a whole table into a SubPlan when its statistics are empty or stale.
 */
export function usedCountQuery(owner: bigint): Prisma.Sql {
  return Prisma.sql`
    SELECT count(*)::int AS n
      FROM questions q
      JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
      CROSS JOIN LATERAL (
        SELECT 1 WHERE EXISTS (SELECT 1 FROM practice_answers a WHERE a.question_id = q.id AND a.question_id IS NOT NULL AND NOT a.is_test)
        UNION ALL
        SELECT 1 WHERE EXISTS (SELECT 1 FROM structured_attempts t WHERE t.question_id = q.id AND NOT t.is_test)
        LIMIT 1) hit
     WHERE q.created_by_id = ${owner} AND ${NOT_PKSK} AND ${NOT_PRIMARY_LEVEL_SQL}`
}

const NO_STATS = (): TeacherQuestionStats => ({ total: 0, structured: 0, approved: 0, pending: 0, used: 0, bySubject: [] })

/**
 * The real `ClassesPorts` question source (SW12-02): the numbers of S21 `/guru/soalan`, the S1 dashboard
 * "Soalan" cards and the M27 activity report, computed from the tables on every call (no stored aggregate).
 *
 * Scope: every question the teacher owns (`questions.created_by_id`), objective and structured alike (BR-M10-06),
 * PKSK and primary-level (Darjah, D72 `NOT_PRIMARY_LEVEL_SQL`) excluded, the same rows as `GET /api/guru/questions`. The status is the one of the LATEST version, the
 * one the teacher sees in that list (and `QuestionsService.contributionCountsFor` counts):
 *  - `total`    every owned question, whatever its status (draft and archived included);
 *  - `structured` of `total`, the questions whose latest version is `structured`; the rest are objective (M27 splits them);
 *  - `approved` "Diluluskan": status `approved` or `published` (mock `approved` maps to v2 `published`, and the
 *               v2 `approved` step is a reviewer approval too);
 *  - `pending`  "Menunggu": status `review` (submitted, awaiting the reviewer; mock `pending_review`);
 *  - `used`     "Digunakan": owned questions with at least one real (not `is_test`) learner attempt in the M05
 *               answer log (`practice_answers`) or the structured attempts (`structured_attempts`), BR-M10-21;
 *  - `bySubject` owned questions per subject name; a question without a subject is only in `total`.
 *
 * Read-only SQL, like the other cross-module readers of the question tables (exam builder, reports, practice
 * reads). One grouped query (status by subject) plus one per-question probe count for `used` (`usedCountQuery`), which is skipped for a teacher
 * without questions. `used` probes the partial index `ix_practice_answers_question_id_real` (migration 0091, `question_id`
 * WHERE `question_id IS NOT NULL AND NOT is_test`) once per owned question, so it never scans the answer log.
 */
@Injectable()
export class TeacherQuestionStatsProvider implements TeacherQuestionsProvider {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async statsOf(teacherId: string): Promise<TeacherQuestionStats> {
    let owner: bigint
    try {
      owner = idFromString(teacherId)
    } catch {
      return NO_STATS()
    }
    const db = this.prisma.client
    const rows = await db.$queryRaw<{ status: string; subject: string | null; structured: boolean; n: number }[]>`
      SELECT v.status AS status, s.name AS subject, (v.type = 'structured') AS structured, count(*)::int AS n
        FROM questions q
        JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
        LEFT JOIN subjects s ON s.id = v.subject_id
       WHERE q.created_by_id = ${owner} AND ${NOT_PKSK} AND ${NOT_PRIMARY_LEVEL_SQL}
       GROUP BY 1, 2, 3`
    const out = NO_STATS()
    const bySubject = new Map<string, number>()
    for (const r of rows) {
      out.total += r.n
      if (r.structured) out.structured = (out.structured ?? 0) + r.n
      if (r.status === 'approved' || r.status === 'published') out.approved += r.n
      else if (r.status === 'review') out.pending += r.n
      if (r.subject !== null) bySubject.set(r.subject, (bySubject.get(r.subject) ?? 0) + r.n)
    }
    out.bySubject = [...bySubject].map(([label, count]) => ({ label, count }))
    if (out.total === 0) return out
    const used = await db.$queryRaw<{ n: number }[]>(usedCountQuery(owner))
    out.used = used[0]?.n ?? 0
    return out
  }
}
