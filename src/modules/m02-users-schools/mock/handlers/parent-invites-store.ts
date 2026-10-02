/**
 * The `users.parentInvites` table and the `parentInvites` repository (owner M02; L45 DATA-L45-01,
 * XR-L45-01): one current invite token per student (BR-L45-01).
 *
 * The row id IS the student id (the primary key of DATA-L45-01 is `studentId`; the store needs an `id`
 * field). The id is never allocated: every insert gives it explicitly. No seed rows (SRS §6.4).
 *
 * Token format (BR-L45-02): 64 lowercase hex characters. Random (`crypto.getRandomValues`) outside the
 * e2e build; deterministic in e2e (`sessionTokenSource() === 'deterministic'`, same switch as M01
 * password-reset tokens): the next token is `n` as 64 hex digits, where `n` = 1 + the highest
 * deterministic token held now. The counter is derived from the table, so it survives a page reload and
 * is reset by `mock.reset()` (the table is emptied). Matching is case-insensitive: tokens are stored
 * and looked up in lower case.
 */

import { toIsoMyt } from '@/lib/time'
import { sessionTokenSource } from '@/mock/auth/sessions'
import { defineTable, ID_RANGES, sequence } from '@/mock/define'
import { defineRepository } from '@/mock/repository'

export interface ParentInviteRow {
  /** The student id (primary key; DATA-L45-01 `studentId`). */
  id: number
  /** 64 lowercase hex characters (a hook may set any non-empty string, lower-cased). */
  token: string
  /** ISO 8601 (+08:00), mock clock. */
  createdAt: string
}

export const parentInvitesTable = defineTable<ParentInviteRow>({
  name: 'users.parentInvites',
  ids: sequence({ runtimeStart: ID_RANGES.sequenceRuntimeStart }),
  indexes: ['token'],
})

const TOKEN_BYTES = 32
const DETERMINISTIC_RE = /^[0-9a-f]{64}$/

/** 32 random bytes as 64 lowercase hex characters. */
export function randomInviteToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** The n-th deterministic e2e token: `n` as 64 hex digits, zero-padded. */
export function deterministicInviteToken(n: number | bigint): string {
  return n.toString(16).padStart(64, '0')
}

export const parentInvitesRepo = defineRepository({
  owner: 'M02',
  name: 'parentInvites',
  store: parentInvitesTable,
  methods: ({ store, transaction }) => {
    /** A token no row holds yet. */
    const freshToken = (): string => {
      if (sessionTokenSource() === 'random') {
        let token = randomInviteToken()
        while (store.query({ where: { token } }).rows.length > 0) token = randomInviteToken()
        return token
      }
      // BigInt: a hook-set token of 64 `f` must not overflow into a 65-digit token.
      const max = 16n ** 64n - 1n
      let n = 1n
      for (const row of store.query({}).rows) {
        if (DETERMINISTIC_RE.test(row.token)) {
          const next = BigInt(`0x${row.token}`) + 1n
          if (next > n) n = next
        }
      }
      if (n > max) n = 1n // every number is taken above: start over, the loop below skips held tokens
      let token = deterministicInviteToken(n)
      while (store.query({ where: { token } }).rows.length > 0) {
        n = n >= max ? 1n : n + 1n
        token = deterministicInviteToken(n)
      }
      return token
    }

    return {
      /** The invite of `studentId`, or `undefined` (never viewed). */
      get(studentId: number): ParentInviteRow | undefined {
        return store.get(studentId)
      },

      /** BR-L45-01 / FR-L45-13: the student's current invite, created on first call. */
      getOrCreate(studentId: number, now: number): ParentInviteRow {
        return transaction(() => {
          const row = store.get(studentId)
          if (row) return row
          return store.insert({ id: studentId, token: freshToken(), createdAt: toIsoMyt(now) })
        })
      },

      /** BR-L45-03: replaces the token; the old one is unknown at once. */
      rotate(studentId: number, now: number): ParentInviteRow {
        return transaction(() => {
          const token = freshToken()
          const createdAt = toIsoMyt(now)
          const row = store.get(studentId)
          return row
            ? store.update(studentId, { token, createdAt })
            : store.insert({ id: studentId, token, createdAt })
        })
      },

      /** The invite holding `token` (case-insensitive), or `undefined`. Does not check the student. */
      resolve(token: string): ParentInviteRow | undefined {
        if (token === '') return undefined
        return store.query({ where: { token: token.toLowerCase() } }).rows[0]
      },

      /** Test hook: fixes `studentId`'s token. Throws when another student already holds it. */
      setToken(studentId: number, token: string, now: number): ParentInviteRow {
        const key = token.toLowerCase()
        return transaction(() => {
          const holder = store.query({ where: { token: key } }).rows[0]
          if (holder && holder.id !== studentId) {
            throw new RangeError(`setParentInviteToken: token already belongs to ${holder.id}`)
          }
          const createdAt = toIsoMyt(now)
          return store.get(studentId)
            ? store.update(studentId, { token: key, createdAt })
            : store.insert({ id: studentId, token: key, createdAt })
        })
      },

      /** XR-L45-01(c): a hard-deleted student takes its invite with it. */
      removeForUser(studentId: number): boolean {
        return transaction(() => {
          if (!store.get(studentId)) return false
          store.remove(studentId)
          return true
        })
      },
    }
  },
})

export type ParentInvitesRepository = typeof parentInvitesRepo
