/**
 * M01 auth state stores and their repositories (owner M01; M01-T1). Kept next to the handlers that
 * use them. Every store here is guarded (D12): only these repositories write it.
 *
 * - `passwordResets` — Laravel password broker tokens (DATA-M01-05, BR-10/11): one live token per
 *   e-mail, valid 60 min, single use. The row id is the token. The seed adds the two documented
 *   demo tokens (§6.8): `demo-reset-token` (pelajar@demo.test, valid) and `demo-expired-token`
 *   (expired).
 * - `loginThrottle` — failed login attempts per e-mail (BR-02, INFERRED Laravel `ThrottlesLogins`:
 *   5 attempts, 60 s decay). Keyed by the lower-case e-mail (the mock has one client IP).
 * - `userSettings` — DATA-M01-03, 1:1 with the user; a user who never saved reads the BR-17
 *   defaults.
 */

import { MINUTE_MS, SECOND_MS } from '@/lib/time'
import { randomSessionToken, sessionTokenSource } from '@/mock/auth/sessions'
import { defineTable, maxPlusOne, opaque } from '@/mock/define'
import { defineRepository } from '@/mock/repository'

import type { UserSettings } from '../../api/types'
import { emailKey } from '../repository/users'

// --- Password broker tokens -------------------------------------------------------------------

export interface PasswordResetRow {
  /** The token itself. */
  id: string
  /** `emailKey` of the user. */
  email: string
  /** Epoch ms. */
  createdAt: number
  /** Epoch ms; a token is unusable at or after this time. */
  expiresAt: number
}

/** BR-10: a token is valid 60 minutes. */
export const RESET_TOKEN_LIFETIME_MS = 60 * MINUTE_MS
/** BR-10: a new request for the same e-mail within 60 s is throttled. */
export const RESET_REQUEST_INTERVAL_MS = 60 * SECOND_MS

/**
 * MOCK AND DEMO ONLY: the demo reset tokens below are well-known values for the prototype and
 * tests. They must never go into real-backend fixtures or seeds.
 */
export const DEMO_RESET_TOKEN = 'demo-reset-token'
export const DEMO_EXPIRED_TOKEN = 'demo-expired-token'
export const DEMO_RESET_EMAIL = 'pelajar@demo.test'

const TOKEN_PREFIX = 'rt_'

export const passwordResetsTable = defineTable<PasswordResetRow>({
  name: 'auth.passwordResets',
  ids: opaque(TOKEN_PREFIX, 'm01:reset-tokens', 40),
  indexes: ['email'],
})

function randomResetToken(): string {
  return TOKEN_PREFIX + randomSessionToken().slice(3)
}

export const passwordResetsRepo = defineRepository({
  owner: 'M01',
  name: 'passwordResets',
  store: passwordResetsTable,
  methods: ({ store, transaction }) => ({
    /**
     * Issues a token for `email` (replacing any earlier one, like the broker's `create`). Random
     * outside the e2e build; deterministic in e2e (the same rule as session tokens).
     *
     * Accepted consequences (review M01-T1):
     * - `issue()` removes every earlier row of the e-mail, the seeded demo tokens included. This
     *   matches the Laravel broker (one token per e-mail) and is accepted.
     * - A token issued by the IC reset (#5) also arms the 60 s forgot-password throttle for that
     *   e-mail, because both share this table. INFERRED (Laravel shares `createToken`); accepted.
     */
    issue(email: string, now: number): PasswordResetRow {
      const key = emailKey(email)
      return transaction(() => {
        for (const old of store.query({ where: { email: key } }).rows) store.remove(old.id)
        const row = { email: key, createdAt: now, expiresAt: now + RESET_TOKEN_LIFETIME_MS }
        if (sessionTokenSource() === 'deterministic') return store.insert(row)
        let id = randomResetToken()
        while (store.get(id)) id = randomResetToken()
        return store.insert({ id, ...row })
      })
    },

    /** The token row, or `undefined`. Does not check the expiry. */
    find(token: string): PasswordResetRow | undefined {
      return token === '' ? undefined : store.get(token)
    },

    /** The live token row of `email`, or `undefined`. */
    forEmail(email: string): PasswordResetRow | undefined {
      return store.query({ where: { email: emailKey(email) } }).rows[0]
    },

    /** Deletes a token (single use, BR-11). */
    consume(token: string): void {
      transaction(() => {
        if (store.get(token)) store.remove(token)
      })
    },

    /** Seconds until a new request for `email` is allowed (BR-10), or 0. */
    retryAfter(email: string, now: number): number {
      const row = store.query({ where: { email: emailKey(email) } }).rows[0]
      if (!row) return 0
      const wait = row.createdAt + RESET_REQUEST_INTERVAL_MS - now
      return wait > 0 ? Math.ceil(wait / SECOND_MS) : 0
    },

    /**
     * Seed phase: the demo tokens of SRS §6.8. The valid one never expires (a demo link must keep
     * working on a real clock), the expired one expired an hour before the seed time. Both were
     * "created" two hours earlier, so neither throttles a first forgot-password request.
     */
    seedDemo(now: number): void {
      transaction(() => {
        store.insert({
          id: DEMO_RESET_TOKEN,
          email: DEMO_RESET_EMAIL,
          createdAt: now - 2 * 60 * MINUTE_MS,
          expiresAt: Number.MAX_SAFE_INTEGER,
        })
        store.insert({
          id: DEMO_EXPIRED_TOKEN,
          email: DEMO_RESET_EMAIL,
          createdAt: now - 2 * 60 * MINUTE_MS,
          expiresAt: now - 60 * MINUTE_MS,
        })
      })
    },
  }),
})

