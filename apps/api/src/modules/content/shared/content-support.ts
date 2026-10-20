import type { Request } from 'express'

import { ApiError } from '../../../common/errors/api-error'
import { requestIdOf } from '../../../common/request/request-id'
import { AUTH_CONTEXT_KEY, type RequestWithAuth } from '../../../common/scope/auth-context'
import type { RateLimitSpec } from '../../../common/throttle'
import type { TxClient } from '../../../db/client'
import { isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { isOverloadError } from '../../auth/auth.errors'

/** Who is acting: the signed-in user and the request facts an audit row needs. */
export interface Actor {
  userId: string
  role: string
  sessionRowId: string
  scopeLevel: string
  requestId: string | null
  ip: string | null
  isTest: boolean
  /** `scheme://host` of this request (the API's own origin). */
  origin: string
}

export function actorOf(req: Request & RequestWithAuth): Actor {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  return {
    userId: auth.userId,
    role: auth.active.role,
    sessionRowId: auth.sessionRowId,
    scopeLevel: auth.active.scope.level,
    requestId: requestIdOf(req) ?? null,
    ip: req.ip ?? req.socket.remoteAddress ?? null,
    isTest: auth.mode !== null,
    origin: `${req.protocol}://${req.get('host') ?? ''}`,
  }
}

export function auditBase(who: Actor, action: string) {
  return {
    action,
    actorUserId: who.userId,
    actorRole: who.role,
    sessionRowId: who.sessionRowId,
    scopeLevel: who.scopeLevel,
    requestId: who.requestId,
    ip: who.ip,
    isTest: who.isTest,
  }
}

export const WRITE_TX = { maxWait: 10_000, timeout: 15_000 } as const

/** One transaction; an overloaded database is a retryable 429, never a 500. */
export async function writeTx<T>(prisma: PrismaService, fn: (tx: TxClient) => Promise<T>): Promise<T> {
  try {
    return await prisma.transaction(fn, WRITE_TX)
  } catch (err) {
    if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
    throw err
  }
}

/** Rate limits (D57a), env keys already in the schema. Public reads are per address, the rest per user. */
export const CONTENT_LIMITS = {
  publicRead: { bucket: 'content.public.read', env: 'THROTTLE_PUBLIC_SEARCH_PER_MINUTE', default: 300, per: 'ip' },
  userRead: { bucket: 'content.user.read', env: 'THROTTLE_PUBLIC_SEARCH_PER_MINUTE', default: 300, per: 'user' },
  adminRead: { bucket: 'content.admin.read', env: 'THROTTLE_ADMIN_READ_PER_MINUTE', default: 300, per: 'user' },
  adminWrite: { bucket: 'content.admin.write', env: 'THROTTLE_ADMIN_WRITE_PER_MINUTE', default: 30, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>

export const notFound = (message?: string): ApiError => ApiError.of('NOT_FOUND', message === undefined ? {} : { message })

/** First value of a query parameter as text; repeated keys use the first, non-text is ignored. */
export function queryText(query: Record<string, unknown>, key: string): string | undefined {
  const v = query[key]
  const first = Array.isArray(v) ? v[0] : v
  return typeof first === 'string' ? first : undefined
}

/** `?page=`: missing, non-numeric or below 1 is page 1 (never rejected, contract `pageQuery`). */
export function pageOf(raw: string | undefined): number {
  const t = raw?.trim() ?? ''
  return /^\d+$/.test(t) && Number(t) >= 1 ? Math.min(Number(t), 10_000_000) : 1
}

/** A search term for a title filter: trimmed and capped. */
export function searchOf(raw: string | undefined): string {
  return (raw ?? '').trim().slice(0, 100)
}

export const initialOf = (name: string): string => name.trim().charAt(0).toUpperCase()

/** A path id that is not a canonical bigint is simply "not found". */
export function idOrNotFound(raw: string, message?: string): string {
  if (!isIdString(raw)) throw notFound(message)
  return raw
}

/** Upper- or lower-cases the named text keys of a JSON body (the mock normalises codes before checking them). */
export function normaliseCodes(raw: unknown, upper: readonly string[], lower: readonly string[] = []): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw
  const out: Record<string, unknown> = { ...(raw as Record<string, unknown>) }
  for (const k of upper) if (typeof out[k] === 'string') out[k] = (out[k] as string).trim().toUpperCase()
  for (const k of lower) if (typeof out[k] === 'string') out[k] = (out[k] as string).trim().toLowerCase()
  return out
}

/** Relative URL of a stored file (BE-04 `FileRef.url`). */
export const fileUrlOf = (publicId: string): string => `/api/files/${publicId}`

const FILE_URL_PATH = /^\/api\/files\/([A-Za-z0-9_-]{22})$/

/**
 * The public token in a file URL, or null. Accepted: a relative `/api/files/<token>` path, or an absolute URL whose
 * origin is one of `origins` (the request's own origin and the configured PUBLIC_ORIGINS). Any other host is refused,
 * so `https://evil.test/api/files/<token>` and `//evil.test/...` never resolve.
 */
export function fileTokenOfUrl(url: string, origins: readonly string[]): string | null {
  try {
    if (url.startsWith('/')) {
      if (url.startsWith('//') || url.startsWith('/' + String.fromCharCode(92))) return null
      return FILE_URL_PATH.exec(new URL(url, 'http://local.invalid').pathname)?.[1] ?? null
    }
    const u = new URL(url)
    if (!origins.includes(u.origin)) return null
    return FILE_URL_PATH.exec(u.pathname)?.[1] ?? null
  } catch {
    return null
  }
}

/** Origins allowed in a stored-image URL: this request's origin plus the comma-separated PUBLIC_ORIGINS. */
export function allowedOrigins(requestOrigin: string, configured: string | undefined): string[] {
  const list = (configured ?? '').split(',').map((o) => o.trim()).filter(Boolean)
  const norm = [requestOrigin, ...list].map((o) => {
    try {
      return new URL(o).origin
    } catch {
      return ''
    }
  })
  return norm.filter(Boolean)
}

/** Today in Malaysia time as `YYYY-MM-DD`. */
export function mytDateKey(now: Date): string {
  return new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 10)
}

/** `YYYY-MM-DD` of a `date` column value. */
export const dateKeyOf = (d: Date): string => d.toISOString().slice(0, 10)

/** Date-only input as a UTC-midnight Date (what a `date` column stores). */
export const dateFromKey = (key: string): Date => new Date(`${key}T00:00:00.000Z`)

/** Maps a thrown Prisma unique violation (P2002) so callers can retry. */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2002'
}

/** `meta` of an unpaged list (the mock's `unpaged`): one page, `pageSize` never 0. */
export function unpagedMeta(n: number) {
  return { page: 1, pageSize: Math.max(1, n), totalItems: n, totalPages: 1, from: n > 0 ? 1 : null, to: n > 0 ? n : null }
}
