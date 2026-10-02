/**
 * The `users.schoolAdminPackages` table and the `schoolAdminPackages` repository (owner M02;
 * DATA-M02-08, BR-13, S16). One row per school admin and form level (`t4` / `t5`); assigning again
 * replaces the quota. Independent of `SchoolSubscription` (URS OQ-8). Seed row 1 keeps its fixed id
 * (school admin 5601, T4, quota 150); runtime rows take ids from 1000.
 *
 * `SCHOOL_ADMIN_PACKAGES` are the two S16 cards; they are the `SchoolPackage` rows 1 (T4) and 2 (T5) of
 * BR-22 (price RM30.00 per student per year, term years = `maxRenewals + 1`).
 */

import { toIsoMyt } from '@/lib/time'
import { defineTable, ID_RANGES, sequence } from '@/mock/define'
import { defineRepository } from '@/mock/repository'

import type { FormLevel, SchoolAdminPackage } from '../../api/users'

export type SchoolAdminPackageRow = SchoolAdminPackage

export const schoolAdminPackagesTable = defineTable<SchoolAdminPackageRow>({
  name: 'users.schoolAdminPackages',
  ids: sequence({ runtimeStart: ID_RANGES.sequenceRuntimeStart }),
  indexes: ['userId'],
})

/** The two SPM packages an S16 card can assign (BR-22: 1 T4 `maxRenewals` 1; 2 T5 `maxRenewals` 0). */
export const SCHOOL_ADMIN_PACKAGES: readonly {
  formLevel: FormLevel
  packageId: number
  code: string
  name: string
  years: number
}[] = Object.freeze([
  { formLevel: 't4', packageId: 1, code: 'T4', name: 'Pakej SPM Tingkatan 4', years: 2 },
  { formLevel: 't5', packageId: 2, code: 'T5', name: 'Pakej SPM Tingkatan 5', years: 1 },
])

/** DV-M02-07: the quota limits (live allowed 5000). */
export const PACKAGE_QUOTA_MIN = 1
export const PACKAGE_QUOTA_MAX = 2000

export const schoolAdminPackagesRepo = defineRepository({
  owner: 'M02',
  name: 'schoolAdminPackages',
  store: schoolAdminPackagesTable,
  methods: ({ store, transaction }) => ({
    /** Seed phase: rows with their fixed ids. */
    seedRows(rows: readonly SchoolAdminPackageRow[]): void {
      transaction(() => {
        for (const r of rows) store.insert({ ...r })
      })
    },

    /** The packages assigned to a school admin (0–2 rows). */
    forUser(userId: number): SchoolAdminPackageRow[] {
      return store.query({ where: { userId }, sort: 'id' }).rows
    },

    /** BR-13: creates the row of (`userId`, `formLevel`) or replaces its quota; `assignedAt` = now. */
    assign(
      userId: number,
      input: { formLevel: FormLevel; packageId: number; studentQuota: number },
      now: number,
    ): SchoolAdminPackageRow {
      return transaction(() => {
        const at = toIsoMyt(now)
        const current = store.query({ where: { userId, formLevel: input.formLevel } }).rows[0]
        if (current) {
          return store.update(current.id, {
            packageId: input.packageId,
            studentQuota: input.studentQuota,
            assignedAt: at,
          })
        }
        return store.insert({ userId, ...input, assignedAt: at })
      })
    },

    /** A deleted school admin's packages go with it. Returns how many. */
    removeForUser(userId: number): number {
      return transaction(() => {
        const rows = store.query({ where: { userId } }).rows
        for (const row of rows) store.remove(row.id)
        return rows.length
      })
    },
  }),
})

export type SchoolAdminPackagesRepository = typeof schoolAdminPackagesRepo