// --- Login throttle ---------------------------------------------------------------------------

export interface LoginThrottleRow {
  /** `emailKey`. */
  id: string
  attempts: number
  /** Epoch ms; the window ends here (decay starts at the first failure, like Laravel). */
  expiresAt: number
}

/** BR-02. */
export const LOGIN_MAX_ATTEMPTS = 5
export const LOGIN_DECAY_MS = 60 * SECOND_MS

export const loginThrottleTable = defineTable<LoginThrottleRow>({
  name: 'auth.loginThrottle',
  ids: opaque('lt_', 'm01:login-throttle', 8),
})

export const loginThrottleRepo = defineRepository({
  owner: 'M01',
  name: 'loginThrottle',
  store: loginThrottleTable,
  methods: ({ store, transaction }) => ({
    /** Seconds until `email` may try again when it is locked (BR-02), otherwise 0. */
    retryAfter(email: string, now: number): number {
      const row = store.get(emailKey(email))
      if (!row || row.expiresAt <= now || row.attempts < LOGIN_MAX_ATTEMPTS) return 0
      return Math.ceil((row.expiresAt - now) / SECOND_MS)
    },

    /** Counts a failed credentials attempt. */
    hit(email: string, now: number): void {
      const id = emailKey(email)
      transaction(() => {
        const row = store.get(id)
        if (!row || row.expiresAt <= now) {
          if (row) store.remove(id)
          store.insert({ id, attempts: 1, expiresAt: now + LOGIN_DECAY_MS })
          return
        }
        store.update(id, { attempts: row.attempts + 1 })
      })
    },

    /** A successful login clears the counter (Laravel `clearLoginAttempts`). */
    clear(email: string): void {
      const id = emailKey(email)
      transaction(() => {
        if (store.get(id)) store.remove(id)
      })
    },
  }),
})

// --- User settings ----------------------------------------------------------------------------

/** BR-17. */
export const DEFAULT_SETTINGS: Readonly<UserSettings> = Object.freeze({
  spiritualMode: false,
  showBismillahSplash: false,
  subuhPushEnabled: false,
  subuhPushTime: '05:30',
  ramadanModeEnabled: false,
  sahurPushTime: '04:30',
  faith: null,
})

export type UserSettingsRow = UserSettings & { id: number }

export const userSettingsTable = defineTable<UserSettingsRow>({
  name: 'users.settings',
  ids: maxPlusOne(),
})

export const userSettingsRepo = defineRepository({
  owner: 'M01',
  name: 'userSettings',
  store: userSettingsTable,
  methods: ({ store, transaction }) => ({
    /** The user's settings; the BR-17 defaults when never saved. */
    get(userId: number): UserSettings {
      const row = store.get(userId)
      if (!row) return { ...DEFAULT_SETTINGS }
      return {
        spiritualMode: row.spiritualMode,
        showBismillahSplash: row.showBismillahSplash,
        subuhPushEnabled: row.subuhPushEnabled,
        subuhPushTime: row.subuhPushTime,
        ramadanModeEnabled: row.ramadanModeEnabled,
        sahurPushTime: row.sahurPushTime,
        faith: row.faith,
      }
    },

    /** Writes every field (a save always writes all, BR-17). */
    save(userId: number, settings: UserSettings): UserSettings {
      transaction(() => {
        if (store.get(userId)) store.update(userId, settings)
        else store.insert({ id: userId, ...settings })
      })
      return { ...settings }
    },
  }),
})
