import { ACCOUNT_AUTH_MESSAGES, AUTH_ERROR_MESSAGES, AUTH_ERROR_STATUS } from '@pp/contract'
import type { z } from 'zod'

import { ApiError } from '../../common/errors/api-error'

/** Laravel `ValidationException::summarize`, as the mock: the first message plus "(and N more error(s))". */
export function summarize(fields: Record<string, string>): string {
  const messages = Object.values(fields)
  const [first] = messages
  if (first === undefined) return 'The given data was invalid.'
  const more = messages.length - 1
  return more === 0 ? first : `${first} (and ${String(more)} more error${more === 1 ? '' : 's'})`
}

/** 422 with `fields`; the top-level message is the summary of the field messages. */
export function invalid(fields: Record<string, string>): ApiError {
  return ApiError.of('VALIDATION_ERROR', { fields, message: summarize(fields) })
}

/** Field errors of a failed zod parse, first issue per path. */
export function fieldsOf(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    fields[issue.path.length ? issue.path.map(String).join('.') : '_'] ??= issue.message
  }
  return fields
}

/** 429 with `retryAfter` seconds (the filter also sets the `Retry-After` header). */
export function tooMany(retryAfter: number, message: string = AUTH_ERROR_MESSAGES.RATE_LIMITED, fields?: Record<string, string>): ApiError {
  return ApiError.of('RATE_LIMITED', { message, retryAfter, ...(fields ? { fields } : {}) })
}

/** D55b: an unknown e-mail, a wrong, used, expired or foreign token all answer exactly like this. */
export const tokenInvalid = (): ApiError => invalid({ email: ACCOUNT_AUTH_MESSAGES.tokenInvalid })

/** D55a / BR-12: every reason a reset-ic can fail looks like this. */
export const icMismatch = (): ApiError => invalid({ email: ACCOUNT_AUTH_MESSAGES.icMismatch })

export const accountInactive = (): ApiError =>
  new ApiError({ code: 'ACCOUNT_INACTIVE', status: AUTH_ERROR_STATUS.ACCOUNT_INACTIVE, message: ACCOUNT_AUTH_MESSAGES.accountInactive })
