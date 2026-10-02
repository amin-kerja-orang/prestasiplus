/**
 * The `tuitionCentres` repository: PROVISIONAL, owner **M26** (not specified yet), hosted by M17
 * (F-33, overview §6.7.2, XL3-23). Serves Q-M17-TUITION (M17 §6.4): 2 centres (18, 0 active pupils).
 * Other modules read it only through the M17 public entry (D12). The definition is a function of the
 * store and the `provisional` flag, so the owner's build task moves it unchanged.
 */

import { defineNamedQueries } from '@/mock/dataset'
import type { Table } from '@/mock/define'
import { defineRepository } from '@/mock/repository'

import { tuitionCentresTable } from '../tables/provisional-tables'
import type { ProvisionalOptions } from './provisional-options'
import type { TuitionCentreRow } from './provisional-types'

export function defineTuitionCentresRepo(
  store: Table<TuitionCentreRow>,
  options: ProvisionalOptions = {},
) {
  return defineRepository({
    owner: 'M26',
    provisional: options.provisional ?? true,
    ...(options.registry === undefined ? {} : { registry: options.registry }),
    name: 'tuitionCentres',
    store,
    queries: defineNamedQueries(store, {
      'Q-M17-TUITION': { expected: 2, source: 'M17 §6.4, XR-M17-17' },
    }),
    methods: ({ store: rows, transaction }) => ({
      /** Seed phase: the observed centres (ids kept). */
      seed(input: readonly TuitionCentreRow[]): void {
        transaction(() => {
          for (const r of input) rows.insert({ ...r })
        })
      },

      get(id: number): TuitionCentreRow | undefined {
        return rows.get(id)
      },

      /** Every centre in id order (S8: name, "{city}, {state}", "{n} pelajar aktif"). */
      list(): TuitionCentreRow[] {
        return rows.query({}).rows.map((r) => ({ ...r }))
      },
    }),
  })
}

export const tuitionCentresRepo = defineTuitionCentresRepo(tuitionCentresTable)

export type TuitionCentresRepository = typeof tuitionCentresRepo
