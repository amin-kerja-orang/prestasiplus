import { Inject, Injectable } from '@nestjs/common'
import {
  BATTLE_MESSAGES,
  BATTLE_RULES,
  type BattleListRowSchema,
  type BattlePodiumEntrySchema,
  type BattleSchoolDetailSchema,
  type BattleSchoolStandingSchema,
  type BattleStudentStandingSchema,
} from '@pp/contract'
import type { z } from 'zod'

import { ApiError } from '../../../common/errors/api-error'
import { toMytTimestamp } from '../../../common/time/myt'
import { CLOCK, type Clock } from '../../../db/clock'
import { isIdString } from '../../../db/ids'
import { BattleDeps, type BattleSchool } from '../battle.deps'
import { type PeriodWindow, periodWindow, isStandingPeriod, type StandingPeriod } from './standings.windows'
import { type BattleRowData, type SchoolTotals, StandingsRepository, type StudentTotals } from './standings.repository'

export type StudentStanding = z.infer<typeof BattleStudentStandingSchema>
export type SchoolStanding = z.infer<typeof BattleSchoolStandingSchema>
export type PodiumEntry = z.infer<typeof BattlePodiumEntrySchema>
export type BattleListRow = z.infer<typeof BattleListRowSchema>
export type SchoolDetail = z.infer<typeof BattleSchoolDetailSchema>

/** round(correct / answered * 100), 0 without answers (the mock's `pct`). */
const pct = (correct: number, answered: number): number => (answered === 0 ? 0 : Math.round((correct / answered) * 100))

/** M16-18..21 (BE-44 AC 13): standings computed from finished and forfeited battles, in Asia/Kuala_Lumpur windows. */
@Injectable()
export class StandingsService {
  /** Seconds a national aggregation is reused across callers (`BATTLE_STANDINGS_CACHE_SECONDS`, default 30; 0 = off). */
  cacheTtlSeconds = Number.isFinite(Number(process.env.BATTLE_STANDINGS_CACHE_SECONDS ?? '')) && process.env.BATTLE_STANDINGS_CACHE_SECONDS !== undefined && process.env.BATTLE_STANDINGS_CACHE_SECONDS !== '' ? Math.max(0, Number(process.env.BATTLE_STANDINGS_CACHE_SECONDS)) : 30
  private readonly cache = new Map<string, { expires: number; value: Promise<unknown> }>()

  /** Clock-based TTL cache of the national aggregations, keyed by kind and window (the state filter is applied after). */
  private cached<T>(kind: 'students' | 'schools', w: PeriodWindow, load: () => Promise<T>): Promise<T> {
    if (this.cacheTtlSeconds <= 0) return load()
    const now = this.clock.now().getTime()
    const key = `${kind}|${w.from?.toISOString() ?? ''}|${w.to?.toISOString() ?? ''}`
    const hit = this.cache.get(key)
    if (hit && hit.expires > now) return hit.value as Promise<T>
    if (this.cache.size >= 50) for (const [k, v] of this.cache) if (v.expires <= now) this.cache.delete(k)
    const value = load()
    this.cache.set(key, { expires: now + this.cacheTtlSeconds * 1000, value })
    value.catch(() => {
      if (this.cache.get(key)?.value === value) this.cache.delete(key)
    })
    return value
  }

