/**
 * The one copy of the M04 error helpers (S1 to S12): red-alert lines of a failed call, the load-failure
 * text, server field messages and the unknown-id test. UI code never imports another module's internals,
 * so M04 keeps these here.
 */

import { isApiError } from '@/api'

/** Shown only when the request produced no usable message (network failure, HTTP 500). INFERRED copy. */
export const GENERIC_ERROR = 'Ralat berlaku. Sila cuba lagi.'

/** SRS §8.2 "Load error" (FR-G-10); the retry button reads "Cuba Semula". */
export const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

/** Red-alert lines of a failed request: the server field messages first, else the message. */
export function errorLines(err: unknown): string[] {
  if (!isApiError(err)) return [GENERIC_ERROR]
  if (err.status === 0 || err.code === 'NETWORK_ERROR') return [GENERIC_ERROR]
  const fieldTexts = err.fields ? Object.values(err.fields) : []
  if (fieldTexts.length > 0) return [...new Set(fieldTexts)]
  if (err.message === '' || /^HTTP \d+$/.test(err.message)) return [GENERIC_ERROR]
  return [err.message]
}

/** Server field messages by field name (SRS §5: shown under the field in red). */
export function fieldErrors(err: unknown): Record<string, string> {
  return isApiError(err) && err.fields ? { ...err.fields } : {}
}

/** An unknown id is the standard 404 page; any other load failure keeps the red box. */
export function isNotFound(err: unknown): boolean {
  return isApiError(err) && err.status === 404
}
