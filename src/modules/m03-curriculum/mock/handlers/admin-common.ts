/**
 * Shared pieces of the M03 admin handlers (SRS v1.10 §7 #1–#24): guard, body normalisation,
 * validation rules (§5, Laravel default English messages, UNVERIFIED COPY) and the flash copy of
 * §8 / BR-18.
 *
 * The `NOT_FOUND` messages are the exact BR-18 flash texts: the screens redirect and show
 * `error.message` as the one-time error flash. The `status` fields of the mutations carry the
 * success flash text (§8, UNVERIFIED COPY).
 */

import { requireRole, rule, type ValidationRule } from '@/mock/define'

export const adminOnly = requireRole('admin')

// --- BR-18 error flashes (OBSERVED) ---------------------------------------------------------
export const CHAPTER_NOT_FOUND = 'Bab tidak dijumpai.'
export const CHAPTER_ID_REQUIRED = 'Chapter ID diperlukan.'
export const TOPIC_NOT_FOUND = 'Topik tidak dijumpai.'
export const SUBJECT_NOT_FOUND = 'Subjek tidak dijumpai.'
export const LEVEL_NOT_FOUND = 'Tahap Pendidikan tidak dijumpai.'
/** INFERRED: the live site shows no screen for a missing subtopic (the id comes from a form). */
export const SUBTOPIC_NOT_FOUND = 'Subtopik tidak dijumpai.'

// --- §8 success flashes (UNVERIFIED COPY) ---------------------------------------------------
export const FLASH = {
  chapter: {
    created: 'Bab berjaya ditambah.',
    updated: 'Bab berjaya dikemaskini.',
    deleted: 'Bab berjaya dipadam.',
  },
  topic: {
    created: 'Topik berjaya ditambah.',
    updated: 'Topik berjaya dikemaskini.',
    deleted: 'Topik berjaya dipadam.',
  },
  subtopic: {
    created: 'Subtopik berjaya ditambah.',
    updated: 'Subtopik berjaya dikemaskini.',
    deleted: 'Subtopik berjaya dipadam.',
  },
  subject: {
    created: 'Subjek berjaya ditambah.',
    updated: 'Subjek berjaya dikemaskini.',
    deleted: 'Subjek berjaya dipadam.',
  },
  level: {
    created: 'Tahap Pendidikan berjaya ditambah.',
    updated: 'Tahap Pendidikan berjaya dikemaskini.',
    deleted: 'Tahap Pendidikan berjaya dipadam.',
  },
} as const

/**
 * Laravel trims string input and turns empty strings into null (`ConvertEmptyStringsToNull`).
 * Anything that is not a plain object becomes `{}`.
 */
export function normalise(body: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return out
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') {
      const t = value.trim()
      out[key] = t === '' ? null : t
    } else out[key] = value
  }
  return out
}

export const isString = (): ValidationRule =>
  rule('string', (v) => (typeof v === 'string' ? null : 'The :attribute field must be a string.'))

/** A whole number, as a JSON number or a numeric string (form posts send text). */
export function asInt(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isInteger(value) ? value : undefined
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number(value.trim())
  return undefined
}

export const isInteger = (): ValidationRule =>
  rule('integer', (v) =>
    asInt(v) === undefined ? 'The :attribute field must be an integer.' : null,
  )

/** Minimum for a numeric-looking value (so "0" and 0 both work); Laravel `min:` on integers. */
export const atLeast = (n: number): ValidationRule =>
  rule('min', (v) => {
    const i = asInt(v)
    return i !== undefined && i < n ? `The :attribute field must be at least ${String(n)}.` : null
  })

/** Laravel `boolean`: true, false, 1, 0, "1", "0". */
export function asBoolean(value: unknown): boolean | undefined {
  if (value === true || value === 1 || value === '1') return true
  if (value === false || value === 0 || value === '0') return false
  return undefined
}

export const isBoolean = (): ValidationRule =>
  rule('boolean', (v) =>
    asBoolean(v) === undefined ? 'The :attribute field must be true or false.' : null,
  )

export const textOrNull = (v: unknown): string | null =>
  typeof v === 'string' && v !== '' ? v : null

export const intOrNull = (v: unknown): number | null => asInt(v) ?? null

/** `:id` path parameter (parsed by the router with `int()`). */
export const idParam = (req: { params: Record<string, unknown> }): number => req.params.id as number
