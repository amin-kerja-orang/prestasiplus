/**
 * The `alesaPredictions` repository (owner **M12**; SRS M12 v1.6 §6.4 DATA-M12-04, BR-M12-22): the per-scope
 * stored ALESA lists (platform 50 rows, school 8080 50 rows; observed). Rows are kept in observed order. A row
 * names its student by `rank` + `schoolId` (resolved in `models/alesa.ts`); any other school's list is generated
 * on read from its active students, never stored.
 */

import { defineRepository } from '@/mock/repository'

import type { AlesaSeedRow } from '../data/alesa'
import { alesaTable } from '../tables/tables'
import type { AlesaStoredRow } from '../types'

export const alesaRepo = defineRepository({
  owner: 'M12',
  name: 'alesaPredictions',
  store: alesaTable,
  methods: ({ store, transaction }) => ({
    /** Seed: one observed list of a scope. */
    seed(scope: 'platform' | number, rows: readonly AlesaSeedRow[]): void {
      transaction(() => {
        rows.forEach(([rank, schoolId, grade, confidence, cadanganBand], seq) => {
          store.insert({
            scope,
            seq,
            rank,
            schoolId,
            grade,
            confidence,
            cadanganBand,
            observed: true,
          })
        })
      })
    },

    /** The stored list of a scope in observed order; empty when the scope has no stored list. */
    stored(scope: 'platform' | number): AlesaStoredRow[] {
      return store.query({ where: { scope }, sort: [{ field: 'seq' }] }).rows
    },
  }),
})
