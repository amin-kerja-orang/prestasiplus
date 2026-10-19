import { AUTH_ERROR_MESSAGES, AUTH_ERROR_STATUS, type AuthErrorCode } from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'

/** Auth/session error with the contract's status and exact BM message. */
export function authError(code: AuthErrorCode, extra: { details?: Record<string, unknown> } = {}): ApiError {
  return new ApiError({
    code,
    status: AUTH_ERROR_STATUS[code],
    message: AUTH_ERROR_MESSAGES[code],
    ...(extra.details ? { details: extra.details } : {}),
  })
}

/** 429 with `retryAfter` seconds (the filter also sets the `Retry-After` header). */
export function rateLimited(retryAfter: number): ApiError {
  return ApiError.of('RATE_LIMITED', { message: AUTH_ERROR_MESSAGES.RATE_LIMITED, retryAfter })
}

/**
 * True for an error that only says "the database or this process is overloaded": an expired
 * interactive transaction (Prisma P2028), a pool or connect timeout (P2024) or a dropped connection.
 * Such an error must never reach the client as a 500 (it is retryable): callers answer 429 instead.
 */
export function isOverloadError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as { code?: unknown; message?: unknown; cause?: unknown }
  if (e.code === 'P2028' || e.code === 'P2024') return true
  const text = typeof e.message === 'string' ? e.message : ''
  if (/connection terminated|connection timeout|expired transaction|timeout for this transaction/i.test(text)) return true
  return e.cause !== undefined && e.cause !== err && isOverloadError(e.cause)
}