  constructor(
    @Inject(StandingsRepository) private readonly repo: StandingsRepository,
    @Inject(BattleDeps) private readonly deps: BattleDeps,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Ranked students of a period with the CURRENT school of each (internal; the route drops `schoolId`). */
  private async rankedStudents(period: StandingPeriod): Promise<(StudentStanding & { schoolId: string | null })[]> {
    const w = periodWindow(period, this.clock.now())
    const totals = await this.cached('students', w, () => this.repo.studentTotals(w))
    const players = await this.deps.players(totals.map((t) => t.userId))
    return totals.map((t: StudentTotals, i) => {
      const p = players.get(t.userId)
      return {
        rank: i + 1,
        userId: t.userId,
        name: p?.name ?? 'Pelajar',
        school: p?.schoolName ?? '',
        schoolId: p?.schoolId ?? null,
        menang: t.menang,
        seri: t.seri,
        kalah: t.kalah,
        ketepatan: pct(t.correct, t.answered),
        streak: t.streak,
        skor: t.skor,
      }
    })
  }

  /** M16-18: `monthly`, anything else is weekly. */
  async students(periodParam: string | undefined): Promise<StudentStanding[]> {
    const rows = await this.rankedStudents(periodParam === 'monthly' ? 'monthly' : 'weekly')
    return rows.map(({ schoolId: _school, ...row }) => {
      void _school
      return row
    })
  }

  private async nationalSchools(period: StandingPeriod): Promise<{ rows: SchoolStanding[]; totals: SchoolTotals[] }> {
    const w = periodWindow(period, this.clock.now())
    const totals = await this.cached('schools', w, () => this.repo.schoolTotals(w))
    const info = await this.deps.schoolsByIds(totals.map((t) => t.schoolId))
    const rows = totals.map((t, i): SchoolStanding => {
      const s = info.get(t.schoolId)
      return {
        rank: i + 1,
        schoolId: t.schoolId,
        name: s?.name ?? '',
        state: s?.state ?? '',
        type: s?.type ?? '',
        battles: t.battles,
        menang: t.menang,
        seri: t.seri,
        kalah: t.kalah,
        ketepatan: pct(t.correct, t.answered),
        pelajar: t.pelajar,
        skor: t.skor,
      }
    })
    return { rows, totals }
  }

  /** M16-19: absent = weekly; an unknown value = all time with no active period. */
  async schools(periodParam: string | undefined, state: string | undefined) {
    const known = periodParam === undefined || isStandingPeriod(periodParam)
    const period: StandingPeriod = periodParam === undefined ? 'weekly' : isStandingPeriod(periodParam) ? periodParam : 'all_time'
    const { rows: national } = await this.nationalSchools(period)
    const podium: PodiumEntry[] = national.slice(0, BATTLE_RULES.podiumSize).map((r) => ({
      column: r.rank as 1 | 2 | 3,
      schoolId: r.schoolId,
      name: r.name,
      state: r.state,
      skor: r.skor,
    }))
    return {
      activePeriod: known ? period : null,
      rows: state ? national.filter((r) => r.state === state) : national,
      podium,
    }
  }

  private async listRows(rows: BattleRowData[], homeSchoolId: string | null): Promise<BattleListRow[]> {
    const players = await this.deps.players([...new Set(rows.flatMap((r) => [r.playerA, r.playerB]))])
    return rows.map((r) => ({
      uuid: r.id,
      playerA: {
        id: r.playerA,
        name: players.get(r.playerA)?.name ?? 'Pelajar',
        homeHere: homeSchoolId !== null && players.get(r.playerA)?.schoolId === homeSchoolId,
      },
      scoreA: r.scoreA,
      scoreB: r.scoreB,
      playerB: { id: r.playerB, name: players.get(r.playerB)?.name ?? 'Pelajar' },
      winner: r.winner === 'A' || r.winner === 'B' ? r.winner : null,
      createdAt: toMytTimestamp(r.createdAt),
    }))
  }

  /** M16-21: the caller's own finished and forfeited battles, newest first. */
  async history(userId: string): Promise<BattleListRow[]> {
    return this.listRows(await this.repo.historyOf(userId), null)
  }

  /** M16-20. */
  async schoolPage(id: string): Promise<SchoolDetail> {
    const school: BattleSchool | null = isIdString(id) ? await this.deps.school(id) : null
    if (!school) throw ApiError.of('NOT_FOUND', { message: BATTLE_MESSAGES.schoolNotFound })
    const [all, week, month, weeklyStudents, recent] = await Promise.all([
      this.nationalSchools('all_time'),
      this.nationalSchools('weekly'),
      this.nationalSchools('monthly'),
      this.rankedStudents('weekly'),
      this.repo.recentOfSchool(id, BATTLE_RULES.recentShown),
    ])
    const box = (rows: SchoolStanding[]) => {
      const r = rows.find((x) => x.schoolId === id)
      return r ? { rank: r.rank, battles: r.battles, menang: r.menang, seri: r.seri, kalah: r.kalah, skor: r.skor } : null
    }
    const a = all.rows.find((x) => x.schoolId === id)
    return {
      school: { id: school.id, name: school.name, ppd: school.district, state: school.state ?? '', type: school.type ?? '' },
      allTime: { battles: a?.battles ?? 0, menang: a?.menang ?? 0, ketepatan: a?.ketepatan ?? 0, pelajar: a?.pelajar ?? 0 },
      week: box(week.rows),
      month: box(month.rows),
      fighters: weeklyStudents
        .filter((s) => s.schoolId === id)
        .slice(0, BATTLE_RULES.fightersShown)
        .map((s) => ({ userId: s.userId, name: s.name, skor: s.skor })),
      recent: await this.listRows(recent, id),
    }
  }
}
