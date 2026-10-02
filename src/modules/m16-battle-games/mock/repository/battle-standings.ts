/**
 * The `battleStandings` repository (owner M16; SRS M16 v1.6 DATA-M16-05, BR-M16-12/13/15, §7 #18-#20):
 * the student and school standings of a period, **computed from the battle records** (D11). Only
 * `finished` and `forfeited` battles count. Battle, M/S/K and Pelajar are always computed; for the 8
 * observed school standings Ketepatan and Skor are the stored job figures (DC-M16-03) plus the
 * increments of runtime battles.
 *
 * Exported from the plugin as `standings` (SRS §7.2 `standings.school`): the repository name
 * `standings` is already taken by M08.
 */

import { monthRange, mytParts, weekRange } from '@/lib/time'
import { defineRepository } from '@/mock/repository'
import { schools } from '@/modules/m02-users-schools/mock'

import { battlesTable, storedStandingsTable } from '../tables/tables'
import type { BattleRow, StoredStandingRow } from '../types'
import { currentSchoolOf, m16Now, schoolName, sideSkor, userName } from './common'

export type StandingPeriod = 'weekly' | 'monthly' | 'all_time'

export const PERIODS: readonly StandingPeriod[] = ['weekly', 'monthly', 'all_time']

export const isPeriod = (v: unknown): v is StandingPeriod =>
  v === 'weekly' || v === 'monthly' || v === 'all_time'

export interface SchoolStanding {
  rank: number
  schoolId: number
  name: string
  state: string
  type: string
  battles: number
  menang: number
  seri: number
  kalah: number
  ketepatan: number
  pelajar: number
  skor: number
}

export interface StudentStanding {
  rank: number
  userId: number
  name: string
  school: string
  /** Current M02 school id (internal: S4 "Pejuang Terbaik"; not in the #18 body). */
  schoolId: number | null
  menang: number
  seri: number
  kalah: number
  ketepatan: number
  streak: number
  skor: number
}

interface Side {
  playerId: number
  schoolId: number | null
  score: number
  correct: number
  answered: number
  result: 'M' | 'S' | 'K'
  createdAtMs: number
  seeded: boolean
}

const COUNTED: readonly BattleRow['status'][] = ['finished', 'forfeited']

const monthKey = (ms: number): string => {
  const p = mytParts(ms)
  return `monthly:${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}`
}

/** The window of a period at `now` (null end = open), and the key of its stored figures. */
export function periodWindow(
  period: StandingPeriod,
  now: number,
): { start: number; end: number; key: string | null } {
  if (period === 'weekly') {
    const r = weekRange(now)
    return { start: r.start, end: r.end, key: null }
  }
  if (period === 'monthly') {
    const r = monthRange(now)
    return { start: r.start, end: r.end, key: monthKey(now) }
  }
  return { start: -Infinity, end: Infinity, key: 'all_time' }
}

const sidesOf = (b: BattleRow): [Side, Side] => [
  {
    playerId: b.playerA,
    schoolId: b.schoolAId,
    score: b.scoreA,
    correct: b.correctA,
    answered: b.answered,
    result: b.winner === 'A' ? 'M' : b.winner === null ? 'S' : 'K',
    createdAtMs: b.createdAtMs,
    seeded: b.seeded,
  },
  {
    playerId: b.playerB,
    schoolId: b.schoolBId,
    score: b.scoreB,
    correct: b.correctB,
    answered: b.answered,
    result: b.winner === 'B' ? 'M' : b.winner === null ? 'S' : 'K',
    createdAtMs: b.createdAtMs,
    seeded: b.seeded,
  },
]

const pct = (correct: number, answered: number): number =>
  answered === 0 ? 0 : Math.round((correct / answered) * 100)

