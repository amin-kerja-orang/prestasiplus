/**
 * The M07 repositories (D12): `pkskDomains` (DATA-M07-01, read-only), `pkskAccess` (DATA-M07-04),
 * `pkskProgress` (exam attempts DATA-M07-05, mastery DATA-M07-06, practice loads) and the
 * PROVISIONAL `pkskPackages` (DATA-M07-03; true owner M19, hosted here with the SRS fixture).
 * Practice sessions are not here: M05 owns them (BR-M07-26). T1a = the student side; the admin
 * methods (grant, revoke, lists, stats) belong to T1b.
 */

import { defineRepository } from '@/mock/repository'
import { users } from '@/modules/m01-authentication/mock'

import {
  accessTable,
  attemptsTable,
  domainsTable,
  masteryTable,
  packagesTable,
  practiceLoadsTable,
} from '../tables/tables'
import { displayStatusOf, gradeOf, LEVELS } from './rules'
import type {
  Bahagian,
  Grade,
  PkskAccessRow,
  PkskDomain,
  PkskExamAttemptRow,
  PkskLevel,
  PkskMasteryRow,
  PkskPackage,
} from './types'

export const pkskDomainsRepo = defineRepository({
  name: 'pkskDomains',
  owner: 'M07',
  store: domainsTable,
  methods: ({ store, transaction }) => ({
    /** Seed phase: the 15 live domains (ids kept). */
    seed(rows: readonly PkskDomain[]): void {
      transaction(() => {
        for (const r of rows) store.insert({ ...r })
      })
    },
    /** All domains by `order` (BR-M07-20). */
    list(): PkskDomain[] {
      return store.query({ sort: [{ field: 'order', dir: 'asc' }] }).rows.map((r) => ({ ...r }))
    },
    get(id: number): PkskDomain | undefined {
      return store.get(id)
    },
    /** BR-M07-19: the 15 codes, case-sensitive. */
    byCode(code: string): PkskDomain | undefined {
      return store.query({ where: { code } }).rows[0]
    },
    /** Domains of one Bahagian by `order`. */
    ofBahagian(bahagian: Bahagian): PkskDomain[] {
      return store
        .query({ where: { bahagian }, sort: [{ field: 'order', dir: 'asc' }] })
        .rows.map((r) => ({ ...r }))
    },
  }),
})

export const pkskPackagesRepo = defineRepository({
  name: 'pkskPackages',
  owner: 'M19',
  provisional: true,
  store: packagesTable,
  methods: ({ store, transaction }) => ({
    seed(rows: readonly PkskPackage[]): void {
      transaction(() => {
        for (const r of rows) store.insert({ ...r })
      })
    },
    list(): PkskPackage[] {
      return store.query({ sort: [{ field: 'id', dir: 'asc' }] }).rows.map((r) => ({ ...r }))
    },
    get(id: number): PkskPackage | undefined {
      return store.get(id)
    },
  }),
})

export const pkskAccessRepo = defineRepository({
  name: 'pkskAccess',
  owner: 'M07',
  store: accessTable,
  methods: ({ store, transaction }) => {
    const levelsOf = (packageId: number): readonly PkskLevel[] => {
      const p = packagesTable.get(packageId)
      if (!p) return []
      return p.level === 'ALL' ? LEVELS : [p.level]
    }
    return {
      /** Seed phase and the provisional edge-case fixture: rows are inserted with their ids. */
      seed(rows: readonly PkskAccessRow[]): void {
        transaction(() => {
          for (const r of rows) store.insert({ ...r })
        })
      },
      forUser(userId: number): PkskAccessRow[] {
        return store.query({ where: { userId } }).rows.map((r) => ({ ...r }))
      },
      /**
       * BR-M07-07: level L is usable with (a) an active, unexpired grant for L or ALL, (b) the M02
       * `hasPkskSubscription` flag (both levels), or (c) the admin role (both levels).
       */
      levelAccess(userId: number, nowMs: number): Record<PkskLevel, boolean> {
        const out: Record<PkskLevel, boolean> = { T1: false, T4: false }
        const user = users.get(userId)
        if (user && (user.role === 'admin' || user.hasPkskSubscription))
          return { T1: true, T4: true }
        for (const g of store.query({ where: { userId } }).rows) {
          if (displayStatusOf(g, nowMs) !== 'active') continue
          for (const l of levelsOf(g.packageId)) out[l] = true
        }
        return out
      },
    }
  },
})

export const pkskProgressRepo = defineRepository({
  name: 'pkskProgress',
  owner: 'M07',
  store: attemptsTable,
  stores: { mastery: masteryTable, loads: practiceLoadsTable },
  methods: ({ store, stores, transaction }) => ({
    seedAttempts(rows: readonly PkskExamAttemptRow[]): void {
      transaction(() => {
        for (const r of rows) store.insert({ ...r })
      })
    },
    seedMastery(rows: readonly PkskMasteryRow[]): void {
      transaction(() => {
        for (const r of rows) stores.mastery.insert({ ...r })
      })
    },

    /** Completed attempts of the user at the level, newest first (FR-M07-14). */
    attempts(userId: number, level: PkskLevel): PkskExamAttemptRow[] {
      return store
        .query({
          where: { userId, level },
          sort: [
            { field: 'completedAt', dir: 'desc' },
            { field: 'id', dir: 'desc' },
          ],
        })
        .rows.map((r) => ({ ...r }))
    },

    addAttempt(input: {
      userId: number
      level: PkskLevel
      completedAt: string
      scorePct: number
      bahagianAPct: number
      bahagianBPct: number
      bahagianCPct: number
    }): PkskExamAttemptRow {
      const grade: Grade = gradeOf(input.scorePct)
      return transaction(() => store.insert({ ...input, grade }))
    },

    /** DATA-M07-06: the stored percentage, 0 when absent. */
    mastery(userId: number, level: PkskLevel, domainId: number): number {
      const row = stores.mastery.query({ where: { userId, level, domainId } }).rows[0]
      return row?.masteryPct ?? 0
    },

    /** BR-M07-12: sets the domain's mastery (one row per user, level and domain). */
    setMastery(userId: number, level: PkskLevel, domainId: number, masteryPct: number): void {
      transaction(() => {
        const row = stores.mastery.query({ where: { userId, level, domainId } }).rows[0]
        if (row) stores.mastery.update(row.id, { masteryPct })
        else stores.mastery.insert({ userId, level, domainId, masteryPct })
      })
    },

    /** Records the time a practice page was opened (BR-M07-26 (1) `timeSpent`, PROPOSED). */
    markLoaded(userId: number, level: PkskLevel, domainId: number, loadedAtMs: number): void {
      transaction(() => {
        const row = stores.loads.query({ where: { userId, level, domainId } }).rows[0]
        if (row) stores.loads.update(row.id, { loadedAtMs })
        else stores.loads.insert({ userId, level, domainId, loadedAtMs })
      })
    },

    /** The load time of the open practice page, consumed by the submission; `null` if none. */
    takeLoaded(userId: number, level: PkskLevel, domainId: number): number | null {
      return transaction(() => {
        const row = stores.loads.query({ where: { userId, level, domainId } }).rows[0]
        if (!row) return null
        stores.loads.remove(row.id)
        return row.loadedAtMs
      })
    },
  }),
})
