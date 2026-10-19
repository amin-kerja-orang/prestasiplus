/**
 * The `moodCheckins` repository: PROVISIONAL, owner **M26** (not specified yet), hosted by M17
 * (F-33, overview §6.7.2, XL3-23). Serves Q-M17-MOOD (M17 §6.4): all 307 / 280 / 72 / 91, month 0.
 * Other modules read it only through the M17 public entry (D12). The definition is a function of the
 * store and the `provisional` flag, so the owner's build task moves it unchanged.
 */

import { defineNamedQueries } from '@/mock/dataset'
import type { Table } from '@/mock/define'
import { defineRepository } from '@/mock/repository'

import { moodCheckinsTable } from '../tables/provisional-tables'
import type { ProvisionalOptions } from './provisional-options'
import { MOODS, type DateWindow, type Mood, type MoodCheckinRow } from './provisional-types'

/** Displayed totals of the observed check-ins (M17 R-37, XR-M17-18). */
export const MOOD_TOTALS: Readonly<Record<Mood, number>> = {
  happy: 307,
  okay: 280,
  sad: 72,
  stressed: 91,
}

export const MOOD_TOTAL = 750

function inWindow(row: MoodCheckinRow, window: DateWindow | undefined): boolean {
  if (window === undefined) return true
  if (window.from !== undefined && row.date < window.from) return false
  if (window.to !== undefined && row.date > window.to) return false
  return true
}

export function defineMoodCheckinsRepo(
  store: Table<MoodCheckinRow>,
  options: ProvisionalOptions = {},
) {
  return defineRepository({
    owner: 'M26',
    provisional: options.provisional ?? true,
    ...(options.registry === undefined ? {} : { registry: options.registry }),
    name: 'moodCheckins',
    store,
    queries: defineNamedQueries(store, {
      'Q-M17-MOOD': {
        where: (mood?: Mood) => (mood === undefined ? {} : { mood }),
        expected: [
          { args: [], value: MOOD_TOTAL },
          ...MOODS.map((mood) => ({ args: [mood], value: MOOD_TOTALS[mood] })),
        ],
        source: 'M17 §6.4, XR-M17-18',
      },
    }),
    methods: ({ store: rows, transaction }) => ({
      /** Seed phase: the observed check-ins (ids kept). */
      seed(input: readonly MoodCheckinRow[]): void {
        transaction(() => {
          for (const r of input) rows.insert({ ...r })
        })
      },

      get(id: number): MoodCheckinRow | undefined {
        return rows.get(id)
      },

      /** Check-ins per mood in a window, optionally for one pupil; every mood is listed (0 kept). */
      countByMood(window?: DateWindow, userId?: number): Record<Mood, number> {
        const out: Record<Mood, number> = { happy: 0, okay: 0, sad: 0, stressed: 0 }
        const where = userId === undefined ? {} : { userId }
        for (const row of rows.query({ where, match: (r) => inWindow(r, window) }).rows) {
          out[row.mood]++
        }
        return out
      },

      /** Total check-ins in a window (Q-M17-MOOD summed over the moods). */
      total(window?: DateWindow, userId?: number): number {
        const where = userId === undefined ? {} : { userId }
        return rows.count(where, (r) => inWindow(r, window))
      },

      /** One pupil's check-ins in a window, oldest first (S7 "Trend Mood (30 Hari)"). */
      forUser(userId: number, window?: DateWindow): MoodCheckinRow[] {
        return rows
          .query({
            where: { userId },
            match: (r) => inWindow(r, window),
            sort: [{ field: 'date' }, { field: 'id' }],
          })
          .rows.map((r) => ({ ...r }))
      },

      /** The pupil's latest check-in (S6 "Mood" column), or `undefined`. */
      latestForUser(userId: number): MoodCheckinRow | undefined {
        const [row] = rows.query({
          where: { userId },
          sort: [
            { field: 'date', dir: 'desc' },
            { field: 'id', dir: 'desc' },
          ],
          page: 1,
          pageSize: 1,
        }).rows
        return row === undefined ? undefined : { ...row }
      },

      /** Runtime check-in (the `seedMoodCheckin` test hook, M17-T1). */
      add(input: Omit<MoodCheckinRow, 'id'>): MoodCheckinRow {
        return transaction(() => rows.insert({ ...input }))
      },
    }),
  })
}

export const moodCheckinsRepo = defineMoodCheckinsRepo(moodCheckinsTable)

export type MoodCheckinsRepository = typeof moodCheckinsRepo
