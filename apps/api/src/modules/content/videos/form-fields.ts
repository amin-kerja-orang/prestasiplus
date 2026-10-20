import { CONTENT_MESSAGES } from '@pp/contract'
import type { z } from 'zod'

import { ApiError } from '../../../common/errors/api-error'

export const FIELD_REQUIRED = CONTENT_MESSAGES.fieldRequired
export const FIELD_INVALID = CONTENT_MESSAGES.fieldInvalid

type Fields = Record<string, string>

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** The first string of a query value (a repeated key gives its first value; anything else is "absent"). */
export function queryString(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return undefined
}

/** Page number: missing, non-numeric or below 1 is page 1 (never rejected, like the mock). */
export function pageOf(raw: string | undefined): number {
  const t = raw?.trim() ?? ''
  return /^\d+$/.test(t) && Number(t) >= 1 ? Math.min(Number(t), 10_000_000) : 1
}

/**
 * Validates a JSON/form body against a contract object schema with the placeholder copy of the mock:
 * a missing, null or blank required field is "Medan ini diperlukan.", any other failure and any unknown
 * key is "Medan ini tidak sah." (strict bodies: a client-sent `uploaderId`, `authorId` or `schoolId` is refused, never read).
 * `prepare` may normalise the raw values first (for example a blank optional id to null).
 */
export function validateBody<S extends z.ZodObject>(
  schema: S,
  raw: unknown,
  required: readonly string[],
  prepare?: (body: Record<string, unknown>) => Record<string, unknown>,
): z.output<S> {
  const input = isPlainObject(raw) ? { ...raw } : {}
  const fields: Fields = {}
  const known = new Set(Object.keys(schema.shape))
  for (const key of Object.keys(input)) if (!known.has(key)) fields[key] = FIELD_INVALID
  const body = prepare ? prepare(input) : input
  for (const key of required) {
    const v = body[key]
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) fields[key] = FIELD_REQUIRED
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path.length ? issue.path.map(String).join('.') : '_'
      fields[key] ??= FIELD_INVALID
    }
  }
  if (Object.keys(fields).length > 0) throw ApiError.of('VALIDATION_ERROR', { fields })
  return (parsed as { data: z.output<S> }).data
}
