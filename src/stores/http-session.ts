/**
 * Real-API session adapter (V2-T31; `VITE_API_MODE=http`).
 *
 * The API session (`Session` in `packages/contract/src/session`) is a cookie session: no bearer
 * token, a `csrf` token, a role list and an `active` role. The rest of the UI still reads the
 * prototype `ClientSession` (`pp.auth`: `token`, `user.role`, `user.landingPath`, ...), so this
 * file maps one to the other and nothing else changes:
 * - `token` carries the `csrf` value (the guards and the store only need it non-empty; the HTTP
 *   transport does not send it as a bearer header, it sends `csrf` as `X-CSRF-Token`);
 * - `user.role` is `active.role`; `user.landingPath` is the server's `landingPath`;
 * - fields the session response does not carry (phone, grade, bio, school, timestamps) are
 *   `null`/empty until `GET /api/me` (the background refresh after every navigation) fills them.
 * Ids stay opaque on the wire; `user.id` is `Number(id)` only because `UserMe.id` is still a
 * number in the prototype types (V2-T09 moves it to string).
 */

import { api, ApiError } from '@/api'
import { isPrototypeRole, isPrototypeScopeOn, scopeHomePath } from '@/app/prototype-scope'

import { readStoredSession, useSessionStore } from './session'
import type { ClientSession, Role, UserMe } from './session-types'

/** The slice of the contract `Session` this adapter reads (kept structural, no contract import in `src/`). */
export interface ApiSession {
  user: {
    id: string
    name: string
    email: string | null
    username: string | null
    avatarUrl: string | null
    schoolId: string | null
  }
  roles: { role: string }[]
  active: { role: string }
  mode: { kind: string; returnRole: string; since: string } | null
  landingPath: string
  expiresAt: string
  csrf: string
  mustChangePassword: boolean
}

/** `true` for a body that has the real API session shape (`csrf` + `active`). */
export function isApiSession(value: unknown): value is ApiSession {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.csrf === 'string' && typeof v.active === 'object' && v.active !== null
}

function numericId(id: string | null): number | null {
  if (id === null) return null
  const n = Number(id)
  return Number.isFinite(n) ? n : null
}

export function toClientSessionFromApi(session: ApiSession, remember: boolean): ClientSession {
  const now = session.expiresAt
  const user: UserMe = {
    id: numericId(session.user.id) ?? 0,
    name: session.user.name,
    email: session.user.email ?? '',
    phone: null,
    role: session.active.role as Role,
    grade: null,
    schoolId: numericId(session.user.schoolId),
    bio: null,
    avatarUrl: session.user.avatarUrl,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    school: null,
    landingPath: session.landingPath,
  }
  const out: ClientSession = {
    token: session.csrf,
    csrf: session.csrf,
    remember,
    expiresAt: session.expiresAt,
    user,
  }
  // Mod Pelajar is a server-side mode here: nothing is parked client-side, so `parent` is only a
  // placeholder (the staff identity under the return role) that keeps the stored shape valid.
  // Leaving is `DELETE /api/session/mode`, which returns the real staff session.
  if (session.mode?.kind === 'mod_pelajar') {
    const returnRole = session.mode.returnRole as Role
    out.mode = {
      kind: 'mod_pelajar',
      returnRole,
      since: session.mode.since,
      returnTo: scopeHomePath(returnRole),
      parent: {
        token: session.csrf,
        remember,
        expiresAt: session.expiresAt,
        user: { ...user, role: returnRole },
      },
    }
  }
  return out
}

/** CSRF token of the stored session; the HTTP transport reads it lazily on every write. */
export function storedCsrfToken(): string | null {
  return readStoredSession()?.csrf ?? null
}

/**
 * V2-T31 T7: before mounting in http mode, ask the server who the cookie belongs to. A valid cookie
 * (re)builds `pp.auth` (also in a new tab or after storage was cleared); 401 clears a stale one.
 * A network failure keeps whatever is stored.
 */
export async function restoreHttpSession(): Promise<void> {
  const store = useSessionStore()
  try {
    const body = await api.get<unknown>('/api/session')
    if (isApiSession(body)) {
      // Mirror the login-time refusal (D43): a cookie session of a role outside the prototype
      // scope is ended instead of rebuilt.
      if (isPrototypeScopeOn() && !isPrototypeRole(body.active.role as Role)) {
        try {
          await api.post<void>('/api/auth/logout')
        } catch {
          // best effort
        }
        store.clear()
        return
      }
      store.setSession(toClientSessionFromApi(body, store.remember))
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) store.clear()
  }
}
