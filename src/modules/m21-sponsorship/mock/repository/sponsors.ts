/**
 * The `sponsors` repository, owner **M21** (SRS v1.2 DATA-M21-01). Taken over from M17's provisional
 * host (F-33, M21-T1, overview §6.7.2) with the definition unchanged; the M21 plugin registers it
 * with `provisional: false`. Serves Q-M17-SPONSORS (M17 §6.4): 6 · 0 active · 0 pending · 0 rejected
 * · 6 suspended. Other modules read it only through the M21 public entry (D12). "Active" is the M21
 * status `APPROVED`.
 *
 * The definition is a function of the store and the `provisional` flag (`defineSponsorsRepo(table,
 * { provisional: false })`).
 */

import { defineNamedQueries } from '@/mock/dataset'
import type { Table } from '@/mock/define'
import { defineRepository } from '@/mock/repository'

import { sponsorsTable } from '../tables/tables'
import type { ProvisionalOptions } from './options'
import type { SponsorRow, SponsorStatus, SponsorStatusCounts } from './types'

export function defineSponsorsRepo(store: Table<SponsorRow>, options: ProvisionalOptions = {}) {
  return defineRepository({
    owner: 'M21',
    provisional: options.provisional ?? true,
    ...(options.registry === undefined ? {} : { registry: options.registry }),
    name: 'sponsors',
    store,
    queries: defineNamedQueries(store, {
      'Q-M17-SPONSORS': {
        where: (status?: SponsorStatus) => (status === undefined ? {} : { status }),
        expected: [
          { args: [], value: 6 },
          { args: ['APPROVED'], value: 0 },
          { args: ['PENDING'], value: 0 },
          { args: ['REJECTED'], value: 0 },
          { args: ['SUSPENDED'], value: 6 },
        ],
        source: 'M17 §6.4, XR-M17-16; M21 §6.8 Q-M21-SPONSOR-STATS',
      },
    }),
    methods: ({ store: rows, transaction }) => ({
      /** Seed phase: the observed sponsors (ids kept). */
      seed(input: readonly SponsorRow[]): void {
        transaction(() => {
          for (const r of input) rows.insert({ ...r })
        })
      },

      /** Added by M21-T1 for the test fixtures (§6.13); the id is kept. */
      insertMany(input: readonly SponsorRow[]): void {
        transaction(() => {
          for (const r of input) rows.insert({ ...r })
        })
      },

      /** Added by M21-T1: a raw patch for the test fixtures (§6.13). The real transitions are M21-T3. */
      patch(id: number, patch: Partial<SponsorRow>): SponsorRow | undefined {
        return transaction(() => (rows.get(id) ? rows.update(id, patch) : undefined))
      },

      get(id: number): SponsorRow | undefined {
        return rows.get(id)
      },

      /** Every sponsor in id order. */
      list(): SponsorRow[] {
        return rows.query({}).rows.map((r) => ({ ...r }))
      },

      /** The S1 "Kad Penaja" figures. */
      statusCounts(): SponsorStatusCounts {
        const by = rows.groupCount('status')
        return {
          total: rows.count(),
          active: by.get('APPROVED') ?? 0,
          pending: by.get('PENDING') ?? 0,
          rejected: by.get('REJECTED') ?? 0,
          suspended: by.get('SUSPENDED') ?? 0,
        }
      },
    }),
  })
}

export const sponsorsRepo = defineSponsorsRepo(sponsorsTable, { provisional: false })

export type SponsorsRepository = typeof sponsorsRepo
