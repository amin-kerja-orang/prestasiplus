/**
 * Auth middleware of the mock server (overview §6.4, §7).
 *
 * | Guard | No session | Wrong role / not owner |
 * |---|---|---|
 * | `requireAuth()` | `401 UNAUTHORIZED` | — |
 * | `requireRole(...roles)` | `401 UNAUTHORIZED` | `403 FORBIDDEN` |
 * | `requireOwner(getOwnerId)` | `401 UNAUTHORIZED` | `404 NOT_FOUND` (e.g. M06 BR-M06-26) |
 *
 * **Session resolution is a stub here.** The server reads the Bearer token and asks the
 * `SessionResolver` of the mock core (`defineMockCore({ resolveSession })`, written by F-11 in
 * `src/mock/core-data`) for the session. Without a core resolver every token is unknown, so every
 * guarded route answers 401. F-11 owns the sessions table, expiry (sliding 120 min / remember) and
 * `GET /api/me`; this file only reads `req.session`.
 */

import { API_ERROR_CODES } from '@/api/errors'

import { DEFAULT_ERROR_MESSAGES, fail } from '../server/respond'
import type { MockContext, MockRequest, Middleware } from '../server/types'

/** The 8 role codes of M01 DATA (`users.role`). */
export type MockRole =
  | 'student'
  | 'teacher'
  | 'parent'
  | 'sponsor'
  | 'school_admin'
  | 'ppd_officer'
  | 'jpn_officer'
  | 'admin'

/** What the guards need from a session. F-11's resolver may return more fields. */
export interface MockSession {
  token: string
  userId: number
  role: MockRole
}

/**
 * Resolves a Bearer token to a live session, or `null` (unknown, expired or revoked). It runs inside
 * a transaction before the route's guards, so it may extend a sliding expiry.
 */
export type SessionResolver = (
  token: string,
  req: Omit<MockRequest, 'session'>,
  ctx: MockContext,
) => MockSession | null

/** The stub resolver: no session store yet, so no token is valid. */
export const noSessions: SessionResolver = () => null

/** `Authorization: Bearer <token>` → token, else `null`. */
export function bearerToken(headers: Readonly<Record<string, string>>): string | null {
  const value = headers.authorization
  if (!value) return null
  const match = /^Bearer\s+(\S+)\s*$/i.exec(value)
  return match?.[1] ?? null
}

const unauthenticated = () =>
  fail(401, API_ERROR_CODES.UNAUTHORIZED, DEFAULT_ERROR_MESSAGES.UNAUTHORIZED)

/** `401 UNAUTHORIZED` when the request has no valid session. */
export function requireAuth(): Middleware {
  return (req) => (req.session ? undefined : unauthenticated())
}

/** `401` without a session; `403 FORBIDDEN` when the session's role is not one of `roles`. */
export function requireRole(...roles: MockRole[]): Middleware {
  if (roles.length === 0) throw new Error('requireRole: give at least one role')
  return (req) => {
    if (!req.session) return unauthenticated()
    if (!roles.includes(req.session.role)) {
      return fail(403, API_ERROR_CODES.FORBIDDEN, DEFAULT_ERROR_MESSAGES.FORBIDDEN)
    }
    return undefined
  }
}

/**
 * `401` without a session; `404 NOT_FOUND` when the resource does not exist (`getOwnerId` returns
 * `undefined`/`null`) or belongs to someone else. Ownership rules answer 404, not 403, so a user
 * cannot probe other users' ids.
 */
export function requireOwner(
  getOwnerId: (req: MockRequest, ctx: MockContext) => number | null | undefined,
): Middleware {
  return (req, ctx) => {
    if (!req.session) return unauthenticated()
    const ownerId = getOwnerId(req, ctx)
    if (ownerId === undefined || ownerId === null || ownerId !== req.session.userId) {
      return fail(404, API_ERROR_CODES.NOT_FOUND, DEFAULT_ERROR_MESSAGES.NOT_FOUND)
    }
    return undefined
  }
}
