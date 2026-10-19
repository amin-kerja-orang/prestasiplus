/**
 * The `fosterApplications` repository, owner **M21** (SRS M21 v1.2 DATA-M21-03, §6.8). Runtime ids
 * from 4 (the seed rows 1-3 are loaded by M21-T3 once XR-M21-01 is applied in M02).
 *
 * Named queries: Q-M21-APP-TABS (count by status). Their seed values (3 / 0 / 0 / 0) are not
 * asserted here: the seed rows are deferred to M21-T3.
 */

import { defineNamedQueries } from '@/mock/dataset'
import { defineRepository } from '@/mock/repository'

import {
  APPLICATION_STATUSES,
  type ApplicationCategory,
  type ApplicationStatus,
  type FamilyIncomeRange,
} from '../../api/types'
import { fosterApplicationsTable } from '../tables/tables'
import { nowIso } from './clock'
import type { FosterApplicationRow } from './types'

/** SEC-M21-07: a reason is stored up to 5,000 characters. */
export const REASON_MAX = 5000

export interface SubmitApplicationInput {
  studentId: number
  applicantUserId: number
  applicantRole: string
  studentCategory: ApplicationCategory
  familyIncomeRange: FamilyIncomeRange | null
  reason: string
}

export const fosterApplicationsRepo = defineRepository({
  owner: 'M21',
  name: 'fosterApplications',
  store: fosterApplicationsTable,
  queries: defineNamedQueries(fosterApplicationsTable, {
    'Q-M21-APP-TABS': {
      where: (status?: ApplicationStatus) => (status === undefined ? {} : { status }),
      source: 'M21 §6.8 Q-M21-APP-TABS',
    },
  }),
  methods: ({ store, transaction }) => ({
    /** Seed phase (M21-T3): rows with their ids kept. */
    seed(input: readonly FosterApplicationRow[]): void {
      transaction(() => {
        for (const r of input) store.insert({ ...r })
      })
    },

    get(id: number): FosterApplicationRow | undefined {
      const row = store.get(id)
      return row ? { ...row } : undefined
    },

    /** Applications in id descending order, optionally of one status (Q-M21-APP-LIST). */
    list(status?: ApplicationStatus): FosterApplicationRow[] {
      return store
        .query({ ...(status === undefined ? {} : { where: { status } }) })
        .rows.map((r) => ({ ...r }))
        .sort((a, b) => b.id - a.id)
    },

    /** The S5 tab counts (Q-M21-APP-TABS), zero-filled. */
    tabs(): Record<ApplicationStatus, number> {
      const by = store.groupCount('status')
      const out = {} as Record<ApplicationStatus, number>
      for (const s of APPLICATION_STATUSES) out[s] = by.get(s) ?? 0
      return out
    },

    /** BR-M21-13: a new `pending` application; `createdAt` = now; no duplicate check. */
    submit(input: SubmitApplicationInput): FosterApplicationRow {
      return transaction(() =>
        store.insert({
          studentId: input.studentId,
          applicantUserId: input.applicantUserId,
          applicantRole: input.applicantRole,
          studentCategory: input.studentCategory,
          familyIncomeRange: input.familyIncomeRange,
          reason: input.reason.slice(0, REASON_MAX),
          status: 'pending',
          createdAt: nowIso(),
        }),
      )
    },
  }),
})

export type FosterApplicationsRepository = typeof fosterApplicationsRepo
