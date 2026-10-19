/**
 * The M02 billing stores (owner M02; SRS v1.28 §6.5 DATA-M02-06 `SchoolPackage`, §6.6 DATA-M02-07
 * `SchoolSubscription`; BR-22…BR-31): the `schools.packages` and `schools.subscriptions` tables and
 * the `schoolPackages` / `schoolSubscriptions` repositories.
 *
 * - The 4 packages and the 14 observed subscriptions are seeded with their live ids (§6.14); runtime
 *   subscriptions take ids from 1000 (`sequence`, overview §6.5).
 * - `used` is never stored: it is computed from the users store by the handlers (BR-24).
 * - `schoolSubscriptions.countByStatus()` and `activeByPackage()` are the M19 contract of v1.22
 *   (XR-M19-01): counts by status and the active rows per package.
 * - `quotaRows(schoolId)` is what the T2 quota seam (`setSubscriptionSource`, XR-M02-T2-01) reads.
 */

import { toIsoMyt } from '@/lib/time'
import { defineTable, ID_RANGES, maxPlusOne, sequence } from '@/mock/define'
import { defineRepository } from '@/mock/repository'

import type {
  PackageTier,
  SchoolFormLevel,
  SchoolPackage,
  SubscriptionStatus,
} from '../../api/subscriptions'
import type { QuotaSubscription } from '../quota'

export type SchoolPackageRow = SchoolPackage

