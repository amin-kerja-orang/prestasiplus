/**
 * `session` store (overview §7, §9 "Global stores"; M01 BR-06, DATA-M01-02, FR-M01-14/37/52).
 *
 * Holds the client session `pp.auth = {token, remember, expiresAt, user: UserMe}`. `localStorage`
 * is the source of truth: the store restores from it on creation (the mock `setUser` hook has
 * already written it when `startMock` resolves, overview §6.13) and re-reads it in `check()`, which
 * the router guard runs before every navigation (overview §5.4 step 1). So a session written by the
 * test hook mid-test, or cleared in another tab, is seen on the next navigation.
 *
 * Rules:
 * - **Expiry** is judged by the shared clock (`@/lib/time` `clock`, ADR-0006). An expired session
 *   is cleared (store and storage).
 * - **Sliding** (BR-06): the mock slides a non-remember session to now + 120 min on every
 *   request whose token resolves, i.e. any status except 401, at most once a minute (M01 v1.10).
 *   The client mirrors it: after each non-401 response to a request that carried the current token,
 *   `expiresAt` moves to now + 120 min, unless `remember` is true (+5 years, fixed). The client
 *   slides on every such response while the server throttles to once a minute, so the client's
 *   `expiresAt` may run up to about 60 s ahead of the server's. In that window the next request
 *   gets a 401, and the 401 policy logs the user out as live would. The hook is the transport
 *   wrapper `withSessionSliding()`, which `bootstrap.ts` (F-13) puts around the installed
 *   transport.
 * - **401** (FR-M01-14): the store configures `api.onUnauthorized`. It clears the session, then
 *   calls the redirect registered with `setUnauthorizedRedirect()` (F-13: `router.replace('/login')`,
 *   no query, no message).
 * - **Background `me` refresh** (FR-M01-52): `refreshUser()` refetches `GET /api/me` (M01 #7) and
 *   updates the cached user; F-13 calls it after each navigation.
 * - **Logout** (FR-M01-37): `logout()` calls `POST /api/auth/logout`, then clears the session
 *   whatever the result. The `/logout` route (F-13) then does `router.replace('/login')`.
 */

import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

import { api, type Transport, type TransportRequest } from '@/api'
import { clock, MINUTE_MS, toIsoMyt } from '@/lib/time'

import { PP_AUTH_STORAGE_KEY, type ClientSession, type Role, type UserMe } from './session-types'

/** Non-remember lifetime after the last request (M01 BR-06, live `SESSION_LIFETIME=120`). */
export const SESSION_LIFETIME_MS = 120 * MINUTE_MS

/** What the store does after clearing the session on a 401 (F-13 registers `replace('/login')`). */
export type UnauthorizedRedirect = () => unknown

let unauthorizedRedirect: UnauthorizedRedirect | null = null

/**
 * Registers the redirect run after a 401 has cleared the session (FR-M01-14). F-13 calls it once
 * with `() => router.replace('/login')`. Returns a function that removes the registration.
 */
export function setUnauthorizedRedirect(redirect: UnauthorizedRedirect | null): () => void {
  unauthorizedRedirect = redirect
  return () => {
    if (unauthorizedRedirect === redirect) unauthorizedRedirect = null
  }
}

/** Called by `withSessionSliding` with the token of every non-401 authenticated response. */
let slideListener: ((token: string) => void) | null = null

function bearerToken(req: TransportRequest): string | null {
  const header = Object.entries(req.headers).find(
    ([name]) => name.toLowerCase() === 'authorization',
  )
  const match = header ? /^Bearer\s+(.+)$/i.exec(header[1]) : null
  return match?.[1] ?? null
}

/**
 * Wraps a transport so that each response other than 401 to a request carrying the current Bearer
 * token slides the client session (BR-06; the server slides whenever the token resolves, M01
 * v1.10). A 401 means the token did not resolve (the 401 policy clears the session); a rejected
 * request (network failure, abort) has no response and does not slide. The server slides at most
 * once a minute, so the client may run up to about 60 s ahead of it. Install it once at boot
 * (F-13): `installTransport(withSessionSliding(runtime.transport))`.
 */
