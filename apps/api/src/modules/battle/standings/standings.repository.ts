import { Inject, Injectable } from '@nestjs/common'

import { idFromString, idToString } from '../../../db/ids'
import { Prisma } from '../../../db/generated/client'
import { PrismaService } from '../../../db/prisma.service'
import type { PeriodWindow } from './standings.windows'

/** A student's totals over the counted battles of a window (`skor` = sum of round(score / 100) per side). */
export interface StudentTotals {
  userId: string
  menang: number
  seri: number
  kalah: number
  correct: number
  answered: number
  streak: number
  skor: number
}

/** A school's totals, grouped by the school stored on the participant row. */
export interface SchoolTotals {
  schoolId: string
  battles: number
  menang: number
  seri: number
  kalah: number
  correct: number
  answered: number
  pelajar: number
  skor: number
}

/** One finished or forfeited battle with both sides (history and the school page). */
export interface BattleRowData {
  id: string
  scoreA: number
  scoreB: number
  winner: string | null
  createdAt: Date
  playerA: string
  playerB: string
  schoolA: string | null
  schoolB: string | null
}

interface RawBattle {
  id: string
  score_a: number
  score_b: number
  winner: string | null
  created_at: Date
  user_a: bigint
  user_b: bigint
  school_a: bigint | null
  school_b: bigint | null
}

const COUNTED = Prisma.sql`b.status IN ('finished', 'forfeited') AND b.is_test = false AND p.is_test = false AND p.is_bot = false`

const windowSql = (w: PeriodWindow): Prisma.Sql => {
  const parts: Prisma.Sql[] = []
  if (w.from) parts.push(Prisma.sql`b.created_at >= ${w.from}`)
  if (w.to) parts.push(Prisma.sql`b.created_at < ${w.to}`)
  return parts.length === 0 ? Prisma.empty : Prisma.sql`AND ${Prisma.join(parts, ' AND ')}`
}

const num = (v: bigint | number | null): number => Number(v ?? 0)

