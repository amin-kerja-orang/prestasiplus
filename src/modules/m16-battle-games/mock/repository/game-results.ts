/**
 * The `gameResults` repository (owner M16; SRS M16 v1.6 DATA-M16-08, §7.2): the stored single-player
 * results. M16-T1 seeds the 47 submitted results of the M17 totals (§6.11.1) and offers the reads of
 * the contract; the play flow (sessions, submit, personal bests) is M16-T2.
 */

import { defineNamedQueries } from '@/mock/dataset'
import { defineRepository } from '@/mock/repository'

import { gameSessionsTable } from '../tables/tables'
import type { GameSessionRow } from '../types'

export const gameResultQueries = defineNamedQueries(gameSessionsTable, {
  'Q-GAME-SUBMITTED': {
    where: { submittedAtMs: { gte: 0 } },
    expected: 47,
    source: 'M16 §6.10 (M17 "Permainan", 47 seeded results)',
  },
})

export const gameResultsRepo = defineRepository({
  owner: 'M16',
  name: 'gameResults',
  store: gameSessionsTable,
  queries: gameResultQueries,
  methods: ({ store, transaction }) => ({
    /** Seed phase: the submitted results. */
    seed(rows: readonly GameSessionRow[]): void {
      transaction(() => {
        for (const r of rows) store.insert({ ...r })
      })
    },

    /**
     * XR-M16-05 (M11 port): submitted results of each user in `[from, to)`. Only ids in `userIds`
     * appear. (M16-T2 adds finished rooms and Jutawan games.)
     */
    countFor(
      userIds: readonly number[],
      range: { from: number; to: number },
    ): Map<number, { count: number }> {
      const wanted = new Set(userIds)
      const out = new Map<number, { count: number }>()
      for (const r of store.query({}).rows) {
        if (r.submittedAtMs === null || r.submittedAtMs < range.from || r.submittedAtMs >= range.to)
          continue
        if (!wanted.has(r.userId)) continue
        const e = out.get(r.userId) ?? { count: 0 }
        e.count += 1
        out.set(r.userId, e)
      }
      return out
    },
  }),
})
