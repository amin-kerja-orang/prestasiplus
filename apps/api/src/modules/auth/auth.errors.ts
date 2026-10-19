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
