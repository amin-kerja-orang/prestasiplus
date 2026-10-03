/**
 * The `anakAngkat` repository, owner **M21** (SRS M21 v1.2 DATA-M21-02, §6.8). Runtime ids from 3
 * (the seed record 2 is loaded by M21-T3 once XR-M21-01 is applied in M02). The assign / close
 * methods belong to the admin handlers (M21-T3).
 *
 * Named queries: Q-M21-AA-TABS (count by status). Their seed values (1 / 1 / 0 / 0 / 0) are not
 * asserted here: the seed record is deferred to M21-T3.
 */

import { defineNamedQueries } from '@/mock/dataset'
import { defineRepository } from '@/mock/repository'

import { ANAK_ANGKAT_STATUSES, type AnakAngkatStatus } from '../../api/types'
import { anakAngkatTable } from '../tables/tables'
import type { AnakAngkatRow } from './types'

export const anakAngkatRepo = defineRepository({
  owner: 'M21',
  name: 'anakAngkat',
  store: anakAngkatTable,
  queries: defineNamedQueries(anakAngkatTable, {
    'Q-M21-AA-TABS': {
      where: (status?: AnakAngkatStatus) => (status === undefined ? {} : { status }),
      source: 'M21 §6.8 Q-M21-AA-TABS',
    },
  }),
  methods: ({ store, transaction }) => ({
    /** Seed phase (M21-T3): rows with their ids kept. */
    seed(input: readonly AnakAngkatRow[]): void {
      transaction(() => {
        for (const r of input) store.insert({ ...r })
      })
    },

    get(id: number): AnakAngkatRow | undefined {
      const row = store.get(id)
      return row ? { ...row } : undefined
    },

    /** Records in id descending order, optionally of one status (Q-M21-AA-LIST). */
    list(status?: AnakAngkatStatus): AnakAngkatRow[] {
      return store
        .query({ ...(status === undefined ? {} : { where: { status } }) })
        .rows.map((r) => ({ ...r }))
        .sort((a, b) => b.id - a.id)
    },

    /** The S4 tab counts (Q-M21-AA-TABS): `all` = every record, then one per status (BR-M21-09). */
    tabs(): Record<'all' | AnakAngkatStatus, number> {
      const by = store.groupCount('status')
      const out = { all: store.count() } as Record<'all' | AnakAngkatStatus, number>
      for (const s of ANAK_ANGKAT_STATUSES) out[s] = by.get(s) ?? 0
      return out
    },
  }),
})

export type AnakAngkatRepository = typeof anakAngkatRepo