export const battleStandingsRepo = defineRepository({
  owner: 'M16',
  name: 'battleStandings',
  store: storedStandingsTable,
  methods: ({ store, transaction }) => {
    const sides = (period: StandingPeriod): Side[] => {
      const w = periodWindow(period, m16Now())
      const out: Side[] = []
      for (const b of battlesTable.query({}).rows) {
        if (!COUNTED.includes(b.status) || b.createdAtMs < w.start || b.createdAtMs >= w.end)
          continue
        out.push(...sidesOf(b))
      }
      return out
    }

    const stored = (key: string | null): Map<number, StoredStandingRow> =>
      new Map(
        key === null
          ? []
          : store.query({ where: { periodKey: key } }).rows.map((r) => [r.schoolId, r]),
      )

    /** The school standings of a period, national order (BR-M16-13): Skor desc, ties by stored order. */
    const nationalSchools = (period: StandingPeriod): SchoolStanding[] => {
      const w = periodWindow(period, m16Now())
      const base = stored(w.key)
      interface Acc {
        battles: number
        menang: number
        seri: number
        kalah: number
        players: Set<number>
        correct: number
        answered: number
        seedAnswered: number
        rtCorrect: number
        rtAnswered: number
        rtSkor: number
        calcSkor: number
      }
      const by = new Map<number, Acc>()
      for (const s of sides(period)) {
        if (s.schoolId === null) continue
        const a = by.get(s.schoolId) ?? {
          battles: 0,
          menang: 0,
          seri: 0,
          kalah: 0,
          players: new Set<number>(),
          correct: 0,
          answered: 0,
          seedAnswered: 0,
          rtCorrect: 0,
          rtAnswered: 0,
          rtSkor: 0,
          calcSkor: 0,
        }
        a.battles++
        if (s.result === 'M') a.menang++
        else if (s.result === 'S') a.seri++
        else a.kalah++
        a.players.add(s.playerId)
        a.correct += s.correct
        a.answered += s.answered
        a.calcSkor += sideSkor(s.score)
        if (s.seeded) a.seedAnswered += s.answered
        else {
          a.rtCorrect += s.correct
          a.rtAnswered += s.answered
          a.rtSkor += sideSkor(s.score)
        }
        by.set(s.schoolId, a)
      }
      const rows = [...by.entries()].map(([schoolId, a]) => {
        const st = base.get(schoolId)
        const ketepatan = st
          ? a.rtAnswered === 0
            ? st.ketepatan
            : pct(
                (st.ketepatan / 100) * a.seedAnswered + a.rtCorrect,
                a.seedAnswered + a.rtAnswered,
              )
          : pct(a.correct, a.answered)
        const skor = st ? st.skor + a.rtSkor : a.calcSkor
        const school = schools.get(schoolId)
        return {
          order: st?.orderKey ?? Number.MAX_SAFE_INTEGER,
          row: {
            rank: 0,
            schoolId,
            name: school?.name ?? '',
            state: school?.state ?? '',
            type: school?.type ?? '',
            battles: a.battles,
            menang: a.menang,
            seri: a.seri,
            kalah: a.kalah,
            ketepatan,
            pelajar: a.players.size,
            skor,
          } satisfies SchoolStanding,
        }
      })
      rows.sort(
        (x, y) => y.row.skor - x.row.skor || x.order - y.order || x.row.schoolId - y.row.schoolId,
      )
      return rows.map((r, i) => ({ ...r.row, rank: i + 1 }))
    }

    return {
      /** Seed phase: the stored DC-M16-03 figures. */
      seed(rows: readonly Omit<StoredStandingRow, 'id'>[]): void {
        transaction(() => {
          for (const r of rows) store.insert({ ...r })
        })
      },

      /** Q-BAT-SCH(period, state?) rows; "#" stays the national position under a state filter. */
      schools(period: StandingPeriod, state?: string): SchoolStanding[] {
        const all = nationalSchools(period)
        return state ? all.filter((r) => r.state === state) : all
      },

      /** BR-M16-12: the standing of one school in a period, or `null` without battles. */
      school(schoolId: number, period: StandingPeriod): SchoolStanding | null {
        return nationalSchools(period).find((r) => r.schoolId === schoolId) ?? null
      },

      /** Q-BAT-STU(period): one row per student who battled, Skor desc (INFERRED). */
      students(period: StandingPeriod): StudentStanding[] {
        interface Acc {
          sides: Side[]
        }
        const by = new Map<number, Acc>()
        for (const s of sides(period)) {
          const a = by.get(s.playerId) ?? { sides: [] }
          a.sides.push(s)
          by.set(s.playerId, a)
        }
        const rows = [...by.entries()].map(([userId, a]) => {
          const ordered = [...a.sides].sort((x, y) => y.createdAtMs - x.createdAtMs)
          let streak = 0
          for (const s of ordered) {
            if (s.result !== 'M') break
            streak++
          }
          const count = (r: Side['result']) => a.sides.filter((s) => s.result === r).length
          return {
            rank: 0,
            userId,
            name: userName(userId),
            school: schoolName(currentSchoolOf(userId)),
            schoolId: currentSchoolOf(userId),
            menang: count('M'),
            seri: count('S'),
            kalah: count('K'),
            ketepatan: pct(
              a.sides.reduce((n, s) => n + s.correct, 0),
              a.sides.reduce((n, s) => n + s.answered, 0),
            ),
            streak,
            skor: a.sides.reduce((n, s) => n + sideSkor(s.score), 0),
          } satisfies StudentStanding
        })
        rows.sort((x, y) => y.skor - x.skor || y.menang - x.menang || x.userId - y.userId)
        return rows.map((r, i) => ({ ...r, rank: i + 1 }))
      },
    }
  },
})
