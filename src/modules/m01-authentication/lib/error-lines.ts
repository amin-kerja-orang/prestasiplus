/**
 * Turns a failed M01 auth call into the lines of the red alert box (FR-M01-09/10/26/68).
 * The mock sends the message text (credentials, throttle, inactive account) in `ApiError.message`
 * and per-field texts in `fields` (Laravel-style); one line per distinct text.
 */

import { isApiError } from '@/api'

/** Shown only when the request produced no usable message (network failure, HTTP 500). INFERRED copy. */
export const GENERIC_ERROR = 'Ralat berlaku. Sila cuba lagi.'

/** The API's generic English defaults (api-error.ts): never shown in the BM UI (SWE). */
const GENERIC_SERVER_TEXTS: readonly string[] = [
  'server error',
  'not found',
  'this action is unauthorized',
  'unauthenticated',
  'conflict',
  'the given data was invalid',
  'payload too large',
]

function isGenericServerText(message: string): boolean {
  return GENERIC_SERVER_TEXTS.includes(message.trim().replace(/\.$/, '').toLowerCase())
}

export function errorLines(err: unknown): string[] {
  if (!isApiError(err)) return [GENERIC_ERROR]
  // No response at all ("Failed to fetch" is English developer text): the generic line.
  if (err.status === 0 || err.code === 'NETWORK_ERROR') return [GENERIC_ERROR]
  const fieldTexts = err.fields ? Object.values(err.fields) : []
  if (fieldTexts.length > 0) return [...new Set(fieldTexts)]
  if (
    err.message === '' ||
    /^HTTP \d+$/.test(err.message) ||
    err.status >= 500 ||
    isGenericServerText(err.message)
  ) {
    return [GENERIC_ERROR]
  }
  return [err.message]
}
