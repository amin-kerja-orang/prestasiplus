import { Inject, Injectable } from '@nestjs/common'

import { idFromString, idToString } from '../../../db/ids'
import { Prisma } from '../../../db/generated/client'
import { PrismaService } from '../../../db/prisma.service'

export interface LeagueRecord {
  id: string
  name: string
  type: string
  scope: string
  subjectId: string | null
  gameMode: string
  scoringMethod: string
  startDate: Date
  endDate: Date
  maxSchools: number | null
  inviteCode: string
  creatorId: string | null
  status: string
  /** Set by the final recompute of an ended league (DM-62); the standings no longer change after it. */
  frozenAt: Date | null
  isTest: boolean
}

export interface NewLeague {
  name: string
  type: string
  scope: string
  subjectId: string | null
  gameMode: string
  scoringMethod: string
  startDate: string
  endDate: string
  maxSchools: number | null
  creatorId: string
  isTest: boolean
  createdAt: Date
}

export interface StandingRecord {
  level: string
  schoolId: string
  peserta: number
  skor: number
  purata: number
  /** Time of the hourly recompute that wrote the row; null on a seeded row. */
  recomputedAt: Date | null
}

/** What the hourly job reads for one pupil of the league (facts before the mode rule). */
export interface PupilLeagueFacts {
  userId: string
  schoolId: string
  grade: number
  answered: number
  correct: number
  battlePoints: number
  wins: number
}

/** A contribution row ("Penyumbang"). */
export interface ContributionRecord {
  userId: string
  schoolId: string
  points: number
}

const toRecord = (r: {
  id: bigint
  name: string
  type: string
  scope: string
  subjectId: bigint | null
  gameMode: string
  scoringMethod: string
  startDate: Date
  endDate: Date
  maxSchools: number | null
  inviteCode: string
  creatorId: bigint | null
  status: string
  frozenAt: Date | null
  isTest: boolean
}): LeagueRecord => ({
  id: idToString(r.id),
  name: r.name,
  type: r.type,
  scope: r.scope,
  subjectId: r.subjectId === null ? null : idToString(r.subjectId),
  gameMode: r.gameMode,
  scoringMethod: r.scoringMethod,
  startDate: r.startDate,
  endDate: r.endDate,
  maxSchools: r.maxSchools,
  inviteCode: r.inviteCode,
  creatorId: r.creatorId === null ? null : idToString(r.creatorId),
  status: r.status,
  frozenAt: r.frozenAt,
  isTest: r.isTest,
})

/**
 * Leagues (BE-45, M16-46 to M16-49). Test rows (Mod Pelajar) are visible only to
 * Mod Pelajar callers: a normal caller never sees a test league or a test school membership. Everything goes
 * through `prisma.client`, so a call inside `transaction()` joins it.
 */
