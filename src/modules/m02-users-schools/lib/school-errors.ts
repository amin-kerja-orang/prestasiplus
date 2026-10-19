/**
 * Turns a failed school call into red-alert lines (SRS FR-M02-81: `VALIDATION_ERROR` -> red alert,
 * input kept; the same shape as M01 `errorLines`, restated here because UI code never imports
 * another module's internals).
 */

import { isApiError } from '@/api'

/** Shown only when the request produced no usable message (network failure, HTTP 500). INFERRED copy. */
export const GENERIC_ERROR = 'Ralat berlaku. Sila cuba lagi.'

export function errorLines(err: unknown): string[] {
  if (!isApiError(err)) return [GENERIC_ERROR]
  if (err.status === 0 || err.code === 'NETWORK_ERROR') return [GENERIC_ERROR]
  const fieldTexts = err.fields ? Object.values(err.fields) : []
  if (fieldTexts.length > 0) return [...new Set(fieldTexts)]
  if (err.message === '' || /^HTTP \d+$/.test(err.message)) return [GENERIC_ERROR]
  return [err.message]
}

/** Server field messages by field name (empty when the error carries none). */
export function fieldErrors(err: unknown): Record<string, string> {
  return isApiError(err) && err.fields ? { ...err.fields } : {}
}
