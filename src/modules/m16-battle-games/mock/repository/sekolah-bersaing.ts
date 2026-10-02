/**
 * The `sekolahBersaing` repository (owner M16; SRS M16 v1.6 DATA-M16-13, BR-M16-35, §6.11.6, §7 #50):
 * the stored weekly job snapshots of the school board. A week is its Monday (MYT); the page shows the
 * stored rows in stored rank order.
 *
 * The school of each row is the n-th school of its state in the M02 register (ascending id), skipping
 * the fixture schools 900001-900099 and the battle anchors (PROPOSED placement, §6.11.6). It is
 * resolved once at finalise (the M02 dataset is compiled by then) and stored as `schoolId`.
 */

import { fromMytParts, mytParts, weekRange, formatDateKey } from '@/lib/time'
import { defineNamedQueries } from '@/mock/dataset'
import { defineRepository } from '@/mock/repository'
import { isFixtureSchoolId, schools } from '@/modules/m02-users-schools/mock'

import { SB_WEEKS } from '../data/sekolah-bersaing-seed'
import { sekolahBersaingTable } from '../tables/tables'
import { m16Now } from './common'

/** The battle anchors and the school of the S4 hero (never a Sekolah Bersaing placement). */
const ANCHOR_SCHOOLS = new Set([2710, 8078, 8080, 8082, 8090, 8106, 8880, 900])

export const sekolahBersaingQueries = defineNamedQueries(sekolahBersaingTable, {
  'Q-SB-WEEK': {
    where: (weekStart: string) => ({ weekStart }),
    expected: [
      { args: ['2026-09-21'], value: 49 },
      { args: ['2026-09-14'], value: 48 },
      { args: ['2026-09-07'], value: 48 },
      { args: ['2026-08-31'], value: 48 },
    ],
    source: 'M16 §6.10',
  },
})

export interface SekolahBersaingView {
  weekStart: string
  count: number
  rows: {
    rank: number
    schoolName: string
    state: string
    aktifPct: number
    streakAvg: number
    notaPer10: number
    anonymous: boolean
  }[]
}

/**
 * The Monday (`YYYY-MM-DD`, MYT) of the week named by `value`: a valid `YYYY-MM-DD` date gives its
 * week, anything else the current week (DV-M16-30).
 */
export function weekStartOf(value: unknown, now: number): string {
  if (typeof value === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (m) {
      const ms = fromMytParts({ year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) })
      const p = mytParts(ms)
      if (p.year === Number(m[1]) && p.month === Number(m[2]) && p.day === Number(m[3])) {
        return formatDateKey(weekRange(ms).start)
      }
    }
  }
  return formatDateKey(weekRange(now).start)
}

export const sekolahBersaingRepo = defineRepository({
  owner: 'M16',
  name: 'sekolahBersaing',
  store: sekolahBersaingTable,
  queries: sekolahBersaingQueries,
  methods: ({ store, transaction }) => ({
    /**
     * Finalise phase: writes the four weekly snapshots, resolving each "SB-{state}-{n}" placement
     * to a register school (throws when a state has too few schools).
     */
    seedWeeks(): void {
      const cache = new Map<string, number[]>()
      const idsOf = (state: string): number[] => {
        let ids = cache.get(state)
        if (!ids) {
          ids = schools
            .list({ state, pageSize: 100_000 })
            .rows.map((s) => s.id)
            .filter((id) => !isFixtureSchoolId(id) && !ANCHOR_SCHOOLS.has(id))
            .sort((a, b) => a - b)
          cache.set(state, ids)
        }
        return ids
      }
      transaction(() => {
        for (const [weekStart, rows] of Object.entries(SB_WEEKS)) {
          rows.forEach(([state, n, aktifPct, streakAvg, notaPer10], i) => {
            const schoolId = idsOf(state)[n - 1]
            if (schoolId === undefined) {
              throw new Error(`M16 Sekolah Bersaing: no school number ${String(n)} in ${state}`)
            }
            store.insert({
              weekStart,
              rank: i + 1,
              schoolId,
              aktifPct,
              streakAvg,
              notaPer10,
              anonymous: false,
            })
          })
        }
      })
    },

    /** #50: the snapshot of the week named by `week` (any text; invalid = the current week). */
    view(week: unknown): SekolahBersaingView {
      const weekStart = weekStartOf(week, m16Now())
      const rows = store.query({ where: { weekStart }, sort: 'rank' }).rows
      return {
        weekStart,
        count: rows.length,
        rows: rows.map((r) => {
          const school = schools.get(r.schoolId)
          return {
            rank: r.rank,
            schoolName: r.anonymous ? 'Sekolah anonim' : (school?.name ?? ''),
            state: school?.state ?? '',
            aktifPct: r.aktifPct,
            streakAvg: r.streakAvg,
            notaPer10: r.notaPer10,
            anonymous: r.anonymous,
          }
        }),
      }
    },

    /** Test fixture `anonymousSchool`: marks the row of `rank` in `weekStart` as opted out. */
    markAnonymous(weekStart: string, rank: number): void {
      transaction(() => {
        const row = store.query({ where: { weekStart, rank } }).rows[0]
        if (row) store.update(row.id, { anonymous: true })
      })
    },
  }),
})
