import { Inject, Injectable } from '@nestjs/common'

import { Prisma } from '../../../db/generated/client'
import { idFromString, idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import type {
  LeaderboardQuery,
  LeaderboardResult,
  PracticeReadPort,
  PracticeScopeQuery,
  PracticeUserTotals,
  RankingQuery,
  RankingResult,
} from '../../reports/performance/ports'

const num = (v: bigint | number | null | undefined): number => Number(v ?? 0)

/** An id from a caller that is not a canonical id can match nothing; it must never reach SQL. */
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
 * The real `PracticeReadPort` of BE-19 (rankings, practice leaderboard, public profile) over BE-12's tables.
 * Read-only `$queryRaw`, a fixed number of set-based statements whatever the number of pupils. `is_test` rows
 * (Mod Pelajar) are always excluded: the port has no way to ask for them. Figures come from the rows' own
 * dimension columns, never from a join to `questions`. Only active accounts are counted.
 */
@Injectable()
export class PerformancePracticeReadAdapter implements PracticeReadPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  /** Conditions on the pupil (`u`) and school (`sc`) aliases. An empty id list matches nothing. */
  private geo(q: PracticeScopeQuery): Prisma.Sql[] {
    const c: Prisma.Sql[] = []
    if (q.userIds) c.push(this.inList("u.id", q.userIds))
    if (q.schoolIds) c.push(this.inList("u.school_id", q.schoolIds))
    if (q.state !== undefined) c.push(Prisma.sql`sc.state = ${q.state}`)
    if (q.district !== undefined) c.push(Prisma.sql`sc.district = ${q.district}`)
    return c
  }

  async userTotals(q: PracticeScopeQuery): Promise<PracticeUserTotals[]> {
    const where: Prisma.Sql[] = [Prisma.sql`s.status = 'completed'`, Prisma.sql`s.is_test = false`, Prisma.sql`u.is_active`, ...this.geo(q)]
    if (q.subjectId !== undefined) where.push(Prisma.sql`s.subject_id = ${this.subject(q.subjectId)}`)
    if (q.levelCode !== undefined) where.push(Prisma.sql`s.education_level_id IN (SELECT id FROM education_levels WHERE code = ${q.levelCode.toUpperCase()})`)
    if (q.modes && q.modes.length > 0) where.push(Prisma.sql`s.mode IN (${Prisma.join([...q.modes])})`)
    if (q.from) where.push(Prisma.sql`s.completed_at >= ${q.from}`)
    if (q.to) where.push(Prisma.sql`s.completed_at < ${q.to}`)
    const rows = await this.db.$queryRaw<{ userId: bigint; sessions: bigint; questions: bigint; correct: bigint; coins: bigint }[]>`
      SELECT s.user_id AS "userId", count(*)::bigint AS sessions, coalesce(sum(s.question_count), 0)::bigint AS questions,
             coalesce(sum(s.correct_count), 0)::bigint AS correct, coalesce(sum(s.coins_earned), 0)::bigint AS coins
        FROM practice_sessions s
        JOIN users u ON u.id = s.user_id
        LEFT JOIN schools sc ON sc.id = u.school_id
       WHERE ${Prisma.join(where, ' AND ')}
       GROUP BY s.user_id
       ORDER BY s.user_id`
    return rows.map((r) => ({ userId: idToString(r.userId), sessions: num(r.sessions), questions: num(r.questions), correct: num(r.correct), coins: num(r.coins) }))
  }

  async practiceDays(userId: string): Promise<string[]> {
    const rows = await this.db.$queryRaw<{ day: string }[]>`
      SELECT DISTINCT to_char(s.completed_at AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYY-MM-DD') AS day
        FROM practice_sessions s
       WHERE s.user_id = ${this.user(userId)} AND s.status = 'completed' AND s.is_test = false AND s.completed_at IS NOT NULL
       ORDER BY day`
    return rows.map((r) => r.day)
  }

  async rankingRows(q: RankingQuery): Promise<RankingResult> {
    const dims: Prisma.Sql[] = []
    if (q.subjectId !== undefined) dims.push(Prisma.sql`a.subject_id = ${this.subject(q.subjectId)}`)
    if (q.levelCode !== undefined) dims.push(Prisma.sql`a.education_level_id IN (SELECT id FROM education_levels WHERE code = ${q.levelCode.toUpperCase()})`)
    const geo = this.geo(q)
    const per = (conds: Prisma.Sql[]) => Prisma.sql`
      SELECT a.user_id, count(*)::bigint AS answered, (count(*) FILTER (WHERE a.is_correct))::bigint AS correct
        FROM practice_answers a
        JOIN users u ON u.id = a.user_id
        LEFT JOIN schools sc ON sc.id = u.school_id
       WHERE ${Prisma.join([Prisma.sql`a.is_test = false`, Prisma.sql`u.is_active`, ...conds], ' AND ')}
       GROUP BY a.user_id
      HAVING count(*) >= ${q.minAnswers}::bigint`

    const filtered = per([...geo, ...dims])
    const totalRows = await this.db.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM (${filtered}) f`
    const total = num(totalRows[0]?.n)

    const rows =
      q.limit <= 0
        ? []
        : await this.db.$queryRaw<{ userId: bigint; name: string; schoolId: bigint | null; schoolName: string | null; state: string | null; correct: bigint; answered: bigint }[]>`
            SELECT f.user_id AS "userId", u.name, u.school_id AS "schoolId", sc.name AS "schoolName", sc.state, f.correct, f.answered
              FROM (${filtered}) f
              JOIN users u ON u.id = f.user_id
              LEFT JOIN schools sc ON sc.id = u.school_id
             ORDER BY f.correct DESC, (f.correct::float8 / f.answered) DESC, f.user_id ASC
             LIMIT ${q.limit}`

    // States: every filter but the geography, so the picker is stable.
    const states = await this.db.$queryRaw<{ state: string; pupils: bigint }[]>`
      SELECT sc.state, count(*)::bigint AS pupils
        FROM (${per(dims)}) f
        JOIN users u ON u.id = f.user_id
        JOIN schools sc ON sc.id = u.school_id
       WHERE sc.state IS NOT NULL
       GROUP BY sc.state
       ORDER BY sc.state`

    const scopeRows = geo.length === 0 && dims.length === 0 ? totalRows : await this.db.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM (${per(geo)}) f`
    return {
      rows: rows.map((r) => ({
        userId: idToString(r.userId),
        name: r.name,
        schoolId: r.schoolId === null ? null : idToString(r.schoolId),
        schoolName: r.schoolName ?? '',
        state: r.state ?? '',
        correct: num(r.correct),
        answered: num(r.answered),
      })),
      total,
      states: states.map((s) => ({ state: s.state, pupils: num(s.pupils) })),
      scopePupils: num(scopeRows[0]?.n),
    }
  }

  async leaderboard(q: LeaderboardQuery): Promise<LeaderboardResult> {
    const where: Prisma.Sql[] = [Prisma.sql`s.status = 'completed'`, Prisma.sql`s.is_test = false`, Prisma.sql`u.is_active`, Prisma.sql`s.completed_at < ${q.to}`]
    if (q.from) where.push(Prisma.sql`s.completed_at >= ${q.from}`)
    const rows = await this.db.$queryRaw<{ userId: bigint; name: string; coins: bigint; sessions: bigint; accuracy: number; rank: bigint }[]>`
      WITH per AS (
        SELECT s.user_id, coalesce(sum(s.coins_earned), 0)::bigint AS coins, count(*)::bigint AS sessions,
               coalesce(avg(s.correct_count::float8 / s.question_count * 100) FILTER (WHERE s.question_count > 0), 0)::float8 AS accuracy
          FROM practice_sessions s
          JOIN users u ON u.id = s.user_id
         WHERE ${Prisma.join(where, ' AND ')}
         GROUP BY s.user_id),
      ranked AS (
        SELECT per.*, row_number() OVER (ORDER BY per.coins DESC, per.accuracy DESC, per.user_id ASC) AS rank FROM per)
      SELECT r.user_id AS "userId", u.name, r.coins, r.sessions, r.accuracy, r.rank
        FROM ranked r JOIN users u ON u.id = r.user_id
       WHERE r.rank <= ${q.limit}::bigint OR r.user_id = ${this.user(q.viewerId)}
       ORDER BY r.rank`
    const fact = (r: (typeof rows)[number]) => ({ userId: idToString(r.userId), name: r.name, coins: num(r.coins), sessions: num(r.sessions), accuracy: Number(r.accuracy) })
    const mine = rows.find((r) => idToString(r.userId) === q.viewerId)
    return {
      rows: rows.filter((r) => num(r.rank) <= q.limit).map(fact),
      me: mine ? { ...fact(mine), rank: num(mine.rank) } : null,
    }
  }

  private inList(column: string, list: readonly string[]): Prisma.Sql {
    const b = ids(list)
    return b.length === 0 ? Prisma.sql`false` : Prisma.sql`${Prisma.raw(column)} IN (${Prisma.join(b)})`
  }

  /** A malformed id matches nothing (0 is never a row id). */
  private user(id: string): bigint {
    try {
      return idFromString(id)
    } catch {
      return 0n
    }
  }
  private subject(id: string): bigint {
    return this.user(id)
  }
}
