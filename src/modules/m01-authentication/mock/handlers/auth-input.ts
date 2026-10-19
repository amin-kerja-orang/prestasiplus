/**
 * Request-body helpers shared by the M01 auth and account handlers.
 *
 * Laravel's `TrimStrings` and `ConvertEmptyStringsToNull` middleware run before validation, so the
 * mock does the same: text fields are trimmed and a blank one becomes `null`. Password fields are
 * never trimmed. The validation messages are the Laravel 11 English defaults of SRS M01 §5.
 */

import type { MockRequest } from '@/mock/define'

/** Fields that must reach the handler exactly as typed. */
const UNTRIMMED = new Set(['password', 'passwordConfirmation', 'currentPassword'])

export type Body = Record<string, unknown>

/** The JSON (or multipart) body as a plain object, trimmed and with blank strings as `null`. */
export function bodyOf(req: MockRequest): Body {
  const raw = req.body
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  if (typeof Blob !== 'undefined' && raw instanceof Blob) return {}
  const out: Body = {}
  for (const [key, value] of Object.entries(raw as Body)) {
    if (typeof value === 'string' && !UNTRIMMED.has(key)) {
      const trimmed = value.trim()
      out[key] = trimmed === '' ? null : trimmed
    } else {
      out[key] = value
    }
  }
  return out
}

export function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

/** An integer sent as a number or a digit string; `null` for anything else. */
export function intOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim())
  return null
}

/** Laravel `$request->boolean()`: true for `true`, 1, "1", "true", "on", "yes". */
export function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') return ['1', 'true', 'on', 'yes'].includes(value.toLowerCase())
  return false
}

export function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
}
