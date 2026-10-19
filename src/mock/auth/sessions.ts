/**
 * The auth `sessions` table and its repository (overview §7 "Session record"; M01 BR-06,
 * DATA-M01-02). Owner: the mock core (`'core'`). M01 handlers (login, register, reset, logout,
 * `expireSession`) create and end sessions only through this repository.
 *
 * Rules:
 * - A session is `{token, userId, remember, expiresAt, createdAt}`; the token (`pp_` + 40
 *   alphanumerics) is also the row id. Tokens come from `crypto.getRandomValues` in every mode
 *   except `e2e`, where the deterministic stream `core:session-tokens` is kept so test runs are
 *   reproducible (review F11-2).
 * - Without "Ingat saya": expires **120 min after the last authenticated request** (sliding; live
 *   `SESSION_LIFETIME=120`, BR-06). A request moves `expiresAt` to now + 120 min, but **at most once
 *   per minute** (`SLIDE_INTERVAL_MS`, review F11-3): a request less than a minute after the last
 *   slide writes nothing (no IndexedDB write, no cross-tab broadcast). The session therefore
 *   expires between 119 and 120 min after the last activity (1-minute tolerance).
 * - With "Ingat saya": expires **5 calendar years** after creation (DATA-M01-02) and does not slide.
 * - An expired token resolves to `null` and its row is removed.
 * - Times are epoch ms in the table; the API returns ISO 8601 (+08:00).
 *
 * Repository methods are synchronous and take `now` from the caller (handlers pass
 * `ctx.clock.now()`), so the rules are pure functions of the mock clock.
 */

import { fromMytParts, MINUTE_MS, mytParts } from '@/lib/time'

import { opaque } from '../db/id-strategies'
import { defineTable } from '../db/table'
import { defineRepository } from '../repository'

/** Non-remember lifetime after the last request (BR-06). */
export const SESSION_LIFETIME_MS = 120 * MINUTE_MS

/** A non-remember session slides at most once per this interval (review F11-3). */
export const SLIDE_INTERVAL_MS = MINUTE_MS

/** Remember lifetime in calendar years (DATA-M01-02). */
export const REMEMBER_LIFETIME_YEARS = 5

const TOKEN_PREFIX = 'pp_'
const TOKEN_LENGTH = 40
const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

export type SessionTokenSource = 'random' | 'deterministic'

/** `deterministic` only in the e2e build (`MODE === 'e2e'`); `random` in every other mode. */
export function sessionTokenSource(mode: string = import.meta.env.MODE): SessionTokenSource {
  return mode === 'e2e' ? 'deterministic' : 'random'
}

/** `pp_` + 40 alphanumerics from `crypto.getRandomValues` (rejection sampling: no modulo bias). */
export function randomSessionToken(): string {
  const target = TOKEN_PREFIX.length + TOKEN_LENGTH
  const buf = new Uint8Array(64)
  let out = TOKEN_PREFIX
  while (out.length < target) {
    crypto.getRandomValues(buf)
    for (const b of buf) {
      if (b >= 248) continue // 248 = 4 × 62
      out += ALNUM[b % ALNUM.length] ?? ''
      if (out.length === target) break
    }
  }
  return out
}

export interface SessionRow {
  /** The opaque token. */
  id: string
  userId: number
  remember: boolean
  /** Epoch ms. */
  expiresAt: number
  /** Epoch ms. */
  createdAt: number
  /**
   * Impersonation (XR-M27-21): the token of the actor's own session while this row is an
   * impersonated session; `null` for every ordinary session. Set only through
   * `create(..., parentToken)`; the actor's row is never touched while this one is open.
   */
  parentToken: string | null
}

export const sessionsTable = defineTable<SessionRow>({
  name: 'auth.sessions',
  // The deterministic source (e2e). Other modes pass a random id to `insert`.
  ids: opaque(TOKEN_PREFIX, 'core:session-tokens', TOKEN_LENGTH),
  indexes: ['userId'],
})

/** `now` + 5 calendar years in Malaysian time (29 Feb rolls over like `Date.UTC`). */
export function rememberExpiry(now: number): number {
  const p = mytParts(now)
  return fromMytParts({ ...p, year: p.year + REMEMBER_LIFETIME_YEARS })
}

export function initialExpiry(now: number, remember: boolean): number {
  return remember ? rememberExpiry(now) : now + SESSION_LIFETIME_MS
}

export const sessions = defineRepository({
  owner: 'core',
  name: 'sessions',
  store: sessionsTable,
  methods: ({ store, transaction }) => ({
    /**
     * Opens a session for `userId` (login, register, token reset, `setUser`). `parentToken` is set
     * only by the M01 impersonation switch (XR-M27-21).
     */
    create(
      userId: number,
      remember: boolean,
      now: number,
      parentToken: string | null = null,
    ): SessionRow {
      return transaction(() => {
        const row = {
          userId,
          remember,
          expiresAt: initialExpiry(now, remember),
          createdAt: now,
          parentToken,
        }
        if (sessionTokenSource() === 'deterministic') return store.insert(row)
        let id = randomSessionToken()
        while (store.get(id)) id = randomSessionToken()
        return store.insert({ id, ...row })
      })
    },

    /**
     * The live session of `token` at `now`, or `null`. Slides a non-remember session to
     * now + 120 min when the new expiry is at least `SLIDE_INTERVAL_MS` later than the stored one;
     * removes an expired session.
     */
    resolve(token: string, now: number): SessionRow | null {
      return transaction(() => {
        const row = store.get(token)
        if (!row) return null
        if (row.expiresAt <= now) {
          store.remove(token)
          return null
        }
        if (row.remember) return row
        const expiresAt = now + SESSION_LIFETIME_MS
        if (expiresAt - row.expiresAt < SLIDE_INTERVAL_MS) return row
        return store.update(token, { expiresAt })
      })
    },

    /** The session row without touching it (no sliding, no clean-up). */
    peek(token: string): SessionRow | undefined {
      return store.get(token)
    },

    /** Ends one session (logout, `expireSession`). Unknown tokens are ignored. */
    revoke(token: string): boolean {
      return transaction(() => {
        if (!store.get(token)) return false
        store.remove(token)
        return true
      })
    },

    /** Ends every session of `userId`; returns how many were removed. */
    revokeAllFor(userId: number): number {
      return transaction(() => {
        const { rows } = store.query({ where: { userId } })
        for (const row of rows) store.remove(row.id)
        return rows.length
      })
    },

    /** Ends every impersonation session opened from `token` (`parentToken === token`); returns the count. */
    revokeChildrenOf(token: string): number {
      return transaction(() => {
        const { rows } = store.query({ where: { parentToken: token } })
        for (const row of rows) store.remove(row.id)
        return rows.length
      })
    },

    /** Sessions of `userId` (newest first), for diagnostics and tests. */
    listFor(userId: number): SessionRow[] {
      return store.query({ where: { userId }, sort: { field: 'createdAt', dir: 'desc' } }).rows
    },
  }),
})

export type SessionsRepository = typeof sessions
