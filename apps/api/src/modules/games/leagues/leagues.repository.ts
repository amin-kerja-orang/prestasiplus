import { Inject, Injectable } from '@nestjs/common'

import { idFromString, idToString } from '../../../db/ids'
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
}

export interface SekolahBersaingRecord {
  rank: number
  schoolId: string
  aktifPct: number
  streakAvg: number
  notaPer10: number
  isAnonymous: boolean
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
  isTest: r.isTest,
})

/**
 * Leagues and the Sekolah Bersaing board (BE-45, M16-46 to M16-50). Test rows (Mod Pelajar) are visible only to
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

  async leagueByCode(code: string, viewerIsTest: boolean): Promise<LeagueRecord | null> {
    const row = await this.db.league.findFirst({ where: { inviteCode: code, ...this.vis(viewerIsTest) } })
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
    return rows.map((r) => ({ level: r.level, schoolId: idToString(r.schoolId), peserta: r.peserta, skor: Number(r.skor), purata: Number(r.purata) }))
  }

  /** Stored Sekolah Bersaing rows of the week (`YYYY-MM-DD` Monday), in rank order. */
  async sekolahBersaing(weekStart: string): Promise<SekolahBersaingRecord[]> {
    const rows = await this.db.sekolahBersaingWeek.findMany({
      where: { weekStart: new Date(`${weekStart}T00:00:00.000Z`) },
      orderBy: { rank: 'asc' },
    })
    return rows.map((r) => ({
      rank: r.rank,
      schoolId: idToString(r.schoolId),
      aktifPct: Number(r.aktifPct),
      streakAvg: Number(r.streakAvg),
      notaPer10: Number(r.notaPer10),
      isAnonymous: r.isAnonymous,
    }))
  }
}

