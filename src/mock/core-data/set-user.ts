/**
 * The `setUser` test hook (overview §6.13; delegated built-in of `window.__mock`, provided by the
 * core). Fast login for E2E and dev: it opens a server session for a user and writes
 * `localStorage['pp.auth']` (M01 DATA-M01-02), so the F-12 session store restores it when the app
 * boots. `__MOCK_INIT__.session` is applied through this hook after boot, before the first request.
 *
 * Accepted arguments (overview X-5; `MockInitSession` in `src/mock/testing/contract.ts`):
 * - `setUser('pelajar@demo.test')` — by e-mail (case-insensitive);
 * - `setUser(2)` — by user id;
 * - `setUser('student', 2)` — role and id (the array form `['student', 2]` of `__MOCK_INIT__`);
 *   the role must match the user's role;
 * - a trailing boolean is "Ingat saya": `setUser('pelajar@demo.test', true)`. Default `false`
 *   (a 120-minute sliding session, like a normal login).
 *
 * It is not a login through `POST /api/auth/login`, so it does **not** change `lastLoginAt`
 * (BR-25 applies to the endpoint; seeded `lastLoginAt` values stay as observed/designed). It logs
 * in inactive users too (BR-23 blocks the login form, not an open session).
 *
 * Returns the stored `ClientSession`.
 */

import type { MockRole } from '../auth/middleware'
import { LANDING_PATHS } from '../auth/landing'
import { issueSession, PP_AUTH_STORAGE_KEY, type ClientSession } from './client-session'
import { coreClock } from './runtime'
import { isSessionUser, users } from './users'

type SetUserArg = string | number | boolean

const ROLES = Object.keys(LANDING_PATHS) as MockRole[]

function isRole(value: unknown): value is MockRole {
  return typeof value === 'string' && (ROLES as string[]).includes(value)
}

function usage(args: readonly unknown[]): Error {
  return new TypeError(
    `setUser(${args.map((a) => JSON.stringify(a)).join(', ')}): expected an e-mail, a user id, ` +
      `or (role, id), optionally followed by a boolean "remember"`,
  )
}

interface StorageLike {
  setItem(key: string, value: string): void
}

function authStorage(): StorageLike | null {
  const storage = (globalThis as { localStorage?: Partial<StorageLike> }).localStorage
  return storage && typeof storage.setItem === 'function' ? (storage as StorageLike) : null
}

export function setUser(...args: SetUserArg[]): ClientSession {
  const rest = [...args]
  let remember = false
  if (typeof rest[rest.length - 1] === 'boolean') remember = rest.pop() as boolean

  let expectedRole: MockRole | null = null
  let target: string | number
  if (rest.length === 2 && isRole(rest[0]) && typeof rest[1] === 'number') {
    expectedRole = rest[0]
    target = rest[1]
  } else if (rest.length === 1 && (typeof rest[0] === 'string' || typeof rest[0] === 'number')) {
    target = rest[0]
  } else {
    throw usage(args)
  }

  const user = typeof target === 'number' ? users.get(target) : users.findByEmail(target)
  if (!user) throw new Error(`setUser: no user ${JSON.stringify(target)}`)
  if (!isSessionUser(user)) {
    throw new Error(`setUser: user ${String(user.id)} has no session role ('${user.role}')`)
  }
  if (expectedRole !== null && user.role !== expectedRole) {
    throw new Error(
      `setUser: user ${String(user.id)} has role '${user.role}', not '${expectedRole}'`,
    )
  }

  const session = issueSession(user, remember, coreClock().now())
  authStorage()?.setItem(PP_AUTH_STORAGE_KEY, JSON.stringify(session))
  return session
}