@Injectable()
export class LeaguesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  /** Runs `fn` in one transaction (nested calls reuse the outer one). */
  transaction<T>(fn: () => Promise<T>): Promise<T> {
    return this.prisma.transaction(() => fn())
  }

  /** Row filter that hides test rows from a normal caller. */
  private vis(isTest: boolean): { isTest?: false } {
    return isTest ? {} : { isTest: false }
  }

  async leagues(viewerIsTest: boolean): Promise<LeagueRecord[]> {
    const rows = await this.db.league.findMany({ where: this.vis(viewerIsTest), orderBy: { id: 'asc' } })
    return rows.map(toRecord)
  }

  async league(id: string, viewerIsTest: boolean): Promise<LeagueRecord | null> {
    const row = await this.db.league.findFirst({ where: { id: idFromString(id), ...this.vis(viewerIsTest) } })
    return row ? toRecord(row) : null
  }

  /** `SELECT ... FOR UPDATE` of the league row; returns the fresh record (null when gone). */
  async lockLeague(id: string): Promise<LeagueRecord | null> {
    await this.db.$queryRaw`SELECT id FROM leagues WHERE id = ${idFromString(id)}::bigint FOR UPDATE`
    const row = await this.db.league.findUnique({ where: { id: idFromString(id) } })
    return row ? toRecord(row) : null
  }

  /**
   * Inserts the league with the given invite code unless the code is taken (`ON CONFLICT DO NOTHING`, so a
   * collision never aborts the transaction). Returns the new id, or null on a collision.
   */
  async insertLeague(input: NewLeague, code: string): Promise<string | null> {
    const rows = await this.db.$queryRaw<{ id: bigint }[]>`
      INSERT INTO leagues (name, type, scope, subject_id, game_mode, scoring_method, start_date, end_date,
                           max_schools, invite_code, creator_id, status, is_test, created_at)
      VALUES (${input.name}, ${input.type}, ${input.scope},
              ${input.subjectId === null ? null : idFromString(input.subjectId)}::bigint,
              ${input.gameMode}, ${input.scoringMethod}, ${input.startDate}::date, ${input.endDate}::date,
              ${input.maxSchools}::smallint, ${code}, ${idFromString(input.creatorId)}::bigint,
              'upcoming', ${input.isTest}, ${input.createdAt}::timestamptz)
      ON CONFLICT (invite_code) DO NOTHING
      RETURNING id`
    return rows[0] ? idToString(rows[0].id) : null
  }

  async addClassLevels(leagueId: string, levels: readonly string[]): Promise<void> {
    if (levels.length === 0) return
    await this.db.leagueClassLevel.createMany({ data: levels.map((level) => ({ leagueId: idFromString(leagueId), level })) })
  }

  async classLevels(leagueId: string): Promise<string[]> {
    const rows = await this.db.leagueClassLevel.findMany({ where: { leagueId: idFromString(leagueId) } })
    const order = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'T1', 'T2', 'T3', 'T4', 'T5']
    return rows.map((r) => r.level).sort((a, b) => order.indexOf(a) - order.indexOf(b))
  }

  async addSchool(leagueId: string, schoolId: string, isTest: boolean, joinedAt: Date): Promise<void> {
    await this.db.leagueSchool.create({ data: { leagueId: idFromString(leagueId), schoolId: idFromString(schoolId), isTest, joinedAt } })
  }

  /** All memberships of the league, test rows included (capacity and duplicate checks). */
  async membershipCount(leagueId: string): Promise<number> {
    return this.db.leagueSchool.count({ where: { leagueId: idFromString(leagueId) } })
  }

  async hasSchool(leagueId: string, schoolId: string): Promise<boolean> {
    return (await this.db.leagueSchool.count({ where: { leagueId: idFromString(leagueId), schoolId: idFromString(schoolId) } })) > 0
  }

  /** School ids of the league in join order, as shown to the viewer. */
  async schoolIds(leagueId: string, viewerIsTest: boolean): Promise<string[]> {
    const rows = await this.db.leagueSchool.findMany({
      where: { leagueId: idFromString(leagueId), ...this.vis(viewerIsTest) },
      orderBy: { id: 'asc' },
      select: { schoolId: true },
    })
    return rows.map((r) => idToString(r.schoolId))
  }

  /** Visible school counts by league id. */
  async schoolCounts(leagueIds: readonly string[], viewerIsTest: boolean): Promise<Map<string, number>> {
    if (leagueIds.length === 0) return new Map()
    const rows = await this.db.leagueSchool.groupBy({
      by: ['leagueId'],
      where: { leagueId: { in: leagueIds.map(idFromString) }, ...this.vis(viewerIsTest) },
      _count: { _all: true },
    })
    return new Map(rows.map((r) => [idToString(r.leagueId), r._count._all]))
  }

  /** Ids of the leagues the school belongs to (as visible to the viewer). */
  async leagueIdsOfSchool(schoolId: string, viewerIsTest: boolean): Promise<Set<string>> {
    const rows = await this.db.leagueSchool.findMany({
      where: { schoolId: idFromString(schoolId), ...this.vis(viewerIsTest) },
      select: { leagueId: true },
    })
    return new Set(rows.map((r) => idToString(r.leagueId)))
  }

  /** Stored standing rows of one league, in stored order (never recomputed). */
  async standings(leagueId: string): Promise<StandingRecord[]> {
    const rows = await this.db.leagueStanding.findMany({
      where: { leagueId: idFromString(leagueId) },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
    })
    return rows.map((r) => ({ level: r.level, schoolId: idToString(r.schoolId), peserta: r.peserta, skor: Number(r.skor), purata: Number(r.purata), recomputedAt: r.recomputedAt }))
  }

  // --- hourly standings job and API-GAME-13 (S7-T06 part 3) ---------------------------------------------------------

  /** Leagues that are not frozen (the derived status is decided by the caller). */
  async unfrozenLeagues(): Promise<LeagueRecord[]> {
    const rows = await this.db.league.findMany({ where: { frozenAt: null }, orderBy: { id: 'asc' } })
    return rows.map(toRecord)
  }

  /** Latest `recomputed_at` of the league's stored rows (null: none written by the job). */
  async lastRecomputedAt(leagueId: string): Promise<Date | null> {
    const r = await this.db.leagueStanding.aggregate({ where: { leagueId: idFromString(leagueId) }, _max: { recomputedAt: true } })
    return r._max.recomputedAt
  }

  /**
   * Facts per real pupil (role student, school in the league, grade in `grades`) inside `[from, to)`: quiz answers
   * (`latih_tubi|chapter|databank|game`, optional subject) and finished real Battles (no robot, counted for ranking).
   * `is_test` rows are never read. One set-based statement per league.
   */
  async pupilFacts(leagueId: string, window: { from: Date; to: Date }, grades: readonly number[], subjectId: string | null): Promise<PupilLeagueFacts[]> {
    if (grades.length === 0) return []
    const lid = idFromString(leagueId)
    const subject = subjectId === null ? null : idFromString(subjectId)
    const rows = await this.db.$queryRaw<
      { user_id: bigint; school_id: bigint; grade: number; answered: bigint; correct: bigint; battle_points: bigint; wins: bigint }[]
    >(Prisma.sql`
      WITH pupils AS (
        SELECT u.id, u.school_id, u.grade
          FROM users u
          JOIN league_schools ls ON ls.school_id = u.school_id AND ls.league_id = ${lid}::bigint
         WHERE u.grade IN (${Prisma.join([...grades])})
           AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'student')
      ), quiz AS (
        SELECT a.user_id, count(*) AS answered, count(*) FILTER (WHERE a.is_correct) AS correct
          FROM practice_answers a
          JOIN pupils p ON p.id = a.user_id
         WHERE a.is_test = false
           AND a.mode IN ('latih_tubi', 'chapter', 'databank', 'game')
           AND a.answered_at >= ${window.from} AND a.answered_at < ${window.to}
           AND (${subject}::bigint IS NULL OR a.subject_id = ${subject}::bigint)
         GROUP BY a.user_id
      ), battle AS (
        SELECT bp.user_id,
               sum(round(bp.score / 100.0)) AS points,
               count(*) FILTER (WHERE b.winner = bp.side) AS wins
          FROM battle_participants bp
          JOIN battles b ON b.id = bp.battle_id
          JOIN pupils p ON p.id = bp.user_id
         WHERE bp.is_bot = false AND bp.is_test = false AND b.is_test = false
           AND b.counts_for_ranking = true AND b.status = 'finished'
           AND b.finished_at >= ${window.from} AND b.finished_at < ${window.to}
           AND NOT EXISTS (SELECT 1 FROM battle_participants x WHERE x.battle_id = b.id AND x.is_bot)
         GROUP BY bp.user_id
      )
      SELECT p.id AS user_id, p.school_id, p.grade,
             coalesce(q.answered, 0) AS answered, coalesce(q.correct, 0) AS correct,
             coalesce(bt.points, 0)::bigint AS battle_points, coalesce(bt.wins, 0) AS wins
        FROM pupils p
        LEFT JOIN quiz q ON q.user_id = p.id
        LEFT JOIN battle bt ON bt.user_id = p.id
       WHERE q.user_id IS NOT NULL OR bt.user_id IS NOT NULL`)
    return rows.map((r) => ({
      userId: idToString(r.user_id),
      schoolId: idToString(r.school_id),
      grade: r.grade,
      answered: Number(r.answered),
      correct: Number(r.correct),
      battlePoints: Number(r.battle_points),
      wins: Number(r.wins),
    }))
  }

  /** Replaces the stored standings and contributions of one league (the caller holds the league lock). */
  async replaceStandings(
    leagueId: string,
    rows: readonly { level: string; schoolId: string; peserta: number; skor: number; purata: number }[],
    contributions: readonly ContributionRecord[],
    recomputedAt: Date,
  ): Promise<void> {
    const lid = idFromString(leagueId)
    await this.db.leagueStanding.deleteMany({ where: { leagueId: lid } })
    await this.db.leagueContribution.deleteMany({ where: { leagueId: lid } })
    const order = new Map<string, number>()
    await this.db.leagueStanding.createMany({
      data: rows.map((r) => {
        const n = (order.get(r.level) ?? 0) + 1
        order.set(r.level, n)
        return { leagueId: lid, level: r.level, schoolId: idFromString(r.schoolId), peserta: r.peserta, skor: r.skor, purata: r.purata, sortOrder: n, recomputedAt }
      }),
    })
    await this.db.leagueContribution.createMany({
      data: contributions.map((c) => ({ leagueId: lid, schoolId: idFromString(c.schoolId), userId: idFromString(c.userId), points: c.points })),
    })
  }

  async freeze(leagueId: string, at: Date): Promise<void> {
    await this.db.league.update({ where: { id: idFromString(leagueId) }, data: { frozenAt: at } })
  }

  /** Contributions of one school in the league: points desc, then user id (the caller sorts by name). */
  async contributionsOfSchool(leagueId: string, schoolId: string): Promise<ContributionRecord[]> {
    const rows = await this.db.leagueContribution.findMany({
      where: { leagueId: idFromString(leagueId), schoolId: idFromString(schoolId) },
      orderBy: [{ points: 'desc' }, { userId: 'asc' }],
    })
    return rows.map((r) => ({ userId: idToString(r.userId), schoolId: idToString(r.schoolId), points: r.points }))
  }

  async pointsOf(leagueId: string, userId: string): Promise<number> {
    const r = await this.db.leagueContribution.findUnique({ where: { leagueId_userId: { leagueId: idFromString(leagueId), userId: idFromString(userId) } } })
    return r?.points ?? 0
  }
}