/** DATA-M02-07 as stored (no `used`, no joined school / package). */
export interface SchoolSubscriptionRow {
  id: number
  schoolId: number
  schoolPackageId: number
  packageTier: PackageTier
  studentQuota: number
  status: SubscriptionStatus
  startsAt: string
  endsAt: string
  questionLimit: number | null
  paymentReference: string | null
  paymentNotes: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export const schoolPackagesTable = defineTable<SchoolPackageRow>({
  name: 'schools.packages',
  ids: maxPlusOne(),
})

export const schoolSubscriptionsTable = defineTable<SchoolSubscriptionRow>({
  name: 'schools.subscriptions',
  ids: sequence({ runtimeStart: ID_RANGES.sequenceRuntimeStart }),
  indexes: ['schoolId', 'status'],
})

/** BR-22 / DV-M02-08: the question limit of a `basic` (Pemantauan) subscription. */
export const BASIC_QUESTION_LIMIT = 500

/** BR-31: the term of a new subscription, in calendar months (`basic` 1 month, `full` 1 year). */
export const TERM_MONTHS: Readonly<Record<PackageTier, number>> = { basic: 1, full: 12 }

const MYT_OFFSET_MS = 8 * 3_600_000

/**
 * `from` (epoch ms) + `months` calendar months at the same MYT wall-clock time; the last day of the
 * month when the target month is shorter (as M02 BR-12 `computeExpiry`).
 */
export function addMonthsMyt(from: number, months: number): number {
  const wall = new Date(from + MYT_OFFSET_MS)
  const y = wall.getUTCFullYear()
  const m = wall.getUTCMonth() + months
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  const day = Math.min(wall.getUTCDate(), lastDay)
  return (
    Date.UTC(
      y,
      m,
      day,
      wall.getUTCHours(),
      wall.getUTCMinutes(),
      wall.getUTCSeconds(),
      wall.getUTCMilliseconds(),
    ) - MYT_OFFSET_MS
  )
}

export const schoolPackagesRepo = defineRepository({
  owner: 'M02',
  name: 'schoolPackages',
  store: schoolPackagesTable,
  methods: ({ store, transaction }) => ({
    /** Seed phase: rows with their fixed ids. */
    seedRows(rows: readonly SchoolPackageRow[]): void {
      transaction(() => {
        for (const r of rows) store.insert({ ...r })
      })
    },

    /** Every package by id (S13 cards, #30). */
    all(): SchoolPackageRow[] {
      return store.query({ sort: 'id' }).rows
    },

    get(id: number): SchoolPackageRow | undefined {
      return store.get(id)
    },

    /** The package of a form level (`t5` → 2). */
    byFormLevel(formLevel: SchoolFormLevel): SchoolPackageRow | undefined {
      return store.query({ where: { formLevel } }).rows[0]
    },
  }),
})

export interface NewSubscription {
  schoolId: number
  schoolPackageId: number
  packageTier: PackageTier
  studentQuota: number
  paymentReference: string | null
  paymentNotes: string | null
}

export const schoolSubscriptionsRepo = defineRepository({
  owner: 'M02',
  name: 'schoolSubscriptions',
  store: schoolSubscriptionsTable,
  stores: { packages: schoolPackagesTable },
  methods: ({ store, stores, transaction }) => ({
    /** Seed phase: the observed rows with their fixed ids. */
    seedRows(rows: readonly SchoolSubscriptionRow[]): void {
      transaction(() => {
        for (const r of rows) store.insert({ ...r })
      })
    },

    get(id: number): SchoolSubscriptionRow | undefined {
      return store.get(id)
    },

    /** Every subscription, newest first (id descending; FR-M02-83 INFERRED order). */
    all(): SchoolSubscriptionRow[] {
      return store.query({ sort: [{ field: 'id', dir: 'desc' }] }).rows
    },

    forSchool(schoolId: number): SchoolSubscriptionRow[] {
      return store.query({ where: { schoolId }, sort: 'id' }).rows
    },

    /** BR-31: a new `active` subscription starting `now`. */
    create(input: NewSubscription, now: number): SchoolSubscriptionRow {
      const at = toIsoMyt(now)
      return transaction(() =>
        store.insert({
          schoolId: input.schoolId,
          schoolPackageId: input.schoolPackageId,
          packageTier: input.packageTier,
          studentQuota: input.studentQuota,
          status: 'active',
          startsAt: at,
          endsAt: toIsoMyt(addMonthsMyt(now, TERM_MONTHS[input.packageTier])),
          questionLimit: input.packageTier === 'basic' ? BASIC_QUESTION_LIMIT : null,
          paymentReference: input.paymentReference,
          paymentNotes: input.paymentNotes,
          notes: null,
          createdAt: at,
          updatedAt: at,
        }),
      )
    },

    /** Writes the changed fields; `updatedAt` = now. */
    update(
      id: number,
      patch: Partial<Omit<SchoolSubscriptionRow, 'id' | 'createdAt' | 'updatedAt'>>,
      now: number,
    ): SchoolSubscriptionRow {
      if (!store.get(id))
        throw new Error(`schoolSubscriptions.update: no subscription ${String(id)}`)
      return transaction(() => store.update(id, { ...patch, updatedAt: toIsoMyt(now) }))
    },

    /** M19 Q-M19-SCH-ACTIVE / GRACE (XR-M19-01): the stored rows per status (seed: 9 · 0 · 1 · 4). */
    countByStatus(): Record<SubscriptionStatus, number> {
      const n = (status: SubscriptionStatus) => store.count({ status })
      return {
        active: n('active'),
        grace: n('grace'),
        expired: n('expired'),
        cancelled: n('cancelled'),
      }
    },

    /** M19 Q-M19-SCH-BY-PACKAGE: packages with at least one `active` row, by package id. */
    activeByPackage(): { packageId: number; name: string; count: number }[] {
      const counts = new Map<number, number>()
      for (const row of store.query({ where: { status: 'active' } }).rows) {
        counts.set(row.schoolPackageId, (counts.get(row.schoolPackageId) ?? 0) + 1)
      }
      return [...counts.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([packageId, count]) => ({
          packageId,
          name: stores.packages.get(packageId)?.name ?? '',
          count,
        }))
    },

    /** The rows the T2 quota rules read (XR-M02-T2-01): `{id, schoolId, status, studentQuota, startsAt}`. */
    quotaRows(schoolId: number): QuotaSubscription[] {
      return store.query({ where: { schoolId }, sort: 'id' }).rows.map((r) => ({
        id: r.id,
        schoolId: r.schoolId,
        status: r.status,
        studentQuota: r.studentQuota,
        startsAt: r.startsAt,
      }))
    },
  }),
})

export type SchoolSubscriptionsRepository = typeof schoolSubscriptionsRepo
