/**
 * Request-body helpers of the M02 admin user handlers. Same conventions as the M01 handlers (a module may
 * not import another module's handler code, D12): Laravel's `TrimStrings` and
 * `ConvertEmptyStringsToNull` middleware run before validation, so text fields are trimmed and a blank
 * one becomes `null`; password fields are never trimmed.
 */

import type { MockRequest } from '@/mock/define'

/** Fields that must reach the handler exactly as typed. */
const UNTRIMMED = new Set([
  'password',
  'passwordConfirmation',
  'newPassword',
  'newPasswordConfirmation',
])

export type Body = Record<string, unknown>

/** The JSON body as a plain object, trimmed and with blank strings as `null`. */
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

/**
 * A list of integers (`linkedStudentIds`, `ids`): the de-duplicated ids, or `null` when the value is not
 * an array of integers.
 */
export function intList(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null
  const out: number[] = []
  for (const item of value as unknown[]) {
    const n = intOrNull(item)
    if (n === null) return null
    if (!out.includes(n)) out.push(n)
  }
  return out
}
