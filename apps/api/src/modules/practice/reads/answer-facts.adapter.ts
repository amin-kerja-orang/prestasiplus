import { Inject, Injectable } from '@nestjs/common'

import { Prisma } from '../../../db/generated/client'
import { idFromString, idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import type {
  AnswerFactRow,
  AnswerFactsPort,
  AnswerFactsQuery,
  SpInfo,
  WeeklyFactRow,
} from '../../reports/performance/ports'

const num = (v: bigint | number | null | undefined): number => Number(v ?? 0)

/** An id that is not a canonical id can match nothing; it must never reach SQL. */
function ids(list: readonly string[]): bigint[] {
  const out: bigint[] = []
  for (const s of list) {
    try {
      out.push(idFromString(s))
    } catch {
      /* skipped: matches nothing */
    }
  }
  return out
}

/**
 * The stored `mode` of an answer row.
 * S5-T15: switch to `practice_answers.mode` (migration 0181, not merged yet): `COALESCE(a.mode, ps.mode, 'unknown')`.
 * Until then the column does not exist, so the row's mode is its session's mode (`ps.mode`, the session-level mode
 * every writer already stores); an answer outside a session has no mode and reads 'unknown'.
 */
const MODE = Prisma.raw(`COALESCE(ps.mode, 'unknown')`)
const MYT = Prisma.raw(`'Asia/Kuala_Lumpur'`)

/**
 * The real `AnswerFactsPort` (S10-T01 shared reader) over the single answer store. Read-only `$queryRaw` on
 * `practice_answers` only (plus the session row for the mode until S5-T15, and M03 names for `spInfo`).
 * `is_test` rows are never read. Every method is a fixed number of set-based statements (GROUP BY, no per-pupil loop).
 */
@Injectable()
export class AnswerFactsAdapter implements AnswerFactsPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  private inList(column: Prisma.Sql, list: readonly string[]): Prisma.Sql {
    const b = ids(list)
    return b.length === 0 ? Prisma.sql`false` : Prisma.sql`${column} IN (${Prisma.join(b)})`
  }

  /** A malformed id matches nothing (0 is never a row id). */
  private one(id: string): bigint {
    try {
      return idFromString(id)
    } catch {
      return 0n
    }
  }

  /** Conditions on `a` (practice_answers), `ps` (its session, left join) and `u` (the pupil). An empty id list matches nothing. */
  private where(q: AnswerFactsQuery): Prisma.Sql {
    const c: Prisma.Sql[] = [Prisma.sql`a.is_test = false`]
    if (q.userIds) c.push(this.inList(Prisma.sql`a.user_id`, q.userIds))
    if (q.schoolIds) c.push(this.inList(Prisma.sql`u.school_id`, q.schoolIds))
    if (q.classroomId !== undefined) {
      c.push(Prisma.sql`a.user_id IN (SELECT e.student_id FROM enrolments e WHERE e.classroom_id = ${this.one(q.classroomId)} AND e.status = 'active' AND e.is_test = false)`)
    }
    if (q.subjectId !== undefined) c.push(Prisma.sql`a.subject_id = ${this.one(q.subjectId)}`)
    if (q.levelCode !== undefined) c.push(Prisma.sql`a.education_level_id IN (SELECT id FROM education_levels WHERE code = ${q.levelCode.toUpperCase()})`)
    if (q.modes && q.modes.length > 0) c.push(Prisma.sql`${MODE} IN (${Prisma.join([...q.modes])})`)
    if (q.from) c.push(Prisma.sql`a.answered_at >= ${q.from}`)
    if (q.to) c.push(Prisma.sql`a.answered_at < ${q.to}`)
    return Prisma.join(c, ' AND ')
  }

  private readonly from = Prisma.sql`
        FROM practice_answers a
        LEFT JOIN practice_sessions ps ON ps.id = a.session_id
        JOIN users u ON u.id = a.user_id`

  async answerFacts(q: AnswerFactsQuery): Promise<AnswerFactRow[]> {
    if (q.modes && q.modes.length === 0) return []
    const rows = await this.db.$queryRaw<
      { userId: bigint; subjectId: bigint; questionId: bigint; chapterId: bigint | null; topicId: bigint | null; mode: string; attempts: bigint; correct: bigint; lastAnsweredAt: Date }[]
    >`
      SELECT a.user_id AS "userId", coalesce(a.subject_id, 0)::bigint AS "subjectId", coalesce(a.question_id, 0)::bigint AS "questionId",
             a.chapter_id AS "chapterId", a.topic_id AS "topicId", ${MODE} AS mode,
             count(*)::bigint AS attempts, (count(*) FILTER (WHERE a.is_correct))::bigint AS correct, max(a.answered_at) AS "lastAnsweredAt"
        ${this.from}
       WHERE ${this.where(q)}
       GROUP BY a.user_id, coalesce(a.subject_id, 0), coalesce(a.question_id, 0), a.chapter_id, a.topic_id, ${MODE}
       ORDER BY a.user_id, 2, 3, a.chapter_id NULLS FIRST, a.topic_id NULLS FIRST, mode`
    return rows.map((r) => ({
      userId: idToString(r.userId),
      subjectId: idToString(r.subjectId),
      questionId: idToString(r.questionId),
      chapterId: r.chapterId === null ? null : idToString(r.chapterId),
      topicId: r.topicId === null ? null : idToString(r.topicId),
      mode: r.mode,
      attempts: num(r.attempts),
      correct: num(r.correct),
      lastAnsweredAt: r.lastAnsweredAt,
    }))
  }

  async weeklyFacts(q: AnswerFactsQuery): Promise<WeeklyFactRow[]> {
    if (q.modes && q.modes.length === 0) return []
    // `date_trunc('week', ...)` on a local (MYT) timestamp is the Monday of the ISO week.
    const rows = await this.db.$queryRaw<{ userId: bigint; weekStart: string; attempts: bigint; correct: bigint; sessions: bigint }[]>`
      WITH base AS (
        SELECT a.user_id, a.is_correct, a.session_id, ${MODE} AS mode, (a.answered_at AT TIME ZONE ${MYT}) AS local_at
          ${this.from}
         WHERE ${this.where(q)})
      SELECT b.user_id AS "userId", to_char(date_trunc('week', b.local_at), 'YYYY-MM-DD') AS "weekStart",
             count(*)::bigint AS attempts, (count(*) FILTER (WHERE b.is_correct))::bigint AS correct,
             (count(DISTINCT b.session_id) + count(DISTINCT (b.mode, b.local_at::date)) FILTER (WHERE b.session_id IS NULL))::bigint AS sessions
        FROM base b
       GROUP BY b.user_id, date_trunc('week', b.local_at)
       ORDER BY b.user_id, "weekStart"`
    return rows.map((r) => ({ userId: idToString(r.userId), weekStart: r.weekStart, attempts: num(r.attempts), correct: num(r.correct), sessions: num(r.sessions) }))
  }

  async spInfo(q: { topicIds: readonly string[]; chapterIds: readonly string[] }): Promise<SpInfo[]> {
    const topicIds = ids(q.topicIds)
    const chapterIds = ids(q.chapterIds)
    const [topics, chapters] = await Promise.all([
      topicIds.length === 0
        ? []
        : this.db.$queryRaw<{ id: bigint; label: string; code: string | null; subjectCode: string; levelId: bigint | null }[]>`
            SELECT t.id, t.name AS label, c.dskp_code AS code, s.code AS "subjectCode", c.education_level_id AS "levelId"
              FROM topics t
              JOIN chapters c ON c.id = t.chapter_id
              JOIN subjects s ON s.id = c.subject_id
             WHERE t.id IN (${Prisma.join(topicIds)})
             ORDER BY t.id`,
      chapterIds.length === 0
        ? []
        : this.db.$queryRaw<{ id: bigint; label: string | null; subjectCode: string; levelId: bigint | null }[]>`
            SELECT c.id, c.name AS label, s.code AS "subjectCode", c.education_level_id AS "levelId"
              FROM chapters c
              JOIN subjects s ON s.id = c.subject_id
             WHERE c.id IN (${Prisma.join(chapterIds)})
             ORDER BY c.id`,
    ])
    return [
      ...topics.map((r): SpInfo => ({ id: idToString(r.id), kind: 'topic', label: r.label, code: r.code, subjectCode: r.subjectCode, levelId: r.levelId === null ? null : idToString(r.levelId) })),
      // A chapter fallback has no code (60 section 2.17.6).
      ...chapters.map((r): SpInfo => ({ id: idToString(r.id), kind: 'chapter', label: r.label ?? '', code: null, subjectCode: r.subjectCode, levelId: r.levelId === null ? null : idToString(r.levelId) })),
    ]
  }
}