export function withSessionSliding(inner: Transport): Transport {
  return {
    async request(req, signal) {
      const res = await inner.request(req, signal)
      if (res.status !== 401) {
        const token = bearerToken(req)
        if (token !== null) slideListener?.(token)
      }
      return res
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Storage

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Minimal shape check of a stored session; anything else is treated as "no session". */
export function parseClientSession(raw: string | null): ClientSession | null {
  if (raw === null) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(value)) return null
  const { token, remember, expiresAt, user } = value
  if (typeof token !== 'string' || token === '') return null
  if (typeof remember !== 'boolean') return null
  if (typeof expiresAt !== 'string' || Number.isNaN(Date.parse(expiresAt))) return null
  if (!isRecord(user) || typeof user.id !== 'number' || typeof user.role !== 'string') return null
  if (typeof user.landingPath !== 'string') return null
  const { impersonator, ...rest } = value
  const session = rest as unknown as ClientSession
  if (impersonator === undefined) return session
  // A malformed impersonator is dropped (the session stays usable); a valid one round-trips.
  if (
    isRecord(impersonator) &&
    typeof impersonator.id === 'number' &&
    typeof impersonator.name === 'string' &&
    typeof impersonator.returnTo === 'string'
  ) {
    return {
      ...session,
      impersonator: {
        id: impersonator.id,
        name: impersonator.name,
        returnTo: impersonator.returnTo,
      },
    }
  }
  return session
}

export function readStoredSession(): ClientSession | null {
  return parseClientSession(storage()?.getItem(PP_AUTH_STORAGE_KEY) ?? null)
}

function writeStoredSession(session: ClientSession | null): void {
  const store = storage()
  if (!store) return
  try {
    if (session) store.setItem(PP_AUTH_STORAGE_KEY, JSON.stringify(session))
    else store.removeItem(PP_AUTH_STORAGE_KEY)
  } catch {
    // Storage full or blocked: the in-memory session still works for this page.
  }
}

/** `true` when `session` has expired at `now` (epoch ms). */
export function isSessionExpired(session: ClientSession, now: number = clock.now()): boolean {
  return Date.parse(session.expiresAt) <= now
}

// ---------------------------------------------------------------------------------------------
// Store

export const useSessionStore = defineStore('session', () => {
  const auth = shallowRef<ClientSession | null>(null)

  const isLoggedIn = computed(() => auth.value !== null)
  const token = computed<string | null>(() => auth.value?.token ?? null)
  const user = computed<UserMe | null>(() => auth.value?.user ?? null)
  const role = computed<Role | null>(() => auth.value?.user.role ?? null)
  const landingPath = computed<string | null>(() => auth.value?.user.landingPath ?? null)
  const remember = computed(() => auth.value?.remember ?? false)
  const expiresAt = computed<string | null>(() => auth.value?.expiresAt ?? null)
  /** The actor of an impersonated session (XR-M27-21); `null` otherwise. The shell banner reads it. */
  const impersonator = computed(() => auth.value?.impersonator ?? null)

  function commit(next: ClientSession | null): void {
    auth.value = next
    writeStoredSession(next)
  }

  /**
   * Loads `pp.auth` and drops it when missing, malformed or expired. Returns whether a session is
   * active. The router guard calls it before each navigation (overview §5.4 step 1).
   */
  function check(now: number = clock.now()): boolean {
    const store = storage()
    // Without Web Storage (e.g. a Node test) the in-memory session is the only copy.
    const raw = store ? store.getItem(PP_AUTH_STORAGE_KEY) : null
    const candidate = store ? parseClientSession(raw) : auth.value
    if (candidate && !isSessionExpired(candidate, now)) {
      auth.value = candidate
      return true
    }
    auth.value = null
    if (raw !== null) writeStoredSession(null)
    return false
  }

  /** Stores a new session (login, register, token reset, M02 "Login As"). */
  function setSession(session: ClientSession): void {
    commit({ ...session })
  }

  /** Replaces the cached user (after `GET /api/me` or a profile update). */
  function setUser(next: UserMe): void {
    if (!auth.value) return
    commit({ ...auth.value, user: next })
  }

  /** Mirrors the server's sliding expiry (BR-06): non-remember → now + 120 min. */
  function slide(now: number = clock.now()): void {
    const current = auth.value
    if (!current || current.remember) return
    const next = toIsoMyt(now + SESSION_LIFETIME_MS)
    if (next === current.expiresAt) return
    commit({ ...current, expiresAt: next })
  }

  /** Clears the session (store and `pp.auth`). */
  function clear(): void {
    commit(null)
  }

  /** 401 policy (FR-M01-14): clear the session, then run the registered redirect. */
  async function handleUnauthorized(): Promise<void> {
    clear()
    await unauthorizedRedirect?.()
  }

  /**
   * Background refresh of the cached user from `GET /api/me` (FR-M01-52). Resolves to the fresh
   * user, or `null` when there is no session, the session changed meanwhile, or the call failed
   * (a 401 has already been handled by the 401 policy; other errors keep the cached user).
   */
  async function refreshUser(): Promise<UserMe | null> {
    const sent = auth.value?.token
    if (!sent) return null
    try {
      const me = await api.get<UserMe>('/api/me')
      if (auth.value?.token !== sent) return null
      setUser(me)
      return me
    } catch {
      return null
    }
  }

  /** `POST /api/auth/logout`, then clear the session whatever the result (FR-M01-37). */
  async function logout(): Promise<void> {
    if (auth.value) {
      try {
        await api.post<void>('/api/auth/logout')
      } catch {
        // Ignored: the client session is cleared anyway (FR-M01-37, M01 #6 "401 (ignored)").
      }
    }
    clear()
  }

  // Wiring: the API client reads the token from this store and reports 401s to it.
  api.configure({
    getToken: () => auth.value?.token ?? null,
    onUnauthorized: () => handleUnauthorized(),
  })
  slideListener = (sentToken) => {
    if (auth.value?.token === sentToken) slide()
  }

  check()

  return {
    auth,
    isLoggedIn,
    token,
    user,
    role,
    landingPath,
    remember,
    expiresAt,
    impersonator,
    check,
    setSession,
    setUser,
    slide,
    clear,
    handleUnauthorized,
    refreshUser,
    logout,
  }
})

export type SessionStore = ReturnType<typeof useSessionStore>
