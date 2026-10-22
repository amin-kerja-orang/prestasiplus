import { PKSK_STUDENT_MESSAGES } from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'

/** Laravel summary of the field messages: the first one plus " (and N more error(s))". */
function summarize(fields: Record<string, string>): string | undefined {
  const messages = Object.values(fields)
  const first = messages[0]
  if (first === undefined) return undefined
  const more = messages.length - 1
  return more <= 0 ? first : `${first} (and ${more} more error${more === 1 ? '' : 's'})`
}

/** 422 VALIDATION_ERROR with `fields`; the message is the first field message plus the count of the rest. */
export function invalid(fields: Record<string, string>): ApiError {
  const message = summarize(fields)
  return ApiError.of('VALIDATION_ERROR', { fields, ...(message ? { message } : {}) })
}

/** 422 "Jawapan tidak sah." with `fields.answers` (both POST routes of the learner). */
export function invalidAnswers(): ApiError {
  return invalid({ answers: PKSK_STUDENT_MESSAGES.answers })
}
