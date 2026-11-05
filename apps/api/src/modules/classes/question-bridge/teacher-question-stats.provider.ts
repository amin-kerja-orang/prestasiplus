import { Inject, Injectable } from '@nestjs/common'
import { Prisma } from '../../../db/generated/client'

import { PrismaService } from '../../../db/prisma.service'
import { idFromString } from '../../../db/ids'
import { GURU_STATUS_SQL, guruOwnItemsSql } from '../../intake/files/guru-submissions'
import { NOT_PRIMARY_LEVEL_SQL } from '../../questions/learner-visibility'
import type { TeacherQuestionStats, TeacherQuestionsProvider } from '../ports'

/**
 * The `used` count: the teacher's submissions whose question is published (a live version) and has at least one real answer. Driven from the
 * teacher's own submission items, one probe each on `ix_practice_answers_question_id_real` (migration 0091) and `ix_structured_attempts_question_id`.
 * The `LATERAL ... LIMIT 1` shape keeps both probes correlated per question whatever the table statistics say: a plain `EXISTS ... OR EXISTS` lets the
 * planner hash a whole table into a SubPlan when its statistics are empty or stale.
 */
export function submissionUsedCountQuery(owner: bigint): Prisma.Sql {
  return Prisma.sql`
    SELECT count(*)::int AS n
      FROM intake_items i
      JOIN intake_batches b ON b.id = i.batch_id
      JOIN questions q ON q.id = i.question_id AND q.live_version_no IS NOT NULL
      JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
      CROSS JOIN LATERAL (
        SELECT 1 WHERE EXISTS (SELECT 1 FROM practice_answers a WHERE a.question_id = q.id AND a.question_id IS NOT NULL AND NOT a.is_test)
        UNION ALL
        SELECT 1 WHERE EXISTS (SELECT 1 FROM structured_attempts t WHERE t.question_id = q.id AND NOT t.is_test)
        LIMIT 1) hit
     WHERE i.review_state = 'accepted' AND ${guruOwnItemsSql(owner)} AND ${NOT_PRIMARY_LEVEL_SQL}`
}

/** A question carrying a `pksk_domain` tag belongs to PKSK (M07), never to the teacher bank. */
const NOT_PKSK = Prisma.sql`NOT EXISTS (SELECT 1 FROM question_tags pt WHERE pt.question_id = q.id AND pt.kind = 'pksk_domain')`

/**
 * The BANK `used` count (school-admin activity report): owned questions (`questions.created_by_id`) with at least one real answer, probing
 * `ix_practice_answers_question_id_real` and `ix_structured_attempts_question_id` once per owned question.
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
 * The real `ClassesPorts` question source (SW12-02, S6-T06): the numbers of S21 `/guru/soalan`, the S1 dashboard "Soalan" cards and the M27
 * activity report, computed from the tables on every call (no stored aggregate).
 *
 * Scope (S6-T06, D113, L-6): the teacher's OWN question submissions, i.e. the intake items (`payload.guru`) of the teacher's `source = 'guru'`
 * batches, the same rows as `GET /api/guru/questions`. The status is derived exactly as that list does (`GURU_STATUS_SQL`):
 *  - `total`    every own submission, whatever its status;
 *  - `structured` always 0: a submission is a single MCQ (structured papers are reviewed by the admin and are not submissions);
 *  - `approved` "Diluluskan": the question made from the item is published (a live version);
 *  - `pending`  "Menunggu": awaiting the admin, or accepted but not yet published (a returned item, "Ditolak", is in neither);
 *  - `used`     "Digunakan": published questions made from own submissions with at least one real (not `is_test`) learner attempt in the M05
 *               answer log (`practice_answers`) or the structured attempts (`structured_attempts`), BR-M10-21;
 *  - `bySubject` own submissions per subject name (the subject the teacher chose).
 *
 * Two readings (two consumers, two meanings): `submissionStatsOf` is the teacher's own SUBMISSIONS (above; `/guru/contributions` and the dashboard "Soalan");
 * `statsOf` is the bank questions the teacher owns, objective and structured (BR-M10-06; the school-admin activity report MCQ / Struktur split), unchanged.
 *
 * Read-only SQL, like the other cross-module readers of the question tables. One grouped query (status by subject) plus one per-question probe
 * count for `used` (`submissionUsedCountQuery`), which is skipped for a teacher without submissions.
 */
@Injectable()
export class TeacherQuestionStatsProvider implements TeacherQuestionsProvider {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async submissionStatsOf(teacherId: string): Promise<TeacherQuestionStats> {
    let owner: bigint
    try {
      owner = idFromString(teacherId)
    } catch {
      return NO_STATS()
    }
    const db = this.prisma.client
    const rows = await db.$queryRaw<{ status: string; subject: string | null; n: number }[]>`
      SELECT ${GURU_STATUS_SQL} AS status, s.name AS subject, count(*)::int AS n
        FROM intake_items i
        JOIN intake_batches b ON b.id = i.batch_id
        LEFT JOIN questions q ON q.id = i.question_id
        LEFT JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
        LEFT JOIN subjects s ON s.id = (i.payload -> 'guru' ->> 'subjectId')::bigint
       WHERE ${guruOwnItemsSql(owner)} AND ${NOT_PRIMARY_LEVEL_SQL}
       GROUP BY 1, 2`
    const out = NO_STATS()
    const bySubject = new Map<string, number>()
    for (const r of rows) {
      out.total += r.n
      if (r.status === 'approved') out.approved += r.n
      else if (r.status === 'pending') out.pending += r.n
      if (r.subject !== null) bySubject.set(r.subject, (bySubject.get(r.subject) ?? 0) + r.n)
    }
    out.bySubject = [...bySubject].map(([label, count]) => ({ label, count }))
    if (out.total === 0) return out
    const used = await db.$queryRaw<{ n: number }[]>(submissionUsedCountQuery(owner))
    out.used = used[0]?.n ?? 0
    return out
  }
  /** Owned bank questions (`questions.created_by_id`), PKSK and Darjah excluded: the numbers the school-admin activity report has always read. */
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
      if (r.status === 'approved') out.approved += r.n
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