/** Bot sides (`is_bot`, real pupils used as simulated opponents) never earn standings, history or school credit. */
/** Aggregations over `battle_participants` / `battles` (BE-44 AC 13). Reads only the battle tables. */
@Injectable()
export class StandingsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * One row per user who fought in the window, in the standing order: skor desc, menang desc, user id.
   * `streak` = wins in a row from the newest battle (ties of `created_at` broken by battle id, newest first).
   */
  async studentTotals(w: PeriodWindow): Promise<StudentTotals[]> {
    const rows = await this.prisma.client.$queryRaw<
      {
        user_id: bigint
        menang: bigint
        seri: bigint
        kalah: bigint
        correct: bigint
        answered: bigint
        streak: bigint
        skor: bigint
      }[]
    >(Prisma.sql`
      WITH s AS (
        SELECT p.user_id, p.correct, b.answered, ((p.score + 50) / 100) AS skor,
               b.winner IS NULL AS draw,
               COALESCE(b.winner = p.side, false) AS win,
               row_number() OVER (PARTITION BY p.user_id ORDER BY b.created_at DESC, b.id DESC) AS rn
        FROM battle_participants p
        JOIN battles b ON b.id = p.battle_id
        LEFT JOIN users hu ON hu.id = p.user_id
        LEFT JOIN schools hs ON hs.id = hu.school_id
        WHERE ${COUNTED} ${windowSql(w)} AND (hu.grade IS NULL OR hu.grade >= 7) AND (hs.type IS NULL OR hs.type NOT IN ('SK', 'SJK(C)', 'SJK(T)'))
      )
      SELECT user_id,
             count(*) FILTER (WHERE win) AS menang,
             count(*) FILTER (WHERE draw) AS seri,
             count(*) FILTER (WHERE NOT win AND NOT draw) AS kalah,
             sum(correct) AS correct,
             sum(answered) AS answered,
             COALESCE(min(rn) FILTER (WHERE NOT win) - 1, count(*)) AS streak,
             sum(skor) AS skor
      FROM s
      GROUP BY user_id
      ORDER BY sum(skor) DESC, count(*) FILTER (WHERE win) DESC, user_id ASC`)
    return rows.map((r) => ({
      userId: idToString(r.user_id),
      menang: num(r.menang),
      seri: num(r.seri),
      kalah: num(r.kalah),
      correct: num(r.correct),
      answered: num(r.answered),
      streak: num(r.streak),
      skor: num(r.skor),
    }))
  }

  /** One row per stored participant school in the window, skor desc then school id (the national order). */
  async schoolTotals(w: PeriodWindow): Promise<SchoolTotals[]> {
    const rows = await this.prisma.client.$queryRaw<
      {
        school_id: bigint
        battles: bigint
        menang: bigint
        seri: bigint
        kalah: bigint
        correct: bigint
        answered: bigint
        pelajar: bigint
        skor: bigint
      }[]
    >(Prisma.sql`
      SELECT p.school_id,
             count(*) AS battles,
             count(*) FILTER (WHERE b.winner = p.side) AS menang,
             count(*) FILTER (WHERE b.winner IS NULL) AS seri,
             count(*) FILTER (WHERE b.winner IS NOT NULL AND b.winner <> p.side) AS kalah,
             sum(p.correct) AS correct,
             sum(b.answered) AS answered,
             count(DISTINCT p.user_id) AS pelajar,
             sum((p.score + 50) / 100) AS skor
      FROM battle_participants p
      JOIN battles b ON b.id = p.battle_id
      LEFT JOIN users hu ON hu.id = p.user_id
      JOIN schools hs ON hs.id = p.school_id
      WHERE ${COUNTED} AND p.school_id IS NOT NULL ${windowSql(w)}
        AND (hu.grade IS NULL OR hu.grade >= 7) AND (hs.type IS NULL OR hs.type NOT IN ('SK', 'SJK(C)', 'SJK(T)')) -- secondary-only (2026-10-29)
      GROUP BY p.school_id
      ORDER BY sum((p.score + 50) / 100) DESC, p.school_id ASC`)
    return rows.map((r) => ({
      schoolId: idToString(r.school_id),
      battles: num(r.battles),
      menang: num(r.menang),
      seri: num(r.seri),
      kalah: num(r.kalah),
      correct: num(r.correct),
      answered: num(r.answered),
      pelajar: num(r.pelajar),
      skor: num(r.skor),
    }))
  }

  private toBattle(r: RawBattle): BattleRowData {
    return {
      id: r.id,
      scoreA: r.score_a,
      scoreB: r.score_b,
      winner: r.winner,
      createdAt: r.created_at,
      playerA: idToString(r.user_a),
      playerB: idToString(r.user_b),
      schoolA: r.school_a === null ? null : idToString(r.school_a),
      schoolB: r.school_b === null ? null : idToString(r.school_b),
    }
  }

  private static readonly BATTLE_COLUMNS = Prisma.sql`
      b.id::text AS id, a.score AS score_a, c.score AS score_b, b.winner, b.created_at,
      a.user_id AS user_a, c.user_id AS user_b, a.school_id AS school_a, c.school_id AS school_b`

  /** The user's finished and forfeited battles (both sides), newest first. */
  async historyOf(userId: string): Promise<BattleRowData[]> {
    const rows = await this.prisma.client.$queryRaw<RawBattle[]>(Prisma.sql`
      SELECT ${StandingsRepository.BATTLE_COLUMNS}
      FROM battles b
      JOIN battle_participants a ON a.battle_id = b.id AND a.side = 'A'
      JOIN battle_participants c ON c.battle_id = b.id AND c.side = 'B'
      WHERE b.status IN ('finished', 'forfeited') AND b.is_test = false
        AND ((a.user_id = ${idFromString(userId)} AND NOT a.is_bot) OR (c.user_id = ${idFromString(userId)} AND NOT c.is_bot))
      ORDER BY b.created_at DESC, b.id DESC`)
    return rows.map((r) => this.toBattle(r))
  }

  /** The latest `limit` FINISHED battles (forfeits are not shown) that have the school on a side. */
  async recentOfSchool(schoolId: string, limit: number): Promise<BattleRowData[]> {
    const rows = await this.prisma.client.$queryRaw<RawBattle[]>(Prisma.sql`
      SELECT ${StandingsRepository.BATTLE_COLUMNS}
      FROM battles b
      JOIN battle_participants a ON a.battle_id = b.id AND a.side = 'A'
      JOIN battle_participants c ON c.battle_id = b.id AND c.side = 'B'
      WHERE b.status = 'finished' AND b.is_test = false
        AND ((a.school_id = ${idFromString(schoolId)} AND NOT a.is_bot) OR (c.school_id = ${idFromString(schoolId)} AND NOT c.is_bot))
      ORDER BY b.created_at DESC, b.id DESC
      LIMIT ${limit}`)
    return rows.map((r) => this.toBattle(r))
  }
}
