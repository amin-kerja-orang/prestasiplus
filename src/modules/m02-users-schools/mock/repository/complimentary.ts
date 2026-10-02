/**
 * The complimentary-student profile store (owner M02; SRS v1.28 §6.8 DATA-M02-09, BR-18, BR-19): the
 * `users.complimentaryProfiles` table (one row per complimentary student, `id` = the user id) and the
 * `complimentary` repository.
 *
 * The user row itself (name, e-mail = username, school, grade, `isActive`, `isComplimentary`) belongs
 * to M01 / the users store. The class, teacher and enrolment status are **read** from the M10
 * enrolments (D12), never copied; the balances from the M14 wallet. This table keeps only what has no
 * other owner: `coinsEnabled`, `packageExpiresAt` and `originalSchoolName`.
 *
 * `complimentary.coinsEnabled(userId)` is the seam M14 reads (`Reflect.get(m02, 'complimentary')`,
 * XR raised by M14): a complimentary student with no profile is coins OFF, everyone else ON.
 */

import { defineTable, maxPlusOne } from '@/mock/define'
import { defineRepository } from '@/mock/repository'
import { users } from '@/modules/m01-authentication/mock'

export interface ComplimentaryProfileRow {
  /** = the user id (also the S6 / S8 `:id`). */
  id: number
  /** Default false (BR-18); toggled by #19 / #20. */
  coinsEnabled: boolean
  /** `YYYY-MM-DD` (S7 "Tarikh tamat pakej"). */
  packageExpiresAt: string
  /** S8 "Sekolah asal". */
  originalSchoolName: string | null
}

export const complimentaryProfilesTable = defineTable<ComplimentaryProfileRow>({
  name: 'users.complimentaryProfiles',
  ids: maxPlusOne(),
})

/** Used when a complimentary user has no profile row (INFERRED: package ended on the clock anchor's year end). */
export const DEFAULT_PACKAGE_EXPIRES_AT = '2026-12-31'

/** S8 "Baki syiling / coins": read-only here, owned by M14 (DATA-M02-09). */
export interface CompWallet {
  syiling: number
  coins: number
}

export type CompWalletSource = (userId: number) => CompWallet

const NO_WALLET: CompWalletSource = () => ({ syiling: 0, coins: 0 })

let walletSource: CompWalletSource = NO_WALLET

/**
 * Seam to the M14 wallet (M02 must not import M14: M14 imports M02). M14 may register
 * `(userId) => ({syiling, coins})` once; until then a complimentary student shows 0 / 0, which is what
 * coins OFF (BR-18: nothing can be collected) yields. `null` restores the default.
 */
export function setCompWalletSource(next: CompWalletSource | null): void {
  walletSource = next ?? NO_WALLET
}

/**
 * BR-18 (INFERRED mapping): "full package until packageExpiresAt" is written to the user as the
 * `personal` package expiring at 23:59:59 MYT of that date (the users contract has no "full" code;
 * M05 `isSubscribed` reads the expiry).
 */
export const COMP_PACKAGE = 'personal' as const
export const compExpiresAt = (date: string): string => `${date}T23:59:59+08:00`

/**
 * Test-only override `comp` (SRS §12 E2E-M02-38, `mock.reset({comp: n})`): only the first `n` of the 90
 * seeded complimentary students stay part of S6–S8; the others are "deleted" from M02's view (the users
 * dataset is M01's, so its anchors stay). Module-level state, set by every seed.
 */
let hiddenComp: ReadonlySet<number> = new Set()

export function setHiddenComp(ids: Iterable<number>): void {
  hiddenComp = new Set(ids)
}

/** Whether M02 treats the user as removed by the `comp` override. */
export const isHiddenComp = (userId: number): boolean => hiddenComp.has(userId)

export const complimentaryRepo = defineRepository({
  owner: 'M02',
  name: 'complimentary',
  store: complimentaryProfilesTable,
  methods: ({ store, transaction }) => ({
    /** Seed phase: rows with their fixed ids (= user ids). */
    seedRows(rows: readonly ComplimentaryProfileRow[]): void {
      transaction(() => {
        for (const r of rows) store.insert({ ...r })
      })
    },

    get(userId: number): ComplimentaryProfileRow | undefined {
      return store.get(userId)
    },

    /** Every profile, by user id. */
    all(): ComplimentaryProfileRow[] {
      return store.query({ sort: 'id' }).rows
    },

    /**
     * M14 seam (BR-18): whether the student may collect syiling / coins. A complimentary student with no
     * profile is OFF; any other user is ON.
     */
    coinsEnabled(userId: number): boolean {
      const profile = store.get(userId)
      if (profile) return profile.coinsEnabled
      return users.get(userId)?.isComplimentary !== true
    },

    /** S7: the profile of a new complimentary student (coins OFF, BR-18). */
    create(
      userId: number,
      input: { packageExpiresAt: string; originalSchoolName: string | null },
    ): ComplimentaryProfileRow {
      return transaction(() =>
        store.insert({
          id: userId,
          coinsEnabled: false,
          packageExpiresAt: input.packageExpiresAt,
          originalSchoolName: input.originalSchoolName,
        }),
      )
    },

    /** #19 / #20: the profile row of `userId` (created with the defaults when missing). */
    setCoins(userId: number, coinsEnabled: boolean): ComplimentaryProfileRow {
      return transaction(() => {
        const current = store.get(userId)
        if (current) return store.update(userId, { coinsEnabled })
        return store.insert({
          id: userId,
          coinsEnabled,
          packageExpiresAt: DEFAULT_PACKAGE_EXPIRES_AT,
          originalSchoolName: null,
        })
      })
    },

    /** The M14 balances of the student (0 / 0 until M14 registers its source). */
    wallet(userId: number): CompWallet {
      return walletSource(userId)
    },

    /** A deleted user's profile goes with it. */
    remove(userId: number): void {
      transaction(() => {
        if (store.get(userId)) store.remove(userId)
      })
    },
  }),
})

export type ComplimentaryRepository = typeof complimentaryRepo
